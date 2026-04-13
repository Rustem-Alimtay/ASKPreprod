import { storage } from "./storage";
import type { Requisition, ApprovalStep, WorkflowStage } from "@workspace/db";

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

async function resolveDirectManager(requisition: Requisition): Promise<ApproverAssignment | null> {
  try {
    if (!requisition.userId) return null;

    const creator = await storage.getManagedUser(requisition.userId);
    if (!creator) return null;

    const empDs = await storage.getDataSourceBySlug("employee-directory");
    if (!empDs) {
      console.warn("[workflow] Employee Directory data source not found — falling back to admin assignment");
      return null;
    }

    const creatorEmployeeCode = creator.employeeCode?.trim();
    const creatorEmail = creator.email?.trim().toLowerCase();

    let creatorRecord = null;
    if (creatorEmployeeCode) {
      creatorRecord = await storage.getDsRecordByField(empDs.id, "employee_code", creatorEmployeeCode);
    }
    if (!creatorRecord && creatorEmail) {
      creatorRecord = await storage.getDsRecordByField(empDs.id, "email", creatorEmail, true);
    }

    if (!creatorRecord) {
      console.warn(`[workflow] No Employee Directory record found for user ${creator.username} (code=${creatorEmployeeCode}, email=${creatorEmail}) — falling back to admin assignment`);
      return null;
    }

    const managerCode = creatorRecord.data.direct_manager_code;
    if (!managerCode) {
      console.warn(`[workflow] Employee record for ${creator.username} has no direct_manager_code — falling back to admin assignment`);
      return null;
    }

    const managerCodeStr = String(managerCode).trim();
    let managerUser = await storage.getManagedUserByEmployeeCode(managerCodeStr);

    if (!managerUser) {
      const managerEmpRecord = await storage.getDsRecordByField(empDs.id, "employee_code", managerCodeStr);
      if (managerEmpRecord && managerEmpRecord.data.email) {
        const managerEmail = String(managerEmpRecord.data.email).trim().toLowerCase();
        managerUser = await storage.getManagedUserByEmail(managerEmail);
      }
    }

    if (!managerUser) {
      const managerName = creatorRecord.data.direct_manager_full_name
        ? String(creatorRecord.data.direct_manager_full_name)
        : `Manager (code: ${managerCode})`;
      console.warn(`[workflow] Direct manager "${managerName}" (code=${managerCode}) has no matching user account — falling back to admin assignment`);
      return null;
    }

    const managerDisplayName = managerUser.displayName
      || [managerUser.firstName, managerUser.lastName].filter(Boolean).join(" ")
      || managerUser.username;

    return { userId: String(managerUser.id), userName: managerDisplayName };
  } catch (err) {
    console.warn("[workflow] Error resolving direct manager:", err);
    return null;
  }
}

const defaultRouter: WorkflowRouter = {
  async getLineManager(req: Requisition): Promise<ApproverAssignment> {
    const manager = await resolveDirectManager(req);
    if (manager) return manager;
    const admins = await getAdminUsers();
    if (admins.length > 0) return { userId: admins[0].id, userName: admins[0].name };
    return { userId: null, userName: "Line Manager (Unassigned)" };
  },
  async getPurchasingReviewer(_req: Requisition): Promise<ApproverAssignment> {
    return { userId: null, userName: "Procurement Department", groupCostCenter: "118001003" };
  },
  async getBudgetOwner(req: Requisition): Promise<ApproverAssignment> {
    if (req.budgetOwnerId) {
      const byCode = await storage.getManagedUserByEmployeeCode(req.budgetOwnerId);
      if (byCode) {
        const displayName = byCode.displayName
          || [byCode.firstName, byCode.lastName].filter(Boolean).join(" ")
          || byCode.username;
        return { userId: String(byCode.id), userName: displayName };
      }

      if (req.budgetOwnerName) {
        const allUsers = await storage.getAllManagedUsers();
        const byName = allUsers.find((u) => {
          const fullName = u.displayName
            || [u.firstName, u.lastName].filter(Boolean).join(" ")
            || u.username;
          return fullName.toLowerCase() === req.budgetOwnerName!.toLowerCase();
        });
        if (byName) {
          const displayName = byName.displayName
            || [byName.firstName, byName.lastName].filter(Boolean).join(" ")
            || byName.username;
          return { userId: String(byName.id), userName: displayName };
        }
      }
    }
    const admins = await getAdminUsers();
    if (admins.length > 0) return { userId: admins[0].id, userName: admins[0].name };
    return { userId: null, userName: "Budget Owner (Unassigned)" };
  },
  async getFinalApprovers(_req: Requisition, amount: number): Promise<ApproverAssignment[]> {
    const admins = await getAdminUsers();
    if (amount <= 50000_00) {
      if (admins.length > 0) return [{ userId: admins[0].id, userName: admins[0].name }];
      return [{ userId: null, userName: "Ibrahim (Unassigned)" }];
    } else if (amount <= 200000_00) {
      if (admins.length > 1) return [{ userId: admins[1].id, userName: admins[1].name }];
      if (admins.length > 0) return [{ userId: admins[0].id, userName: admins[0].name }];
      return [{ userId: null, userName: "Mattar (Unassigned)" }];
    }
    if (admins.length > 0) return admins.map(a => ({ userId: a.id, userName: a.name }));
    return [{ userId: null, userName: "All Final Approvers (Unassigned)" }];
  },
};

async function getAdminUsers() {
  const allUsers = await storage.getAllManagedUsers();
  return allUsers
    .filter(u => u.role === "admin" || u.role === "superadmin")
    .map(u => ({
      id: String(u.id),
      name: u.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username,
    }));
}

let router: WorkflowRouter = defaultRouter;

export function setWorkflowRouter(r: WorkflowRouter) {
  router = r;
}

function updateStatus(requisitionId: string, status: string) {
  return storage.updateRequisition(requisitionId, { status });
}

export async function initializeWorkflow(requisition: Requisition): Promise<ApprovalStep> {
  const assignment = await router.getLineManager(requisition);
  await updateStatus(requisition.id, "Pending Line Manager");
  return await storage.createApprovalStep({
    requisitionId: requisition.id,
    stage: "Pending Line Manager",
    assignedTo: assignment.userId,
    assignedToName: assignment.userName,
    decision: "pending",
    comments: null,
  });
}

export async function approveStep(
  stepId: string,
  comments: string | null,
): Promise<{ nextSteps: ApprovalStep[]; newStatus: WorkflowStage }> {
  const step = await storage.getApprovalStep(stepId);
  if (!step || step.decision !== "pending") {
    throw new Error("Approval step not found or already decided");
  }

  await storage.updateApprovalStep(stepId, {
    decision: "approved",
    comments,
    decidedAt: new Date(),
  });

  const requisition = await storage.getRequisition(step.requisitionId);
  if (!requisition) throw new Error("Requisition not found");

  const stage = step.stage as WorkflowStage;

  switch (stage) {
    case "Pending Line Manager": {
      const assignment = await router.getPurchasingReviewer(requisition);
      const newStatus: WorkflowStage = "Pending Purchasing Review";
      await updateStatus(requisition.id, newStatus);
      const nextStep = await storage.createApprovalStep({
        requisitionId: requisition.id,
        stage: newStatus,
        assignedTo: assignment.userId,
        assignedToName: assignment.userName,
        assignedToGroup: assignment.groupCostCenter || null,
        decision: "pending",
        comments: null,
      });
      return { nextSteps: [nextStep], newStatus };
    }

    case "Pending Purchasing Review": {
      const assignment = await router.getBudgetOwner(requisition);
      const newStatus: WorkflowStage = "Pending Budget Owner";
      await updateStatus(requisition.id, newStatus);
      const nextStep = await storage.createApprovalStep({
        requisitionId: requisition.id,
        stage: newStatus,
        assignedTo: assignment.userId,
        assignedToName: assignment.userName,
        decision: "pending",
        comments: null,
      });
      return { nextSteps: [nextStep], newStatus };
    }

    case "Pending Budget Owner": {
      const amount = requisition.estimatedCostAed;
      if (amount <= 5000_00) {
        const newStatus: WorkflowStage = "Ready for Purchase";
        await updateStatus(requisition.id, newStatus);
        return { nextSteps: [], newStatus };
      }
      const assignments = await router.getFinalApprovers(requisition, amount);
      const newStatus: WorkflowStage = "Pending Final Approval";
      await updateStatus(requisition.id, newStatus);
      const nextSteps: ApprovalStep[] = [];
      for (const assignment of assignments) {
        const ns = await storage.createApprovalStep({
          requisitionId: requisition.id,
          stage: newStatus,
          assignedTo: assignment.userId,
          assignedToName: assignment.userName,
          decision: "pending",
          comments: null,
        });
        nextSteps.push(ns);
      }
      return { nextSteps, newStatus };
    }

    case "Pending Final Approval": {
      const allSteps = await storage.getApprovalSteps(step.requisitionId);
      const pendingFinalSteps = allSteps.filter(
        s => s.stage === "Pending Final Approval" && s.decision === "pending"
      );
      if (pendingFinalSteps.length === 0) {
        const newStatus: WorkflowStage = "Ready for Purchase";
        await updateStatus(requisition.id, newStatus);
        return { nextSteps: [], newStatus };
      }
      return { nextSteps: [], newStatus: "Pending Final Approval" };
    }

    default:
      throw new Error(`Cannot approve at stage: ${stage}`);
  }
}

export async function rejectStep(
  stepId: string,
  comments: string | null,
): Promise<{ newStatus: WorkflowStage }> {
  const step = await storage.getApprovalStep(stepId);
  if (!step || step.decision !== "pending") {
    throw new Error("Approval step not found or already decided");
  }

  await storage.updateApprovalStep(stepId, {
    decision: "rejected",
    comments,
    decidedAt: new Date(),
  });

  const requisition = await storage.getRequisition(step.requisitionId);
  if (!requisition) throw new Error("Requisition not found");

  const newStatus: WorkflowStage = "Rejected";
  await updateStatus(requisition.id, newStatus);

  const allSteps = await storage.getApprovalSteps(step.requisitionId);
  const otherPending = allSteps.filter(
    s => s.id !== stepId && s.decision === "pending"
  );
  for (const ps of otherPending) {
    await storage.updateApprovalStep(ps.id, {
      decision: "rejected",
      comments: "Auto-rejected due to rejection at this stage",
      decidedAt: new Date(),
    });
  }

  const rejectionReason = comments ? `: ${comments}` : "";
  await storage.createRequisitionComment({
    requisitionId: step.requisitionId,
    authorId: "system",
    authorName: "Workflow System",
    body: `Requisition rejected by ${step.assignedToName} at stage "${step.stage}"${rejectionReason}. The requisition status has been set to Rejected.`,
  });

  return { newStatus };
}

export async function markPOCreated(requisitionId: string): Promise<void> {
  const requisition = await storage.getRequisition(requisitionId);
  if (!requisition) throw new Error("Requisition not found");
  if (requisition.status !== "Ready for Purchase") {
    throw new Error("Requisition must be in 'Ready for Purchase' status to create PO");
  }
  await updateStatus(requisitionId, "PO Created");
}
