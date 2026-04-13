import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated } from "../portal-auth";
import { checkSubmoduleAccess } from "./helpers";
import { type ManagedUser, insertRequisitionSchema, insertRequisitionCommentSchema, type ApprovalStep, type Requisition, type RequisitionQuotation } from "@workspace/db";
import { z } from "zod";
import { initializeWorkflow, approveStep, rejectStep, markPOCreated } from "../workflow";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function getUserCostCenter(managedUser: ManagedUser): Promise<string | null> {
  try {
    const empDs = await storage.getDataSourceBySlug("employee-directory");
    if (!empDs) return null;
    const email = managedUser.email?.trim().toLowerCase();
    const empRecord = managedUser.employeeCode
      ? await storage.getDsRecordByField(empDs.id, "employee_code", managedUser.employeeCode)
      : null;
    const record = empRecord || (email ? await storage.getDsRecordByField(empDs.id, "email", email, true) : null);
    if (!record) return null;
    const rawCostCenter = String((record.data as any).cost_center || "").trim();
    if (!rawCostCenter) return null;
    return await storage.resolveCostCenter(rawCostCenter);
  } catch {
    return null;
  }
}

async function isPurchasingReviewApprover(requisitionId: string, managedUser: ManagedUser): Promise<boolean> {
  const requisition = await storage.getRequisition(requisitionId);
  if (!requisition || requisition.status !== "Pending Purchasing Review") return false;
  return storage.hasPendingStepForUser(requisitionId, String(managedUser.id));
}

export async function registerRequisitionRoutes(app: Express, _httpServer: Server) {
  // ========== Employee Profile Lookup ==========

  app.get("/api/employee-profile", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const email = managedUser.email.trim().toLowerCase();
      console.log(`[employee-profile] Looking up profile for email: ${email}`);

      const employeeDs = await storage.getDataSourceBySlug("employee-directory");
      if (!employeeDs) {
        console.log(`[employee-profile] Employee directory data source not found`);
        return res.status(404).json({ message: "Employee directory not found" });
      }

      const { records } = await storage.getDsRecords(employeeDs.id, { search: email, limit: 100 });
      console.log(`[employee-profile] Search returned ${records.length} records for email: ${email}`);
      const match = records.find((r: any) => {
        const data = r.data as Record<string, any>;
        return data.email && String(data.email).trim().toLowerCase() === email;
      });

      if (!match) {
        console.log(`[employee-profile] No exact match found for email: ${email}`);
        return res.status(404).json({ message: "Your employee profile was not found in the directory. Please contact your administrator." });
      }

      const data = match.data as Record<string, any>;
      console.log(`[employee-profile] Found profile for ${data.full_name} (${email})`);
      res.json({
        full_name: data.full_name || null,
        position: data.position || null,
        department_english: data.department_english || null,
        cost_center: data.cost_center || null,
        cost_center_account_number: data.cost_center_account_number || null,
      });
    } catch (e: any) {
      console.error(`[employee-profile] Error during lookup: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // ========== Budget Owners API ==========

  app.get("/api/budget-owners", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (_req, res) => {
    try {
      const empDs = await storage.getDataSourceBySlug("employee-directory");
      if (!empDs) {
        return res.json([]);
      }

      const ownerRows = await db.execute(sql`
        SELECT DISTINCT
          data->>'budget_owner_code' as code,
          data->>'budget_owner_full_name' as name
        FROM ds_records
        WHERE data_source_id = ${empDs.id}
          AND data->>'budget_owner_code' IS NOT NULL
          AND data->>'budget_owner_code' != ''
          AND data->>'budget_owner_full_name' IS NOT NULL
          AND data->>'budget_owner_full_name' != ''
        ORDER BY name
      `);

      const ccRows = await db.execute(sql`
        SELECT DISTINCT
          data->>'budget_owner_code' as code,
          data->>'cost_center_account_number' as cc_acct
        FROM ds_records
        WHERE data_source_id = ${empDs.id}
          AND data->>'budget_owner_code' IS NOT NULL
          AND data->>'budget_owner_code' != ''
          AND data->>'cost_center_account_number' IS NOT NULL
          AND data->>'cost_center_account_number' != ''
      `);

      const ownerCcMap = new Map<string, Set<string>>();
      for (const row of ccRows.rows as any[]) {
        const code = String(row.code).trim();
        if (!ownerCcMap.has(code)) ownerCcMap.set(code, new Set());
        ownerCcMap.get(code)!.add(String(row.cc_acct).trim());
      }

      const allDepts = await storage.getActiveDepartments();
      const deptByExtId = new Map<string, number>();
      for (const d of allDepts) {
        deptByExtId.set(d.externalId, d.internalId);
      }

      const result = ownerRows.rows.map((row: any) => {
        const code = String(row.code).trim();
        const ccAccts = ownerCcMap.get(code) || new Set<string>();
        const departmentIds: number[] = [];
        for (const cc of ccAccts) {
          const deptId = deptByExtId.get(cc);
          if (deptId != null) departmentIds.push(deptId);
        }
        return {
          id: code,
          name: String(row.name).trim().replace(/\s+/g, ' '),
          departmentIds,
        };
      });

      return res.json(result);
    } catch (e: any) {
      console.error("[budget-owners] Error:", e.message, e.stack);
      return res.status(500).json({ message: e.message });
    }
  });

  // ========== Requisitions API Routes ==========

  app.get("/api/requisitions", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;

      let approverRequisitionIds: string[] | undefined;
      if (!isAdmin) {
        try {
          const pendingSteps = await storage.getPendingApprovalSteps(String(managedUser.id));
          if (pendingSteps.length > 0) {
            approverRequisitionIds = [...new Set(pendingSteps.map(s => s.requisitionId))];
          }
        } catch (err) {
          console.warn("[requisitions] Error fetching pending approval steps for user visibility:", err);
        }
      }

      res.json(await storage.getAllRequisitions({
        search,
        status,
        userId: isAdmin ? undefined : String(managedUser.id),
        approverRequisitionIds,
      }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisitions/:id", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const r = await storage.getRequisition(req.params.id);
      if (!r) return res.status(404).json({ message: "Not found" });
      const isApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
      const wasPastApprover = !isApprover && await storage.hasAnyStepForUser(req.params.id, String(managedUser.id));
      if (!isAdmin && r.userId !== String(managedUser.id) && !isApprover && !wasPastApprover) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/requisitions", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const { attachments, ...data } = req.body;
      const parsed = insertRequisitionSchema.safeParse(data);
      if (!parsed.success) return res.status(400).json({ message: "Invalid requisition data", errors: parsed.error.flatten() });

      if (parsed.data.budgetOwnerId) {
        const empDs = await storage.getDataSourceBySlug("employee-directory");
        if (empDs) {
          const checkOwner = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM ds_records
            WHERE data_source_id = ${empDs.id}
              AND data->>'budget_owner_code' = ${parsed.data.budgetOwnerId}
          `);
          if (Number(checkOwner.rows[0]?.cnt) === 0) {
            return res.status(400).json({ message: "Invalid budget owner selection" });
          }
        }
      }

      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
      const maxFileSize = 10 * 1024 * 1024;
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          if (!allowedTypes.includes(att.fileType)) return res.status(400).json({ message: `Invalid file type: ${att.fileType}. Allowed: JPG, PNG, PDF` });
          if (att.fileSize > maxFileSize) return res.status(400).json({ message: `File too large: ${att.filename}. Maximum 10MB per file.` });
        }
      }

      const requisition = await storage.createRequisition({ ...parsed.data, userId: String(managedUser.id) });
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          await storage.createRequisitionAttachment({
            requisitionId: requisition.id,
            filename: att.filename,
            fileType: att.fileType,
            fileSize: att.fileSize,
            fileData: att.fileData,
          });
        }
      }

      await initializeWorkflow(requisition);

      const updated = await storage.getRequisition(requisition.id);
      res.json(updated || requisition);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  const adminUpdateSchema = z.object({
    vendorName: z.string().nullable().optional(),
    estimatedCostAed: z.number().optional(),
    budgetLineAccountCode: z.string().nullable().optional(),
    isBudgeted: z.boolean().optional(),
    requiredByDate: z.string().optional(),
    projectStartDate: z.string().nullable().optional(),
  });

  const approverUpdateSchema = z.object({
    vendorName: z.string().nullable().optional(),
    budgetLineAccountCode: z.string().nullable().optional(),
    requiredByDate: z.string().optional(),
    projectStartDate: z.string().nullable().optional(),
  });

  app.patch("/api/requisitions/:id", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";

      if (isAdmin) {
        const parsed = adminUpdateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Invalid update data", errors: parsed.error.flatten() });
        const r = await storage.updateRequisition(req.params.id, parsed.data);
        if (!r) return res.status(404).json({ message: "Not found" });
        return res.json(r);
      }

      const isCurrentApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
      if (!isCurrentApprover) {
        return res.status(403).json({ message: "Only administrators or assigned approvers can update requisitions" });
      }
      const parsed = approverUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid update data", errors: parsed.error.flatten() });
      const r = await storage.updateRequisition(req.params.id, parsed.data);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/requisitions/:id", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) {
        const r = await storage.getRequisition(req.params.id);
        if (!r) return res.status(404).json({ message: "Not found" });
        if (r.userId !== String(managedUser.id)) return res.status(403).json({ message: "Access denied" });
      }
      const ok = await storage.deleteRequisition(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisitions/:id/attachments", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) {
        const r = await storage.getRequisition(req.params.id);
        const isApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover)) return res.status(403).json({ message: "Access denied" });
      }
      res.json(await storage.getRequisitionAttachments(req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisition-attachments/:id/download", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const att = await storage.getRequisitionAttachmentById(req.params.id);
      if (!att) return res.status(404).json({ message: "Not found" });
      if (!isAdmin) {
        const r = await storage.getRequisition(att.requisitionId);
        const isApprover = await storage.hasPendingStepForUser(att.requisitionId, String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover)) return res.status(403).json({ message: "Access denied" });
      }
      const base64Data = att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData;
      const buffer = Buffer.from(base64Data, "base64");
      res.setHeader("Content-Type", att.fileType);
      res.setHeader("Content-Disposition", `attachment; filename="${att.filename}"`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisitions/:id/comments", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) {
        const r = await storage.getRequisition(req.params.id);
        const isApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover)) return res.status(403).json({ message: "Access denied" });
      }
      res.json(await storage.getRequisitionComments(req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/requisitions/:id/comments", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const isCurrentApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));

      if (!isAdmin && !isCurrentApprover) {
        return res.status(403).json({ message: "Only administrators or assigned approvers can post comments" });
      }
      const parsed = insertRequisitionCommentSchema.pick({ body: true }).extend({ body: z.string().trim().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Comment body is required" });
      const requisition = await storage.getRequisition(req.params.id);
      if (!requisition) return res.status(404).json({ message: "Requisition not found" });
      const authorName = managedUser.displayName || [managedUser.firstName, managedUser.lastName].filter(Boolean).join(" ") || managedUser.username;
      const comment = await storage.createRequisitionComment({
        requisitionId: req.params.id,
        authorId: String(managedUser.id),
        authorName,
        body: parsed.data.body,
      });
      res.json(comment);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/requisitions/:id/attachments", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const isCurrentApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
      if (!isAdmin && !isCurrentApprover) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { filename, fileType, fileSize, fileData } = req.body;
      if (!filename || !fileType || !fileSize || !fileData) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
      const maxFileSize = 10 * 1024 * 1024;
      if (!allowedTypes.includes(fileType)) {
        return res.status(400).json({ message: `Invalid file type: ${fileType}. Allowed: JPG, PNG, PDF` });
      }
      if (fileSize > maxFileSize) {
        return res.status(400).json({ message: `File too large: ${filename}. Maximum 10MB per file.` });
      }
      const att = await storage.createRequisitionAttachment({
        requisitionId: req.params.id,
        filename,
        fileType,
        fileSize,
        fileData,
      });
      res.json(att);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ========== Approval Workflow Routes ==========

  app.get("/api/my-approvals", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const userId = String(managedUser.id);
      console.log(`[my-approvals] Fetching approvals for user=${userId} (${managedUser.username || managedUser.email}), employeeCode=${managedUser.employeeCode || "none"}`);

      const steps = await storage.getPendingApprovalSteps(userId);
      console.log(`[my-approvals] Found ${steps.length} pending steps for user=${userId}. Direct/group breakdown logged in storage layer.`);

      const results: (ApprovalStep & { requisition?: Requisition })[] = [];
      for (const step of steps) {
        const requisition = await storage.getRequisition(step.requisitionId);
        results.push({ ...step, requisition: requisition || undefined });
      }
      res.json(results);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisitions/:id/my-pending-step", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const userId = String(managedUser.id);
      const userName = managedUser.displayName || [managedUser.firstName, managedUser.lastName].filter(Boolean).join(" ") || managedUser.username;
      console.log(`[my-pending-step] Checking requisition=${req.params.id} for userId=${userId} userName="${userName}"`);
      const directStep = await storage.getUserPendingStepForRequisition(req.params.id, userId);
      if (directStep) {
        console.log(`[my-pending-step] Found direct step ${directStep.id} (assignedTo=${directStep.assignedTo})`);
        return res.json(directStep);
      }
      const costCenter = await getUserCostCenter(managedUser);
      if (costCenter) {
        const allSteps = await storage.getApprovalSteps(req.params.id);
        const groupStep = allSteps.find(s => s.decision === "pending" && s.assignedToGroup === costCenter);
        if (groupStep) {
          console.log(`[my-pending-step] Found group step ${groupStep.id} (assignedToGroup=${groupStep.assignedToGroup})`);
          return res.json(groupStep);
        }
      }
      const relinkedStep = await storage.findAndRelinkOrphanedStep(req.params.id, userId, userName);
      if (relinkedStep) {
        console.log(`[my-pending-step] Re-linked orphaned step ${relinkedStep.id} to userId=${userId}`);
        return res.json(relinkedStep);
      }
      console.log(`[my-pending-step] No pending step found for userId=${userId} on requisition=${req.params.id}`);
      res.json(null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/requisitions/:id/approval-steps", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) {
        const r = await storage.getRequisition(req.params.id);
        const isApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover)) return res.status(403).json({ message: "Access denied" });
      }
      res.json(await storage.getApprovalSteps(req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/approval-steps/:id/approve", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const step = await storage.getApprovalStep(req.params.id);
      if (!step) return res.status(404).json({ message: "Approval step not found" });
      if (step.decision !== "pending") return res.status(400).json({ message: "This step has already been decided" });
      const userName = managedUser.displayName || [managedUser.firstName, managedUser.lastName].filter(Boolean).join(" ") || managedUser.username;
      let isDirectAssignee = step.assignedTo === String(managedUser.id);
      if (!isDirectAssignee && !step.assignedTo && step.assignedToName?.trim().toLowerCase() === userName.trim().toLowerCase()) {
        console.log(`[approve] Re-linking orphaned step ${step.id} to userId=${managedUser.id}`);
        await storage.updateApprovalStep(step.id, { assignedTo: String(managedUser.id) });
        isDirectAssignee = true;
      }
      let isGroupMember = false;
      if (!isDirectAssignee && step.assignedToGroup) {
        const userCostCenter = await getUserCostCenter(managedUser);
        isGroupMember = userCostCenter === step.assignedToGroup;
      }
      if (!isDirectAssignee && !isGroupMember) {
        return res.status(403).json({ message: "You are not the assigned approver for this step" });
      }
      if (isGroupMember && !isDirectAssignee) {
        await storage.updateApprovalStep(step.id, {
          assignedTo: String(managedUser.id),
          assignedToName: userName,
        });
      }
      const { comments } = req.body;
      if (!comments || typeof comments !== "string" || !comments.trim()) {
        return res.status(400).json({ message: "A comment is required when approving a requisition" });
      }
      const result = await approveStep(req.params.id, comments.trim());
      res.json({ success: true, newStatus: result.newStatus, nextSteps: result.nextSteps });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/approval-steps/:id/reject", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const step = await storage.getApprovalStep(req.params.id);
      if (!step) return res.status(404).json({ message: "Approval step not found" });
      if (step.decision !== "pending") return res.status(400).json({ message: "This step has already been decided" });
      const userName = managedUser.displayName || [managedUser.firstName, managedUser.lastName].filter(Boolean).join(" ") || managedUser.username;
      let isDirectAssignee = step.assignedTo === String(managedUser.id);
      if (!isDirectAssignee && !step.assignedTo && step.assignedToName?.trim().toLowerCase() === userName.trim().toLowerCase()) {
        console.log(`[reject] Re-linking orphaned step ${step.id} to userId=${managedUser.id}`);
        await storage.updateApprovalStep(step.id, { assignedTo: String(managedUser.id) });
        isDirectAssignee = true;
      }
      let isGroupMember = false;
      if (!isDirectAssignee && step.assignedToGroup) {
        const userCostCenter = await getUserCostCenter(managedUser);
        isGroupMember = userCostCenter === step.assignedToGroup;
      }
      if (!isDirectAssignee && !isGroupMember) {
        return res.status(403).json({ message: "You are not the assigned approver for this step" });
      }
      if (isGroupMember && !isDirectAssignee) {
        await storage.updateApprovalStep(step.id, {
          assignedTo: String(managedUser.id),
          assignedToName: userName,
        });
      }
      const { comments } = req.body;
      if (!comments || typeof comments !== "string" || !comments.trim()) {
        return res.status(400).json({ message: "A comment is required when rejecting a requisition" });
      }
      const result = await rejectStep(req.params.id, comments.trim());
      res.json({ success: true, newStatus: result.newStatus });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/requisitions/:id/mark-po-created", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) return res.status(403).json({ message: "Only administrators can mark PO as created" });
      await markPOCreated(req.params.id);
      const updated = await storage.getRequisition(req.params.id);
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ========== Quotation Management Routes ==========

  app.get("/api/requisitions/:id/quotations", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      if (!isAdmin) {
        const r = await storage.getRequisition(req.params.id);
        const isApprover = await storage.hasPendingStepForUser(req.params.id, String(managedUser.id));
        const allSteps = await storage.getApprovalSteps(req.params.id);
        const wasApprover = allSteps.some(s => s.assignedTo === String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover && !wasApprover)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      res.json(await storage.getQuotationsByRequisition(req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/requisitions/:id/quotations", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const isProcurementApprover = await isPurchasingReviewApprover(req.params.id, managedUser);
      if (!isAdmin && !isProcurementApprover) {
        return res.status(403).json({ message: "Only the Procurement approver at Purchasing Review stage or admins can add quotations" });
      }
      const { vendorName, amountAed, fileName, fileType, fileSize, fileData, isRecommended, comments } = req.body;
      if (!vendorName || typeof vendorName !== "string" || !vendorName.trim()) {
        return res.status(400).json({ message: "Vendor name is required" });
      }
      const parsedAmount = Number(amountAed);
      if (amountAed === undefined || amountAed === null || amountAed === "" || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Amount (AED) is required and must be a positive number" });
      }
      if (fileData) {
        if (!fileType || !fileSize) {
          return res.status(400).json({ message: "fileType and fileSize are required when uploading a file" });
        }
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        const maxFileSize = 10 * 1024 * 1024;
        if (!allowedTypes.includes(fileType)) {
          return res.status(400).json({ message: `Invalid file type: ${fileType}. Allowed: JPG, PNG, PDF` });
        }
        if (fileSize > maxFileSize) {
          return res.status(400).json({ message: `File too large. Maximum 10MB per file.` });
        }
      }
      if (isRecommended) {
        const existing = await storage.getQuotationsByRequisition(req.params.id);
        for (const q of existing) {
          if (q.isRecommended) {
            await storage.updateQuotation(q.id, { isRecommended: false });
          }
        }
      }
      const quotation = await storage.createQuotation({
        requisitionId: req.params.id,
        vendorName: vendorName.trim(),
        amountAed: String(parsedAmount),
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        fileData: fileData || null,
        isRecommended: isRecommended || false,
        comments: comments || null,
        createdBy: String(managedUser.id),
      });
      res.json(quotation);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/quotations/:id/recommend", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      const isProcurementApprover = await isPurchasingReviewApprover(quotation.requisitionId, managedUser);
      if (!isAdmin && !isProcurementApprover) {
        return res.status(403).json({ message: "Only the Procurement approver at Purchasing Review stage or admins can update quotations" });
      }
      const existing = await storage.getQuotationsByRequisition(quotation.requisitionId);
      for (const q of existing) {
        if (q.isRecommended && q.id !== req.params.id) {
          await storage.updateQuotation(q.id, { isRecommended: false });
        }
      }
      const updated = await storage.updateQuotation(req.params.id, { isRecommended: true });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/quotations/:id", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });
      const isProcurementApprover = await isPurchasingReviewApprover(quotation.requisitionId, managedUser);
      if (!isAdmin && !isProcurementApprover) {
        return res.status(403).json({ message: "Only the Procurement approver at Purchasing Review stage or admins can delete quotations" });
      }
      const ok = await storage.deleteQuotation(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/quotations/:id/download", isAuthenticated, checkSubmoduleAccess("erp", "procurement"), async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const isAdmin = managedUser.role === "admin" || managedUser.role === "superadmin";
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation || !quotation.fileData) return res.status(404).json({ message: "Not found" });
      if (!isAdmin) {
        const r = await storage.getRequisition(quotation.requisitionId);
        const isApprover = await storage.hasPendingStepForUser(quotation.requisitionId, String(managedUser.id));
        const allSteps = await storage.getApprovalSteps(quotation.requisitionId);
        const wasApprover = allSteps.some(s => s.assignedTo === String(managedUser.id));
        if (!r || (r.userId !== String(managedUser.id) && !isApprover && !wasApprover)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      const base64Data = quotation.fileData.includes(",") ? quotation.fileData.split(",")[1] : quotation.fileData;
      const buffer = Buffer.from(base64Data, "base64");
      res.setHeader("Content-Type", quotation.fileType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${quotation.fileName || "quotation"}"`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
}
