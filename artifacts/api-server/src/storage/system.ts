import {
  systemSettings, type SystemSetting, type InsertSystemSetting,
  externalServices, type ExternalService, type InsertExternalService,
  userServices,
  auditLogs, type AuditLog, type InsertAuditLog,
  iconLibrary, type IconLibraryEntry, type InsertIconLibrary,
  departments, type Department, type InsertDepartment,
  sectionTemplates, type SectionTemplate, type InsertSectionTemplate,
  pageSections, type PageSection, type InsertPageSection, type PageSectionWithTemplate,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, ilike, or, asc } from "drizzle-orm";

// ── System Settings ──────────────────────────────────────────────────────────

export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  return await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
}

export async function getSystemSetting(key: string): Promise<SystemSetting | undefined> {
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return setting;
}

export async function getSystemSettingsByCategory(category: string): Promise<SystemSetting[]> {
  return await db.select().from(systemSettings).where(eq(systemSettings.category, category));
}

export async function upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
  const existing = await getSystemSetting(setting.key);
  if (existing) {
    const [updated] = await db
      .update(systemSettings)
      .set({ ...setting, updatedAt: new Date() })
      .where(eq(systemSettings.key, setting.key))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(systemSettings).values(setting).returning();
    return created;
  }
}

export async function deleteSystemSetting(key: string): Promise<boolean> {
  const result = await db.delete(systemSettings).where(eq(systemSettings.key, key)).returning();
  return result.length > 0;
}

// ── External Services ────────────────────────────────────────────────────────

export async function getExternalServices(): Promise<ExternalService[]> {
  return await db.select().from(externalServices).orderBy(asc(externalServices.sortOrder));
}

export async function getEnabledExternalServices(): Promise<ExternalService[]> {
  return await db
    .select()
    .from(externalServices)
    .where(eq(externalServices.isEnabled, true))
    .orderBy(asc(externalServices.sortOrder));
}

export async function getExternalService(id: string): Promise<ExternalService | undefined> {
  const [service] = await db.select().from(externalServices).where(eq(externalServices.id, id));
  return service;
}

export async function createExternalService(service: InsertExternalService): Promise<ExternalService> {
  const [created] = await db.insert(externalServices).values(service).returning();
  return created;
}

export async function updateExternalService(
  id: string,
  data: Partial<InsertExternalService>
): Promise<ExternalService | undefined> {
  const [updated] = await db
    .update(externalServices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(externalServices.id, id))
    .returning();
  return updated;
}

export async function deleteExternalService(id: string): Promise<boolean> {
  const result = await db.delete(externalServices).where(eq(externalServices.id, id)).returning();
  return result.length > 0;
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export async function createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
  const [created] = await db.insert(auditLogs).values(log).returning();
  return created;
}

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  category?: string;
  action?: string;
  search?: string;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let query = db.select().from(auditLogs);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(auditLogs);

  const conditions = [];
  if (options?.category) conditions.push(eq(auditLogs.category, options.category));
  if (options?.action) conditions.push(eq(auditLogs.action, options.action));
  if (options?.search) {
    conditions.push(
      or(
        ilike(auditLogs.action, `%${options.search}%`),
        ilike(auditLogs.userEmail || "", `%${options.search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    query = query.where(whereClause!) as typeof query;
    countQuery = countQuery.where(whereClause!) as typeof countQuery;
  }

  const logs = await query.orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
  const [{ count: total }] = await countQuery;

  return { logs, total: Number(total) };
}

// ── Departments ──────────────────────────────────────────────────────────────

export async function getAllDepartments(): Promise<Department[]> {
  return await db.select().from(departments).orderBy(departments.internalId);
}

export async function getActiveDepartments(): Promise<Department[]> {
  return await db
    .select()
    .from(departments)
    .where(eq(departments.inactive, false))
    .orderBy(departments.name);
}

export async function getDepartment(internalId: number): Promise<Department | undefined> {
  const [dept] = await db
    .select()
    .from(departments)
    .where(eq(departments.internalId, internalId));
  return dept;
}

export async function upsertDepartments(
  rows: InsertDepartment[]
): Promise<{ imported: number; updated: number }> {
  let imported = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const [ex] = await tx
        .select({ internalId: departments.internalId })
        .from(departments)
        .where(eq(departments.internalId, row.internalId));
      if (ex) {
        await tx
          .update(departments)
          .set({ externalId: row.externalId, name: row.name, inactive: row.inactive ?? false })
          .where(eq(departments.internalId, row.internalId));
        updated++;
      } else {
        await tx.insert(departments).values(row);
        imported++;
      }
    }
  });

  return { imported, updated };
}

// ── Icon Library ─────────────────────────────────────────────────────────────

export async function getAllIcons(): Promise<IconLibraryEntry[]> {
  return await db
    .select()
    .from(iconLibrary)
    .orderBy(iconLibrary.category, iconLibrary.label);
}

export async function getIcon(id: string): Promise<IconLibraryEntry | undefined> {
  const [icon] = await db.select().from(iconLibrary).where(eq(iconLibrary.id, id));
  return icon;
}

export async function getIconByName(name: string): Promise<IconLibraryEntry | undefined> {
  const [icon] = await db.select().from(iconLibrary).where(eq(iconLibrary.name, name));
  return icon;
}

export async function createIcon(icon: InsertIconLibrary): Promise<IconLibraryEntry> {
  const [created] = await db.insert(iconLibrary).values(icon).returning();
  return created;
}

export async function deleteIcon(id: string): Promise<boolean> {
  const result = await db.delete(iconLibrary).where(eq(iconLibrary.id, id)).returning();
  return result.length > 0;
}

// ── Section Templates ────────────────────────────────────────────────────────

export async function getAllSectionTemplates(): Promise<SectionTemplate[]> {
  return await db.select().from(sectionTemplates).orderBy(asc(sectionTemplates.name));
}

export async function getSectionTemplate(id: string): Promise<SectionTemplate | undefined> {
  const [tpl] = await db.select().from(sectionTemplates).where(eq(sectionTemplates.id, id));
  return tpl;
}

export async function getSectionTemplateByType(sectionType: string): Promise<SectionTemplate | undefined> {
  const [tpl] = await db.select().from(sectionTemplates).where(eq(sectionTemplates.sectionType, sectionType));
  return tpl;
}

export async function createSectionTemplate(tpl: InsertSectionTemplate): Promise<SectionTemplate> {
  const [created] = await db.insert(sectionTemplates).values(tpl).returning();
  return created;
}

export async function updateSectionTemplate(
  id: string,
  data: Partial<InsertSectionTemplate>
): Promise<SectionTemplate | undefined> {
  const [updated] = await db
    .update(sectionTemplates)
    .set(data)
    .where(eq(sectionTemplates.id, id))
    .returning();
  return updated;
}

export async function deleteSectionTemplate(id: string): Promise<boolean> {
  const result = await db.delete(sectionTemplates).where(eq(sectionTemplates.id, id)).returning();
  return result.length > 0;
}

// ── Page Sections ────────────────────────────────────────────────────────────

export async function getPageSectionsByService(serviceId: string): Promise<PageSectionWithTemplate[]> {
  const rows = await db
    .select({ section: pageSections, template: sectionTemplates })
    .from(pageSections)
    .leftJoin(sectionTemplates, eq(pageSections.sectionTemplateId, sectionTemplates.id))
    .where(eq(pageSections.serviceId, serviceId))
    .orderBy(asc(pageSections.sortOrder));

  return rows.map((row) => ({ ...row.section, template: row.template || null }));
}

export async function getPageSection(id: string): Promise<PageSection | undefined> {
  const [section] = await db.select().from(pageSections).where(eq(pageSections.id, id));
  return section;
}

export async function createPageSection(section: InsertPageSection): Promise<PageSection> {
  const [created] = await db.insert(pageSections).values(section).returning();
  return created;
}

export async function updatePageSection(
  id: string,
  data: Partial<InsertPageSection>
): Promise<PageSection | undefined> {
  const [updated] = await db
    .update(pageSections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pageSections.id, id))
    .returning();
  return updated;
}

export async function deletePageSection(id: string): Promise<boolean> {
  const result = await db.delete(pageSections).where(eq(pageSections.id, id)).returning();
  return result.length > 0;
}

export async function reorderPageSections(serviceId: string, sectionIds: string[]): Promise<boolean> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < sectionIds.length; i++) {
      await tx
        .update(pageSections)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(pageSections.id, sectionIds[i]), eq(pageSections.serviceId, serviceId)));
    }
  });
  return true;
}

// ── User Services (access control) ──────────────────────────────────────────

export async function getUserServices(userId: string): Promise<string[]> {
  const services = await db
    .select({ serviceId: userServices.serviceId })
    .from(userServices)
    .where(eq(userServices.userId, userId));
  return services.map((s) => s.serviceId);
}

export async function setUserServices(userId: string, serviceIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userServices).where(eq(userServices.userId, userId));
    if (serviceIds.length > 0) {
      await tx.insert(userServices).values(serviceIds.map((serviceId) => ({ userId, serviceId })));
    }
  });
}
