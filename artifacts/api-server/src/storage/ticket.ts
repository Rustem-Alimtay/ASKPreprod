import {
  tickets, type Ticket, type InsertTicket,
  ticketComments, type TicketComment, type InsertTicketComment,
  ticketAttachments, type TicketAttachment, type InsertTicketAttachment,
  faqEntries, type FaqEntry, type InsertFaqEntry,
  userManuals, type UserManual, type InsertUserManual,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, asc } from "drizzle-orm";

// ── Tickets ──────────────────────────────────────────────────────────────────

export async function initTicketSequence(): Promise<void> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS ticket_tracking_seq`);
  const [maxRow] = await db
    .select({
      maxNum: sql<number>`COALESCE(MAX(
        CASE WHEN tracking_id ~ '^DT[0-9]+$'
          THEN CAST(SUBSTRING(tracking_id FROM 3) AS INTEGER)
          ELSE 0
        END
      ), 0)`,
    })
    .from(tickets);
  const maxNum = Number(maxRow.maxNum) || 0;
  if (maxNum > 0) {
    await db.execute(sql`SELECT setval('ticket_tracking_seq', ${maxNum})`);
  }
}

export async function createTicket(ticketData: InsertTicket): Promise<Ticket> {
  const [{ next_num }] = await db
    .select({ next_num: sql<string>`nextval('ticket_tracking_seq')` })
    .from(sql`(SELECT 1) AS _dummy`);
  const trackingId = `DT${next_num}`;
  const [ticket] = await db
    .insert(tickets)
    .values({ ...ticketData, trackingId })
    .returning();
  return ticket;
}

export async function getTicket(id: string): Promise<Ticket | undefined> {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
  return ticket;
}

export async function getTicketByTrackingId(
  trackingId: string
): Promise<Ticket | undefined> {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.trackingId, trackingId));
  return ticket;
}

export async function getTicketsByUser(userId: string): Promise<Ticket[]> {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.userId, userId))
    .orderBy(desc(tickets.createdAt));
}

export async function getAllTickets(options?: {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
  userId?: string;
}): Promise<{ tickets: Ticket[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const conditions = [];
  if (options?.userId) conditions.push(eq(tickets.userId, options.userId));
  if (options?.status) conditions.push(eq(tickets.status, options.status));
  if (options?.category) conditions.push(eq(tickets.category, options.category));

  let query = db.select().from(tickets);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(tickets);

  if (conditions.length > 0) {
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);
    query = query.where(where!) as typeof query;
    countQuery = countQuery.where(where!) as typeof countQuery;
  }

  const ticketList = await query
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ count: total }] = await countQuery;

  return { tickets: ticketList, total: Number(total) };
}

export async function updateTicket(
  id: string,
  data: Partial<Ticket>
): Promise<Ticket | undefined> {
  const [ticket] = await db
    .update(tickets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();
  return ticket;
}

export async function deleteTicket(id: string): Promise<boolean> {
  const result = await db.delete(tickets).where(eq(tickets.id, id)).returning();
  return result.length > 0;
}

// ── Ticket Comments ──────────────────────────────────────────────────────────

export async function createTicketComment(
  comment: InsertTicketComment
): Promise<TicketComment> {
  const [created] = await db.insert(ticketComments).values(comment).returning();
  return created;
}

export async function getTicketComments(ticketId: string): Promise<TicketComment[]> {
  return await db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt));
}

// ── Ticket Attachments ───────────────────────────────────────────────────────

export async function getTicketAttachments(
  ticketId: string
): Promise<TicketAttachment[]> {
  return await db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.ticketId, ticketId))
    .orderBy(asc(ticketAttachments.uploadedAt));
}

export async function getTicketAttachmentById(
  id: string
): Promise<TicketAttachment | undefined> {
  const [att] = await db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.id, id));
  return att;
}

export async function createTicketAttachment(
  a: InsertTicketAttachment
): Promise<TicketAttachment> {
  const [created] = await db.insert(ticketAttachments).values(a).returning();
  return created;
}

export async function deleteTicketAttachment(id: string): Promise<boolean> {
  const r = await db
    .delete(ticketAttachments)
    .where(eq(ticketAttachments.id, id))
    .returning();
  return r.length > 0;
}

// ── FAQ Entries ──────────────────────────────────────────────────────────────

export async function getAllFaqEntries(): Promise<FaqEntry[]> {
  return await db
    .select()
    .from(faqEntries)
    .where(eq(faqEntries.isPublished, true))
    .orderBy(faqEntries.category, faqEntries.order);
}

export async function getFaqEntriesByCategory(
  category: string
): Promise<FaqEntry[]> {
  return await db
    .select()
    .from(faqEntries)
    .where(and(eq(faqEntries.category, category), eq(faqEntries.isPublished, true)))
    .orderBy(faqEntries.order);
}

export async function createFaqEntry(entry: InsertFaqEntry): Promise<FaqEntry> {
  const [created] = await db.insert(faqEntries).values(entry).returning();
  return created;
}

export async function updateFaqEntry(
  id: string,
  data: Partial<InsertFaqEntry>
): Promise<FaqEntry | undefined> {
  const [updated] = await db
    .update(faqEntries)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(faqEntries.id, id))
    .returning();
  return updated;
}

export async function deleteFaqEntry(id: string): Promise<boolean> {
  const result = await db.delete(faqEntries).where(eq(faqEntries.id, id)).returning();
  return result.length > 0;
}

// ── User Manuals ─────────────────────────────────────────────────────────────

export async function getAllUserManuals(): Promise<UserManual[]> {
  return await db
    .select()
    .from(userManuals)
    .where(eq(userManuals.isPublished, true))
    .orderBy(userManuals.category, userManuals.order);
}

export async function getUserManualsByCategory(
  category: string
): Promise<UserManual[]> {
  return await db
    .select()
    .from(userManuals)
    .where(
      and(eq(userManuals.category, category), eq(userManuals.isPublished, true))
    )
    .orderBy(userManuals.order);
}

export async function getUserManual(id: string): Promise<UserManual | undefined> {
  const [manual] = await db.select().from(userManuals).where(eq(userManuals.id, id));
  return manual;
}

export async function createUserManual(manual: InsertUserManual): Promise<UserManual> {
  const [created] = await db.insert(userManuals).values(manual).returning();
  return created;
}

export async function updateUserManual(
  id: string,
  data: Partial<InsertUserManual>
): Promise<UserManual | undefined> {
  const [updated] = await db
    .update(userManuals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userManuals.id, id))
    .returning();
  return updated;
}

export async function deleteUserManual(id: string): Promise<boolean> {
  const result = await db
    .delete(userManuals)
    .where(eq(userManuals.id, id))
    .returning();
  return result.length > 0;
}
