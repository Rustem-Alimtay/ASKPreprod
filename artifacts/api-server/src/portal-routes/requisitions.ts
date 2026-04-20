import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated } from "../portal-auth";
import { checkSubmoduleAccess, isAdmin } from "./helpers";
import {
  type ManagedUser,
  insertRequisitionSchema,
  insertRequisitionAttachmentSchema,
  insertRequisitionCommentSchema,
  insertRequisitionQuotationSchema,
} from "@workspace/db";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/httpError";
import {
  initializeWorkflow,
  approveStep,
  rejectStep,
  markPOCreated,
} from "../services/requisition-workflow";

const requisitionsGuard = checkSubmoduleAccess("erp", "requisitions");
const myApprovalsGuard = checkSubmoduleAccess("erp", "my-approvals");

export async function registerRequisitionRoutes(app: Express, _httpServer: Server) {
  // ──────────── Employee profile (for requisition-new auto-fill) ────────────
  // No submodule guard — any authenticated user can read their own profile.
  app.get("/api/employee-profile", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const empDs = await storage.getDataSourceBySlug("employee-directory");
    if (!empDs) {
      res.json(null);
      return;
    }
    let record = null;
    if (user.employeeCode) {
      record = await storage.getDsRecordByField(empDs.id, "employee_code", user.employeeCode);
    }
    if (!record && user.email) {
      record = await storage.getDsRecordByField(empDs.id, "email", user.email.trim().toLowerCase(), true);
    }
    if (!record) {
      res.json(null);
      return;
    }
    const d = record.data as Record<string, any>;
    res.json({
      employeeCode: d.employee_code ?? null,
      fullName: d.full_name ?? null,
      email: d.email ?? null,
      position: d.position ?? null,
      department: d.department_english ?? null,
      costCenter: d.cost_center ?? null,
      costCenterAccountNumber: d.cost_center_account_number ?? null,
      budgetOwnerCode: d.budget_owner_code ?? null,
      budgetOwnerName: d.budget_owner_full_name ?? null,
      directManagerCode: d.direct_manager_code ?? null,
      directManagerFullName: d.direct_manager_full_name ?? null,
    });
  }));

  // ──────────── Budget owners list (for dropdown) ────────────
  app.get("/api/budget-owners", isAuthenticated, requisitionsGuard, asyncHandler(async (_req, res) => {
    const empDs = await storage.getDataSourceBySlug("employee-directory");
    if (!empDs) {
      res.json([]);
      return;
    }
    const { records } = await storage.getDsRecords(empDs.id, { limit: 5000 });
    const seen = new Set<string>();
    const owners: { code: string; name: string }[] = [];
    for (const r of records) {
      const d = r.data as Record<string, any>;
      const code = String(d.budget_owner_code || "").trim();
      const name = String(d.budget_owner_full_name || "").trim();
      if (!code || !name) continue;
      const key = `${code}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      owners.push({ code, name });
    }
    owners.sort((a, b) => a.name.localeCompare(b.name));
    res.json(owners);
  }));

  // ──────────── Requisitions CRUD ────────────
  app.get("/api/requisitions", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const isAdminRole = user.role === "admin" || user.role === "superadmin";

    if (isAdminRole) {
      const list = await storage.getAllRequisitions({ search, status });
      res.json(list);
      return;
    }

    // Non-admin: their own requisitions + ones they've been assigned to approve
    const pendingSteps = await storage.getPendingApprovalSteps(user.id);
    const approverIds = Array.from(new Set(pendingSteps.map((s) => s.requisitionId)));
    const list = await storage.getAllRequisitions({
      search,
      status,
      userId: user.id,
      approverRequisitionIds: approverIds,
    });
    res.json(list);
  }));

  app.get("/api/requisitions/:id", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const r = await storage.getRequisition(req.params.id);
    if (!r) throw HttpError.notFound("Requisition not found");

    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isAdminRole && r.userId !== user.id) {
      const hasStep = await storage.hasPendingStepForUser(r.id, user.id);
      const pastStep = await storage.hasAnyStepForUser(r.id, user.id);
      if (!hasStep && !pastStep) throw HttpError.forbidden("You don't have access to this requisition");
    }
    res.json(r);
  }));

  app.post("/api/requisitions", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const { attachments, ...body } = req.body as {
      attachments?: Array<{ filename: string; fileType: string; fileSize: number; fileData: string }>;
    } & Record<string, unknown>;

    const parsed = { data: insertRequisitionSchema.parse(body) } as const;
    const created = await storage.createRequisition({ ...parsed.data, userId: user.id });

    if (Array.isArray(attachments)) {
      for (const a of attachments) {
        try {
          await storage.createRequisitionAttachment({
            requisitionId: created.id,
            filename: a.filename,
            fileType: a.fileType,
            fileSize: a.fileSize,
            fileData: a.fileData,
          });
        } catch (err) {
          console.warn("[requisitions] failed to save attachment:", err);
        }
      }
    }

    try {
      await initializeWorkflow(created.id);
    } catch (err) {
      console.error("[requisitions] initializeWorkflow failed:", err);
      // Don't fail the whole request — admin can manually fix the step later
    }

    await storage.createAuditLog({
      action: "requisition_created",
      category: "erp",
      userId: user.id,
      userEmail: user.email,
      details: { requisitionId: created.id, title: created.requestTitle },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    const final = await storage.getRequisition(created.id);
    res.status(201).json(final || created);
  }));

  app.patch("/api/requisitions/:id", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const existing = await storage.getRequisition(req.params.id);
    if (!existing) throw HttpError.notFound("Requisition not found");

    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isAdminRole && existing.userId !== user.id) {
      throw HttpError.forbidden("Only admins or the requester can edit");
    }

    const parsed = { data: insertRequisitionSchema.partial().parse(req.body) } as const;
    const updated = await storage.updateRequisition(req.params.id, parsed.data);
    res.json(updated);
  }));

  app.delete("/api/requisitions/:id", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const existing = await storage.getRequisition(req.params.id);
    if (!existing) throw HttpError.notFound("Requisition not found");
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isAdminRole && existing.userId !== user.id) {
      throw HttpError.forbidden("Only admins or the requester can delete");
    }
    await storage.deleteRequisition(req.params.id);

    await storage.createAuditLog({
      action: "requisition_deleted",
      category: "erp",
      userId: user.id,
      userEmail: user.email,
      details: { requisitionId: req.params.id, title: existing.requestTitle },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    res.status(204).send();
  }));

  // ──────────── Approval steps ────────────
  app.get("/api/requisitions/:id/approval-steps", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const steps = await storage.getApprovalSteps(req.params.id);
    res.json(steps);
  }));

  app.get("/api/requisitions/:id/my-pending-step", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    // Try to re-link if step is orphan (matched by name)
    const has = await storage.hasPendingStepForUser(req.params.id, user.id);
    if (!has) {
      res.json(null);
      return;
    }
    const step = await storage.getUserPendingStepForRequisition(req.params.id, user.id);
    res.json(step || null);
  }));

  app.post("/api/approval-steps/:id/approve", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const parsed = z.object({ comments: z.string().optional() }).parse(req.body ?? {});
    const step = await storage.getApprovalStep(req.params.id);
    if (!step) throw HttpError.notFound("Approval step not found");

    // Authorization: direct assignment, group assignment, or admin override
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    let authorized = step.assignedTo === user.id || isAdminRole;
    if (!authorized && step.assignedToGroup) {
      authorized = await storage.hasPendingGroupStepForUser(step.requisitionId, step.assignedToGroup);
    }
    if (!authorized && !step.assignedTo && step.assignedToName) {
      // Try orphan re-link
      const displayName =
        user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
      const relinked = await storage.findAndRelinkOrphanedStep(step.requisitionId, user.id, displayName);
      if (relinked) authorized = true;
    }
    if (!authorized) throw HttpError.forbidden("Not authorized to approve this step");

    const updated = await approveStep(req.params.id, user.id, parsed.comments ?? null);

    await storage.createAuditLog({
      action: "requisition_step_approved",
      category: "erp",
      userId: user.id,
      userEmail: user.email,
      details: { stepId: req.params.id, requisitionId: step.requisitionId, stage: step.stage },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    res.json(updated);
  }));

  app.post("/api/approval-steps/:id/reject", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const parsed = z.object({ comments: z.string().min(1, "Rejection reason is required") }).parse(req.body ?? {});
    const step = await storage.getApprovalStep(req.params.id);
    if (!step) throw HttpError.notFound("Approval step not found");

    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    let authorized = step.assignedTo === user.id || isAdminRole;
    if (!authorized && step.assignedToGroup) {
      authorized = await storage.hasPendingGroupStepForUser(step.requisitionId, step.assignedToGroup);
    }
    if (!authorized && !step.assignedTo && step.assignedToName) {
      const displayName =
        user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
      const relinked = await storage.findAndRelinkOrphanedStep(step.requisitionId, user.id, displayName);
      if (relinked) authorized = true;
    }
    if (!authorized) throw HttpError.forbidden("Not authorized to reject this step");

    const updated = await rejectStep(req.params.id, user.id, parsed.comments);

    await storage.createAuditLog({
      action: "requisition_step_rejected",
      category: "erp",
      userId: user.id,
      userEmail: user.email,
      details: { stepId: req.params.id, requisitionId: step.requisitionId, stage: step.stage, reason: parsed.comments },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    res.json(updated);
  }));

  // ──────────── My approvals ────────────
  app.get("/api/my-approvals", isAuthenticated, myApprovalsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const steps = await storage.getPendingApprovalSteps(user.id);
    // Attach requisition summary for each step
    const enriched = await Promise.all(
      steps.map(async (step) => {
        const r = await storage.getRequisition(step.requisitionId);
        return {
          step,
          requisition: r
            ? {
                id: r.id,
                requestTitle: r.requestTitle,
                department: r.department,
                requestedBy: r.requestedBy,
                estimatedCostAed: r.estimatedCostAed,
                status: r.status,
                dateOfRequest: r.dateOfRequest,
              }
            : null,
        };
      }),
    );
    res.json(enriched.filter((e) => e.requisition !== null));
  }));

  // ──────────── Quotations ────────────
  app.get("/api/requisitions/:id/quotations", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const list = await storage.getQuotationsByRequisition(req.params.id);
    res.json(list);
  }));

  app.post("/api/requisitions/:id/quotations", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const parsed = {
      data: insertRequisitionQuotationSchema.parse({ ...req.body, requisitionId: req.params.id, createdBy: user.id }),
    } as const;
    const created = await storage.createQuotation(parsed.data);
    res.status(201).json(created);
  }));

  app.patch("/api/quotations/:id/recommend", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const q = await storage.getQuotation(req.params.id);
    if (!q) throw HttpError.notFound("Quotation not found");
    await storage.clearRecommendedQuotations(q.requisitionId);
    const updated = await storage.updateQuotation(req.params.id, { isRecommended: true });
    res.json(updated);
  }));

  app.delete("/api/quotations/:id", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const ok = await storage.deleteQuotation(req.params.id);
    if (!ok) throw HttpError.notFound("Quotation not found");
    res.status(204).send();
  }));

  app.get("/api/quotations/:id/download", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const q = await storage.getQuotation(req.params.id);
    if (!q || !q.fileData) throw HttpError.notFound("Quotation file not found");
    const buffer = Buffer.from(q.fileData, "base64");
    res.setHeader("Content-Type", q.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${q.fileName || "quotation"}"`);
    res.send(buffer);
  }));

  // ──────────── Attachments ────────────
  app.get("/api/requisitions/:id/attachments", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const list = await storage.getRequisitionAttachments(req.params.id);
    // Don't ship the base64 payload in list response — just metadata
    res.json(list.map((a) => ({ id: a.id, requisitionId: a.requisitionId, filename: a.filename, fileType: a.fileType, fileSize: a.fileSize, uploadedAt: a.uploadedAt })));
  }));

  app.post("/api/requisitions/:id/attachments", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const parsed = {
      data: insertRequisitionAttachmentSchema.parse({ ...req.body, requisitionId: req.params.id }),
    } as const;
    const created = await storage.createRequisitionAttachment(parsed.data);
    res.status(201).json({
      id: created.id,
      requisitionId: created.requisitionId,
      filename: created.filename,
      fileType: created.fileType,
      fileSize: created.fileSize,
      uploadedAt: created.uploadedAt,
    });
  }));

  app.get("/api/attachments/:id/download", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const a = await storage.getRequisitionAttachmentById(req.params.id);
    if (!a) throw HttpError.notFound("Attachment not found");
    const buffer = Buffer.from(a.fileData, "base64");
    res.setHeader("Content-Type", a.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${a.filename}"`);
    res.send(buffer);
  }));

  app.delete("/api/attachments/:id", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const ok = await storage.deleteRequisitionAttachment(req.params.id);
    if (!ok) throw HttpError.notFound("Attachment not found");
    res.status(204).send();
  }));

  // ──────────── Comments ────────────
  app.get("/api/requisitions/:id/comments", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const list = await storage.getRequisitionComments(req.params.id);
    res.json(list);
  }));

  app.post("/api/requisitions/:id/comments", isAuthenticated, requisitionsGuard, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const parsed = { data: insertRequisitionCommentSchema.parse({
      ...req.body,
      requisitionId: req.params.id,
      authorId: user.id,
      authorName: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
    }) } as const;
    const created = await storage.createRequisitionComment(parsed.data);
    res.status(201).json(created);
  }));

  // ──────────── Mark PO Created (admin only, final step) ────────────
  app.post("/api/requisitions/:id/mark-po-created", isAuthenticated, requisitionsGuard, isAdmin, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const updated = await markPOCreated(req.params.id, user.id);

    await storage.createAuditLog({
      action: "requisition_po_created",
      category: "erp",
      userId: user.id,
      userEmail: user.email,
      details: { requisitionId: req.params.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    res.json(updated);
  }));
}
