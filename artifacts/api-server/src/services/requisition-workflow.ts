import { storage } from "../storage";
import { env } from "../lib/env";
import type { Requisition, ApprovalStep, WorkflowStage, ManagedUser } from "@workspace/db";

// ── Constants ────────────────────────────────────────────────────────────────
// AED thresholds for the Final Approval stage.
// Amounts in requisitions are stored in fils (AED × 100) but Requisition.estimatedCostAed
// is actually an int field representing AED. We compare against AED directly.
const FINAL_APPROVAL_THRESHOLD_SKIP = 5_000; // ≤ 5 000 → skip final, go to Ready for Purchase
const TIER_1_MAX = 50_000; // ≤ 50 000 → admins[0]
const TIER_2_MAX = 200_000; // ≤ 200 000 → admins[1]
// Above 200 000 → all admins (parallel)

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApproverAssignment {
  userId: string | null;
  userName: string;
  groupCostCenter?: string;
}

export interface WorkflowRouter {
  getLineManager(requisition: Requisition): Promise<ApproverAssignment>;
  getPurchasingReviewer(requisition: Requisition): Promise<ApproverAssignment>;
  getBudgetOwner(requisition: Requisition): Promise<ApproverAssignment>;
  getFinalApprovers(requisition: Requisition, amount: number): Promise<ApproverAssignment[]>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function userDisplayName(user: ManagedUser): string {
  return (
    user.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username
  );
}

async function getAdminUsers(): Promise<ManagedUser[]> {
  // TODO: brittle — ordering by createdAt means admins[0]/admins[1] depend on
  // account creation order. If a superadmin is recreated, thresholds may route
  // to the wrong person. Future improvement: add explicit is_final_approver_tier_1/2
  // flags on managed_users and select by flag instead of index.
  const users = await storage.getAllManagedUsers();
  return users
    .filter((u) => u.role === "admin" || u.role === "superadmin")
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
}

async function resolveDirectManager(requester: ManagedUser): Promise<ApproverAssignment | null> {
  const empDs = await storage.getDataSourceBySlug("employee-directory");
  if (!empDs) return null;

  // Find the requester's Employee Directory record
  let record = null;
  if (requester.employeeCode) {
    record = await storage.getDsRecordByField(empDs.id, "employee_code", requester.employeeCode);
  }
  if (!record && requester.email) {
    record = await storage.getDsRecordByField(empDs.id, "email", requester.email.trim().toLowerCase(), true);
  }
  if (!record) return null;

  const data = record.data as Record<string, any>;
  const dmCode = String(data.direct_manager_code || "").trim();
  const dmName = String(data.direct_manager_full_name || "").trim();
  if (!dmCode && !dmName) return null;

  // Try to find the manager's managed_users account — first by employee_code, then by email from Employee Directory
  let manager = dmCode ? await storage.getManagedUserByEmployeeCode(dmCode) : undefined;
  if (!manager && dmCode) {
    const managerRecord = await storage.getDsRecordByField(empDs.id, "employee_code", dmCode);
    const managerEmail = managerRecord ? String((managerRecord.data as any).email || "").trim().toLowerCase() : "";
    if (managerEmail) {
      manager = await storage.getManagedUserByEmail(managerEmail);
    }
  }

  if (manager) {
    return { userId: manager.id, userName: userDisplayName(manager) };
  }
  // Manager exists in Employee Directory but has no managed_users account yet
  // — we still create the step with just a name; it'll re-link when they log in.
  return { userId: null, userName: dmName || dmCode };
}

// ── Default router ───────────────────────────────────────────────────────────

export const defaultRouter: WorkflowRouter = {
  async getLineManager(requisition) {
    if (!requisition.userId) {
      console.warn("[workflow] Requisition has no userId — falling back to admin assignment");
      const admins = await getAdminUsers();
      if (admins.length === 0) throw new Error("No admin users found for fallback assignment");
      return { userId: admins[0].id, userName: userDisplayName(admins[0]) };
    }
    const requester = await storage.getManagedUser(requisition.userId);
    if (!requester) {
      console.warn(`[workflow] Requester ${requisition.userId} not found — falling back to admin`);
      const admins = await getAdminUsers();
      return { userId: admins[0].id, userName: userDisplayName(admins[0]) };
    }
    const resolved = await resolveDirectManager(requester);
    if (resolved) return resolved;

    console.warn(
      `[workflow] Could not resolve line manager for requester ${requester.username} — falling back to admin assignment`,
    );
    const admins = await getAdminUsers();
    return { userId: admins[0].id, userName: userDisplayName(admins[0]) };
  },

  async getPurchasingReviewer(_requisition) {
    // Group step — assigned to everyone with cost_center = env.PROCUREMENT_COST_CENTER in Employee Directory
    return {
      userId: null,
      userName: "Purchasing Team",
      groupCostCenter: env.PROCUREMENT_COST_CENTER,
    };
  },

  async getBudgetOwner(requisition) {
    const code = (requisition.budgetOwnerId || "").trim();
    const name = (requisition.budgetOwnerName || "").trim();

    if (code) {
      const user = await storage.getManagedUserByEmployeeCode(code);
      if (user) return { userId: user.id, userName: userDisplayName(user) };
    }
    if (name) {
      // Try to find by display name (loose match)
      const allUsers = await storage.getAllManagedUsers();
      const match = allUsers.find((u) => {
        const full = userDisplayName(u).toLowerCase();
        return full === name.toLowerCase() || full.includes(name.toLowerCase());
      });
      if (match) return { userId: match.id, userName: userDisplayName(match) };
      return { userId: null, userName: name };
    }

    console.warn("[workflow] No budget owner info on requisition — falling back to admin");
    const admins = await getAdminUsers();
    return { userId: admins[0].id, userName: userDisplayName(admins[0]) };
  },

  async getFinalApprovers(_requisition, amount) {
    const admins = await getAdminUsers();
    if (admins.length === 0) throw new Error("No admin users found for final approval");

    if (amount <= FINAL_APPROVAL_THRESHOLD_SKIP) {
      return []; // Skip final — caller should set status to Ready for Purchase
    }
    if (amount <= TIER_1_MAX) {
      return [{ userId: admins[0].id, userName: userDisplayName(admins[0]) }];
    }
    if (amount <= TIER_2_MAX) {
      const target = admins[1] || admins[0];
      return [{ userId: target.id, userName: userDisplayName(target) }];
    }
    // > 200 000 — all admins in parallel
    return admins.map((a) => ({ userId: a.id, userName: userDisplayName(a) }));
  },
};

// ── Workflow engine ──────────────────────────────────────────────────────────

export async function initializeWorkflow(
  requisitionId: string,
  router: WorkflowRouter = defaultRouter,
): Promise<void> {
  const requisition = await storage.getRequisition(requisitionId);
  if (!requisition) throw new Error(`Requisition ${requisitionId} not found`);

  const lineManager = await router.getLineManager(requisition);
  await storage.createApprovalStep({
    requisitionId,
    stage: "Pending Line Manager" satisfies WorkflowStage,
    assignedTo: lineManager.userId,
    assignedToName: lineManager.userName,
    assignedToGroup: lineManager.groupCostCenter ?? null,
    decision: "pending",
    comments: null,
  });
  await storage.updateRequisition(requisitionId, { status: "Pending Line Manager" });
}

async function advanceStage(
  requisition: Requisition,
  nextStage: WorkflowStage,
  router: WorkflowRouter,
): Promise<void> {
  let approvers: ApproverAssignment[] = [];

  switch (nextStage) {
    case "Pending Purchasing Review": {
      const pr = await router.getPurchasingReviewer(requisition);
      approvers = [pr];
      break;
    }
    case "Pending Budget Owner": {
      const bo = await router.getBudgetOwner(requisition);
      approvers = [bo];
      break;
    }
    case "Pending Final Approval": {
      approvers = await router.getFinalApprovers(requisition, requisition.estimatedCostAed || 0);
      if (approvers.length === 0) {
        // Under threshold — go straight to Ready for Purchase
        await storage.updateRequisition(requisition.id, { status: "Ready for Purchase" });
        return;
      }
      break;
    }
    case "Ready for Purchase":
    case "PO Created":
    case "Rejected":
      // Terminal stages — just update status
      await storage.updateRequisition(requisition.id, { status: nextStage });
      return;
    default:
      console.warn(`[workflow] Unknown next stage: ${nextStage}`);
      return;
  }

  // Create one step per approver (parallel if multiple)
  for (const approver of approvers) {
    await storage.createApprovalStep({
      requisitionId: requisition.id,
      stage: nextStage,
      assignedTo: approver.userId,
      assignedToName: approver.userName,
      assignedToGroup: approver.groupCostCenter ?? null,
      decision: "pending",
      comments: null,
    });
  }
  await storage.updateRequisition(requisition.id, { status: nextStage });
}

function nextStageAfter(current: WorkflowStage): WorkflowStage | null {
  switch (current) {
    case "Pending Line Manager":
      return "Pending Purchasing Review";
    case "Pending Purchasing Review":
      return "Pending Budget Owner";
    case "Pending Budget Owner":
      return "Pending Final Approval";
    case "Pending Final Approval":
      return "Ready for Purchase";
    default:
      return null;
  }
}

export async function approveStep(
  stepId: string,
  userId: string,
  comments: string | null,
  router: WorkflowRouter = defaultRouter,
): Promise<ApprovalStep> {
  const step = await storage.getApprovalStep(stepId);
  if (!step) throw new Error("Approval step not found");
  if (step.decision !== "pending") throw new Error("Step already decided");

  const user = await storage.getManagedUser(userId);
  if (!user) throw new Error("Approver not found");

  const updated = await storage.updateApprovalStep(stepId, {
    decision: "approved",
    comments: comments ?? null,
    decidedAt: new Date(),
    assignedTo: step.assignedTo ?? userId, // re-link if orphaned
  });
  if (!updated) throw new Error("Failed to update approval step");

  const requisition = await storage.getRequisition(step.requisitionId);
  if (!requisition) throw new Error("Requisition not found");

  // Parallel stage check: Pending Final Approval can have multiple steps.
  // Only advance when ALL pending steps at this stage are approved.
  const allSteps = await storage.getApprovalSteps(step.requisitionId);
  const sameStageSteps = allSteps.filter((s) => s.stage === step.stage);
  const allApproved = sameStageSteps.every((s) => s.decision === "approved");

  if (allApproved) {
    const next = nextStageAfter(step.stage as WorkflowStage);
    if (next) {
      await advanceStage(requisition, next, router);
    }
  }

  await storage.createRequisitionComment({
    requisitionId: step.requisitionId,
    authorId: userId,
    authorName: userDisplayName(user),
    body: `Approved [${step.stage}]${comments ? `: ${comments}` : ""}`,
  });

  return updated;
}

export async function rejectStep(
  stepId: string,
  userId: string,
  comments: string | null,
): Promise<ApprovalStep> {
  const step = await storage.getApprovalStep(stepId);
  if (!step) throw new Error("Approval step not found");
  if (step.decision !== "pending") throw new Error("Step already decided");

  const user = await storage.getManagedUser(userId);
  if (!user) throw new Error("Approver not found");

  const updated = await storage.updateApprovalStep(stepId, {
    decision: "rejected",
    comments: comments ?? null,
    decidedAt: new Date(),
    assignedTo: step.assignedTo ?? userId,
  });
  if (!updated) throw new Error("Failed to update approval step");

  // Cancel all remaining pending steps for this requisition
  const allSteps = await storage.getApprovalSteps(step.requisitionId);
  for (const s of allSteps) {
    if (s.id !== stepId && s.decision === "pending") {
      await storage.updateApprovalStep(s.id, {
        decision: "rejected",
        comments: "Auto-cancelled due to earlier rejection",
        decidedAt: new Date(),
      });
    }
  }

  await storage.updateRequisition(step.requisitionId, { status: "Rejected" });

  await storage.createRequisitionComment({
    requisitionId: step.requisitionId,
    authorId: "system",
    authorName: "Workflow System",
    body: `Requisition rejected at stage [${step.stage}] by ${userDisplayName(user)}${
      comments ? `: ${comments}` : ""
    }`,
  });

  return updated;
}

export async function markPOCreated(requisitionId: string, userId: string): Promise<Requisition> {
  const requisition = await storage.getRequisition(requisitionId);
  if (!requisition) throw new Error("Requisition not found");
  if (requisition.status !== "Ready for Purchase") {
    throw new Error(`Cannot mark PO created: status is "${requisition.status}"`);
  }

  const user = await storage.getManagedUser(userId);
  const actorName = user ? userDisplayName(user) : "Admin";

  const updated = await storage.updateRequisition(requisitionId, { status: "PO Created" });
  if (!updated) throw new Error("Failed to update requisition status");

  await storage.createRequisitionComment({
    requisitionId,
    authorId: userId,
    authorName: actorName,
    body: "PO Created — requisition closed.",
  });

  return updated;
}
