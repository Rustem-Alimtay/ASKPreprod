import {
  requisitions, type Requisition, type InsertRequisition,
  requisitionAttachments, type RequisitionAttachment, type InsertRequisitionAttachment,
  requisitionComments, type RequisitionComment, type InsertRequisitionComment,
  requisitionApprovalSteps, type ApprovalStep, type InsertApprovalStep,
  requisitionQuotations, type RequisitionQuotation, type InsertRequisitionQuotation,
  departments,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, ilike, or, asc, inArray, isNull } from "drizzle-orm";
import { getManagedUser } from "./user";
import { getDataSourceBySlug, getDsRecordByField } from "./dataSource";

// ── Requisitions ──────────────────────────────────────────────────────────────

export async function getAllRequisitions(options?: {
  search?: string;
  status?: string;
  userId?: string;
  approverRequisitionIds?: string[];
}): Promise<Requisition[]> {
  const filterConditions = [];
  if (options?.status) filterConditions.push(eq(requisitions.status, options.status));
  if (options?.search) {
    const term = `%${options.search}%`;
    filterConditions.push(
      or(
        ilike(requisitions.requestTitle, term),
        ilike(requisitions.department, term),
        ilike(requisitions.requestedBy, term),
      )!,
    );
  }

  let ownershipCondition: ReturnType<typeof or> | undefined;
  if (options?.userId && options?.approverRequisitionIds && options.approverRequisitionIds.length > 0) {
    ownershipCondition = or(
      eq(requisitions.userId, options.userId),
      inArray(requisitions.id, options.approverRequisitionIds),
    );
  } else if (options?.userId) {
    ownershipCondition = or(eq(requisitions.userId, options.userId));
  }

  const allConditions = ownershipCondition
    ? [ownershipCondition, ...filterConditions]
    : filterConditions;

  if (allConditions.length > 0) {
    return await db
      .select()
      .from(requisitions)
      .where(and(...allConditions))
      .orderBy(desc(requisitions.createdAt));
  }
  return await db
    .select()
    .from(requisitions)
    .orderBy(desc(requisitions.createdAt));
}

export async function getRequisition(id: string): Promise<Requisition | undefined> {
  const [r] = await db.select().from(requisitions).where(eq(requisitions.id, id));
  return r;
}

export async function createRequisition(
  r: InsertRequisition & { userId?: string },
): Promise<Requisition> {
  const [created] = await db.insert(requisitions).values(r).returning();
  return created;
}

export async function updateRequisition(
  id: string,
  d: Partial<InsertRequisition> & { status?: string },
): Promise<Requisition | undefined> {
  const [updated] = await db
    .update(requisitions)
    .set({ ...d, updatedAt: new Date() })
    .where(eq(requisitions.id, id))
    .returning();
  return updated;
}

export async function deleteRequisition(id: string): Promise<boolean> {
  const r = await db.delete(requisitions).where(eq(requisitions.id, id)).returning();
  return r.length > 0;
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function getRequisitionAttachments(requisitionId: string): Promise<RequisitionAttachment[]> {
  return await db.select().from(requisitionAttachments).where(eq(requisitionAttachments.requisitionId, requisitionId));
}

export async function getRequisitionAttachmentById(id: string): Promise<RequisitionAttachment | undefined> {
  const rows = await db.select().from(requisitionAttachments).where(eq(requisitionAttachments.id, id));
  return rows[0];
}

export async function createRequisitionAttachment(a: InsertRequisitionAttachment): Promise<RequisitionAttachment> {
  const [created] = await db.insert(requisitionAttachments).values(a).returning();
  return created;
}

export async function deleteRequisitionAttachment(id: string): Promise<boolean> {
  const r = await db.delete(requisitionAttachments).where(eq(requisitionAttachments.id, id)).returning();
  return r.length > 0;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getRequisitionComments(requisitionId: string): Promise<RequisitionComment[]> {
  return await db
    .select()
    .from(requisitionComments)
    .where(eq(requisitionComments.requisitionId, requisitionId))
    .orderBy(requisitionComments.createdAt);
}

export async function createRequisitionComment(c: InsertRequisitionComment): Promise<RequisitionComment> {
  const [created] = await db.insert(requisitionComments).values(c).returning();
  return created;
}

// ── Approval Steps ────────────────────────────────────────────────────────────

export async function getApprovalSteps(requisitionId: string): Promise<ApprovalStep[]> {
  return await db
    .select()
    .from(requisitionApprovalSteps)
    .where(eq(requisitionApprovalSteps.requisitionId, requisitionId))
    .orderBy(asc(requisitionApprovalSteps.createdAt));
}

export async function getApprovalStep(id: string): Promise<ApprovalStep | undefined> {
  const [step] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(eq(requisitionApprovalSteps.id, id));
  return step;
}

export async function resolveCostCenter(rawCostCenter: string): Promise<string> {
  if (/^\d+$/.test(rawCostCenter)) return rawCostCenter;
  try {
    const [exactDept] = await db
      .select()
      .from(departments)
      .where(ilike(departments.name, rawCostCenter))
      .limit(1);
    if (exactDept) return exactDept.externalId;
    const [partialDept] = await db
      .select()
      .from(departments)
      .where(ilike(departments.name, `%${rawCostCenter}%`))
      .limit(1);
    if (partialDept) return partialDept.externalId;
  } catch (err) {
    console.warn("[storage] Error resolving cost center:", err);
  }
  return rawCostCenter;
}

export async function getPendingApprovalSteps(userId: string): Promise<ApprovalStep[]> {
  const directSteps = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.assignedTo, userId),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .orderBy(desc(requisitionApprovalSteps.createdAt));

  let groupSteps: ApprovalStep[] = [];
  try {
    const user = await getManagedUser(userId);
    if (user) {
      const empDs = await getDataSourceBySlug("employee-directory");
      if (empDs) {
        const email = user.email?.trim().toLowerCase();
        const empRecord = user.employeeCode
          ? await getDsRecordByField(empDs.id, "employee_code", user.employeeCode)
          : null;
        const record =
          empRecord ||
          (email ? await getDsRecordByField(empDs.id, "email", email, true) : null);
        if (record) {
          const rawCostCenter = String((record.data as any).cost_center || "").trim();
          if (rawCostCenter) {
            const costCenter = await resolveCostCenter(rawCostCenter);
            groupSteps = await db
              .select()
              .from(requisitionApprovalSteps)
              .where(
                and(
                  eq(requisitionApprovalSteps.assignedToGroup, costCenter),
                  eq(requisitionApprovalSteps.decision, "pending"),
                ),
              )
              .orderBy(desc(requisitionApprovalSteps.createdAt));
          }
        }
      }
    }
  } catch (err) {
    console.warn("[storage] Error fetching group approval steps:", err);
  }

  const seenIds = new Set<string>();
  const combined: ApprovalStep[] = [];
  for (const step of [...directSteps, ...groupSteps]) {
    if (!seenIds.has(step.id)) {
      seenIds.add(step.id);
      combined.push(step);
    }
  }
  return combined;
}

export async function createApprovalStep(step: InsertApprovalStep): Promise<ApprovalStep> {
  const [created] = await db.insert(requisitionApprovalSteps).values(step).returning();
  return created;
}

export async function updateApprovalStep(
  id: string,
  data: Partial<ApprovalStep>,
): Promise<ApprovalStep | undefined> {
  const [updated] = await db
    .update(requisitionApprovalSteps)
    .set(data)
    .where(eq(requisitionApprovalSteps.id, id))
    .returning();
  return updated;
}

export async function getCurrentApprovalStep(requisitionId: string): Promise<ApprovalStep | undefined> {
  const [step] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .orderBy(desc(requisitionApprovalSteps.createdAt))
    .limit(1);
  return step;
}

export async function getUserPendingStepForRequisition(
  requisitionId: string,
  userId: string,
): Promise<ApprovalStep | undefined> {
  const [step] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedTo, userId),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .limit(1);
  return step;
}

export async function findAndRelinkOrphanedStep(
  requisitionId: string,
  userId: string,
  userName: string,
): Promise<ApprovalStep | undefined> {
  const trimmedName = userName.trim();
  const [candidate] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.decision, "pending"),
        isNull(requisitionApprovalSteps.assignedTo),
        ilike(requisitionApprovalSteps.assignedToName, trimmedName),
      ),
    )
    .orderBy(asc(requisitionApprovalSteps.createdAt))
    .limit(1);
  if (!candidate) return undefined;
  const [updated] = await db
    .update(requisitionApprovalSteps)
    .set({ assignedTo: userId })
    .where(
      and(
        eq(requisitionApprovalSteps.id, candidate.id),
        isNull(requisitionApprovalSteps.assignedTo),
      ),
    )
    .returning();
  if (updated) {
    console.log(
      `[approval-relink] Re-linked orphaned step ${updated.id} (assignedToName="${updated.assignedToName}") to user ${userId}`,
    );
    return updated;
  }
  return undefined;
}

async function hasPendingGroupStepForUserInternal(
  requisitionId: string,
  userId: string,
): Promise<boolean> {
  const user = await getManagedUser(userId);
  if (!user) return false;
  const empDs = await getDataSourceBySlug("employee-directory");
  if (!empDs) return false;
  const email = user.email?.trim().toLowerCase();
  let record = null;
  if (user.employeeCode) {
    record = await getDsRecordByField(empDs.id, "employee_code", user.employeeCode);
  }
  if (!record && email) {
    record = await getDsRecordByField(empDs.id, "email", email, true);
  }
  if (!record) return false;
  const rawCostCenter = String((record.data as any).cost_center || "").trim();
  if (!rawCostCenter) return false;
  const costCenter = await resolveCostCenter(rawCostCenter);
  const [step] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedToGroup, costCenter),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .limit(1);
  return !!step;
}

export async function hasPendingStepForUser(
  requisitionId: string,
  userId: string,
): Promise<boolean> {
  const step = await getUserPendingStepForRequisition(requisitionId, userId);
  if (step) return true;
  const groupStep = await hasPendingGroupStepForUserInternal(requisitionId, userId);
  if (groupStep) return true;
  const user = await getManagedUser(userId);
  if (user) {
    const displayName =
      user.displayName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username;
    const relinked = await findAndRelinkOrphanedStep(requisitionId, userId, displayName);
    if (relinked) return true;
  }
  return false;
}

export async function hasAnyStepForUser(requisitionId: string, userId: string): Promise<boolean> {
  const steps = await db
    .select({ id: requisitionApprovalSteps.id })
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedTo, userId),
      ),
    )
    .limit(1);
  return steps.length > 0;
}

export async function getPendingApprovalStepsByGroup(
  groupCostCenter: string,
  _userId: string,
): Promise<ApprovalStep[]> {
  return await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.assignedToGroup, groupCostCenter),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .orderBy(desc(requisitionApprovalSteps.createdAt));
}

export async function hasPendingGroupStepForUser(
  requisitionId: string,
  groupCostCenter: string,
): Promise<boolean> {
  const [step] = await db
    .select()
    .from(requisitionApprovalSteps)
    .where(
      and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedToGroup, groupCostCenter),
        eq(requisitionApprovalSteps.decision, "pending"),
      ),
    )
    .limit(1);
  return !!step;
}

// ── Quotations ────────────────────────────────────────────────────────────────

export async function createQuotation(q: InsertRequisitionQuotation): Promise<RequisitionQuotation> {
  const [created] = await db.insert(requisitionQuotations).values(q).returning();
  return created;
}

export async function getQuotationsByRequisition(requisitionId: string): Promise<RequisitionQuotation[]> {
  return await db
    .select()
    .from(requisitionQuotations)
    .where(eq(requisitionQuotations.requisitionId, requisitionId))
    .orderBy(desc(requisitionQuotations.createdAt));
}

export async function getQuotation(id: string): Promise<RequisitionQuotation | undefined> {
  const [q] = await db.select().from(requisitionQuotations).where(eq(requisitionQuotations.id, id));
  return q;
}

export async function updateQuotation(
  id: string,
  data: Partial<RequisitionQuotation>,
): Promise<RequisitionQuotation | undefined> {
  const [updated] = await db
    .update(requisitionQuotations)
    .set(data)
    .where(eq(requisitionQuotations.id, id))
    .returning();
  return updated;
}

export async function deleteQuotation(id: string): Promise<boolean> {
  const [deleted] = await db.delete(requisitionQuotations).where(eq(requisitionQuotations.id, id)).returning();
  return !!deleted;
}

export async function clearRecommendedQuotations(requisitionId: string): Promise<void> {
  await db
    .update(requisitionQuotations)
    .set({ isRecommended: false })
    .where(eq(requisitionQuotations.requisitionId, requisitionId));
}
