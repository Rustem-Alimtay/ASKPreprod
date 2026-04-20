import {
  dataSources, type DataSource, type InsertDataSource,
  dsRecords, type DsRecord, type InsertDsRecord,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, asc } from "drizzle-orm";

// ── Data Sources ─────────────────────────────────────────────────────────────

export async function getAllDataSources(): Promise<DataSource[]> {
  return await db.select().from(dataSources).orderBy(dataSources.name);
}

export async function getDataSource(id: string): Promise<DataSource | undefined> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, id));
  return ds;
}

export async function getDataSourceBySlug(
  slug: string
): Promise<DataSource | undefined> {
  const [ds] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, slug));
  return ds;
}

export async function updateDataSource(
  id: string,
  data: Partial<InsertDataSource>
): Promise<DataSource | undefined> {
  const [updated] = await db
    .update(dataSources)
    .set(data as any)
    .where(eq(dataSources.id, id))
    .returning();
  return updated;
}

// ── Data Source Records ──────────────────────────────────────────────────────

export async function getDsRecords(
  dataSourceId: string,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
  }
): Promise<{ records: DsRecord[]; total: number }> {
  const limit = options?.limit || 25;
  const offset = options?.offset || 0;

  const conditions = [eq(dsRecords.dataSourceId, dataSourceId)];
  if (options?.search) {
    conditions.push(
      sql`${dsRecords.data}::text ILIKE ${"%" + options.search + "%"}`
    );
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dsRecords)
    .where(where);
  const total = Number(countResult?.count || 0);

  let orderClause;
  if (options?.sortBy && options.sortBy !== "createdAt") {
    const sanitizedKey = options.sortBy.replace(/[^a-zA-Z0-9_]/g, "");
    if (options.sortOrder === "asc") {
      orderClause = sql`${dsRecords.data}->>${sanitizedKey} ASC`;
    } else {
      orderClause = sql`${dsRecords.data}->>${sanitizedKey} DESC`;
    }
  } else {
    orderClause =
      options?.sortOrder === "asc"
        ? asc(dsRecords.createdAt)
        : desc(dsRecords.createdAt);
  }

  const records = await db
    .select()
    .from(dsRecords)
    .where(where)
    .orderBy(orderClause, asc(dsRecords.id))
    .limit(limit)
    .offset(offset);

  return { records, total };
}

export async function getDsRecord(id: string): Promise<DsRecord | undefined> {
  const [record] = await db.select().from(dsRecords).where(eq(dsRecords.id, id));
  return record;
}

export async function getDsRecordByField(
  dataSourceId: string,
  fieldKey: string,
  fieldValue: string,
  caseInsensitive?: boolean
): Promise<DsRecord | undefined> {
  const sanitizedKey = fieldKey.replace(/[^a-zA-Z0-9_]/g, "");
  const fieldExpr = sql`${dsRecords.data}->>${sql.raw(`'${sanitizedKey}'`)}`;
  const matchCondition = caseInsensitive
    ? sql`LOWER(${fieldExpr}) = LOWER(${fieldValue})`
    : sql`${fieldExpr} = ${fieldValue}`;
  const [record] = await db
    .select()
    .from(dsRecords)
    .where(and(eq(dsRecords.dataSourceId, dataSourceId), matchCondition))
    .limit(1);
  return record;
}

export async function getDsRecordsByField(
  dataSourceId: string,
  fieldKey: string,
  fieldValue: string,
  caseInsensitive?: boolean
): Promise<DsRecord[]> {
  const sanitizedKey = fieldKey.replace(/[^a-zA-Z0-9_]/g, "");
  const fieldExpr = sql`${dsRecords.data}->>${sql.raw(`'${sanitizedKey}'`)}`;
  const matchCondition = caseInsensitive
    ? sql`LOWER(${fieldExpr}) = LOWER(${fieldValue})`
    : sql`${fieldExpr} = ${fieldValue}`;
  return await db
    .select()
    .from(dsRecords)
    .where(and(eq(dsRecords.dataSourceId, dataSourceId), matchCondition));
}

export async function createDsRecord(record: InsertDsRecord): Promise<DsRecord> {
  const [created] = await db.insert(dsRecords).values(record).returning();
  return created;
}

export async function createDsRecordsBulk(
  records: InsertDsRecord[]
): Promise<DsRecord[]> {
  if (records.length === 0) return [];
  return await db.insert(dsRecords).values(records).returning();
}

export async function updateDsRecord(
  id: string,
  data: Record<string, any>
): Promise<DsRecord | undefined> {
  const existing = await getDsRecord(id);
  if (!existing) return undefined;
  const merged = { ...(existing.data as Record<string, any>), ...data };
  const [updated] = await db
    .update(dsRecords)
    .set({ data: merged })
    .where(eq(dsRecords.id, id))
    .returning();
  return updated;
}

export async function deleteDsRecord(id: string): Promise<boolean> {
  const result = await db.delete(dsRecords).where(eq(dsRecords.id, id)).returning();
  return result.length > 0;
}

export async function deleteDsRecordsBySource(
  dataSourceId: string
): Promise<number> {
  const result = await db
    .delete(dsRecords)
    .where(eq(dsRecords.dataSourceId, dataSourceId))
    .returning();
  return result.length;
}
