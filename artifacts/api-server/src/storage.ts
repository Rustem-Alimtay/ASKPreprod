import { 
  managedUsers, type ManagedUser, type InsertManagedUser,
  systemSettings, type SystemSetting, type InsertSystemSetting,
  externalServices, type ExternalService, type InsertExternalService,
  userServices,
  auditLogs, type AuditLog, type InsertAuditLog,
  tickets, type Ticket, type InsertTicket,
  ticketComments, type TicketComment, type InsertTicketComment,
  ticketAttachments, type TicketAttachment, type InsertTicketAttachment,
  faqEntries, type FaqEntry, type InsertFaqEntry,
  userManuals, type UserManual, type InsertUserManual,
  customers, type Customer, type InsertCustomer,
  customerProfiles, type CustomerProfile, type InsertCustomerProfile,
  type CustomerWithProfile,
  dataSources, type DataSource, type InsertDataSource,
  dsRecords, type DsRecord, type InsertDsRecord,
  collaborationBlueprints, type CollaborationBlueprint, type InsertBlueprint,
  sprints, type Sprint, type InsertSprint,
  spaces, type Space, type InsertSpace,
  spaceMembers, type SpaceMember,
  projectGroups, type ProjectGroup, type InsertProjectGroup, type SpaceWithHierarchy,
  projects, type Project, type InsertProject, type ProjectWithAssignments,
  projectAssignments, type ProjectAssignment, type InsertProjectAssignment,
  projectComments, type ProjectComment, type InsertProjectComment,
  projectTagsTable, type ProjectTagRecord, type InsertProjectTag,
  sectionTemplates, type SectionTemplate, type InsertSectionTemplate,
  pageSections, type PageSection, type InsertPageSection, type PageSectionWithTemplate,
  iconLibrary, type IconLibraryEntry, type InsertIconLibrary,
  requisitions, type Requisition, type InsertRequisition,
  requisitionAttachments, type RequisitionAttachment, type InsertRequisitionAttachment,
  requisitionComments, type RequisitionComment, type InsertRequisitionComment,
  requisitionApprovalSteps, type ApprovalStep, type InsertApprovalStep,
  requisitionQuotations, type RequisitionQuotation, type InsertRequisitionQuotation,
  passwordResetTokens, type PasswordResetToken,
  ssoTokens, type SsoToken,
  ssoAuditLogs, type SsoAuditLog, type InsertSsoAuditLog,
  departments, type Department, type InsertDepartment,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, ilike, or, asc, inArray, isNull } from "drizzle-orm";

export interface IStorage {
  // Managed users CRUD
  getAllManagedUsers(): Promise<ManagedUser[]>;
  getManagedUser(id: string): Promise<ManagedUser | undefined>;
  getManagedUserByEmail(email: string): Promise<ManagedUser | undefined>;
  getManagedUserByUsername(username: string): Promise<ManagedUser | undefined>;
  getManagedUserByEmployeeCode(employeeCode: string): Promise<ManagedUser | undefined>;
  createManagedUser(user: InsertManagedUser): Promise<ManagedUser>;
  updateManagedUser(id: string, data: Partial<InsertManagedUser>): Promise<ManagedUser | undefined>;
  deleteManagedUser(id: string): Promise<boolean>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  invalidateUserResetTokens(userId: string): Promise<void>;
  destroyUserSessions(userId: string): Promise<number>;

  // SSO tokens
  createSsoToken(token: string, userId: string, expiresAt: Date): Promise<SsoToken>;
  validateAndConsumeSsoToken(token: string): Promise<{ userId: string } | null>;
  invalidateUserSsoTokens(userId: string): Promise<number>;
  cleanupExpiredTokens(): Promise<number>;

  // SSO audit logs
  createSsoAuditLog(log: InsertSsoAuditLog): Promise<SsoAuditLog>;

  // Stats
  getUserStats(): Promise<{ totalUsers: number; activeUsers: number; totalEmployees: number; roleDistribution: { role: string; count: number }[] }>;
  
  // System settings CRUD
  getAllSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getSystemSettingsByCategory(category: string): Promise<SystemSetting[]>;
  upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  deleteSystemSetting(key: string): Promise<boolean>;
  
  // External services CRUD
  getExternalServices(): Promise<ExternalService[]>;
  getEnabledExternalServices(): Promise<ExternalService[]>;
  getExternalService(id: string): Promise<ExternalService | undefined>;
  createExternalService(service: InsertExternalService): Promise<ExternalService>;
  updateExternalService(id: string, data: Partial<InsertExternalService>): Promise<ExternalService | undefined>;
  deleteExternalService(id: string): Promise<boolean>;
  
  // Audit logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(options?: { 
    limit?: number; 
    offset?: number; 
    category?: string; 
    action?: string;
    search?: string;
  }): Promise<{ logs: AuditLog[]; total: number }>;
  
  // Tickets CRUD
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketByTrackingId(trackingId: string): Promise<Ticket | undefined>;
  getTicketsByUser(userId: string): Promise<Ticket[]>;
  getAllTickets(options?: { status?: string; category?: string; limit?: number; offset?: number; userId?: string }): Promise<{ tickets: Ticket[]; total: number }>;
  updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<boolean>;
  initTicketSequence(): Promise<void>;
  
  // Ticket comments
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;
  getTicketComments(ticketId: string): Promise<TicketComment[]>;

  // Ticket attachments
  getTicketAttachments(ticketId: string): Promise<TicketAttachment[]>;
  getTicketAttachmentById(id: string): Promise<TicketAttachment | undefined>;
  createTicketAttachment(a: InsertTicketAttachment): Promise<TicketAttachment>;
  deleteTicketAttachment(id: string): Promise<boolean>;
  
  // FAQ entries
  getAllFaqEntries(): Promise<FaqEntry[]>;
  getFaqEntriesByCategory(category: string): Promise<FaqEntry[]>;
  createFaqEntry(entry: InsertFaqEntry): Promise<FaqEntry>;
  updateFaqEntry(id: string, data: Partial<InsertFaqEntry>): Promise<FaqEntry | undefined>;
  deleteFaqEntry(id: string): Promise<boolean>;
  
  // User manuals
  getAllUserManuals(): Promise<UserManual[]>;
  getUserManualsByCategory(category: string): Promise<UserManual[]>;
  getUserManual(id: string): Promise<UserManual | undefined>;
  createUserManual(manual: InsertUserManual): Promise<UserManual>;
  updateUserManual(id: string, data: Partial<InsertUserManual>): Promise<UserManual | undefined>;
  deleteUserManual(id: string): Promise<boolean>;
  
  // Customers CRUD
  getAllCustomers(options?: { search?: string; type?: string; unit?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: string }): Promise<{ customers: Customer[]; total: number }>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByExternalCode(code: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  
  // Customer profiles CRUD
  getCustomerProfile(customerId: string): Promise<CustomerProfile | undefined>;
  upsertCustomerProfile(profile: InsertCustomerProfile): Promise<CustomerProfile>;
  deleteCustomerProfile(customerId: string): Promise<boolean>;
  
  // Combined customer with profile
  getCustomerWithProfile(id: string): Promise<CustomerWithProfile | undefined>;
  
  // Data Sources CRUD
  getAllDataSources(): Promise<DataSource[]>;
  getDataSource(id: string): Promise<DataSource | undefined>;
  getDataSourceBySlug(slug: string): Promise<DataSource | undefined>;
  updateDataSource(id: string, data: Partial<InsertDataSource>): Promise<DataSource | undefined>;

  // Data Source Records
  getDsRecords(dataSourceId: string, options?: { search?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: string }): Promise<{ records: DsRecord[]; total: number }>;
  getDsRecord(id: string): Promise<DsRecord | undefined>;
  getDsRecordByField(dataSourceId: string, fieldKey: string, fieldValue: string, caseInsensitive?: boolean): Promise<DsRecord | undefined>;
  createDsRecord(record: InsertDsRecord): Promise<DsRecord>;
  createDsRecordsBulk(records: InsertDsRecord[]): Promise<DsRecord[]>;
  updateDsRecord(id: string, data: Record<string, any>): Promise<DsRecord | undefined>;
  deleteDsRecord(id: string): Promise<boolean>;
  deleteDsRecordsBySource(dataSourceId: string): Promise<number>;

  // Collaboration blueprints CRUD
  getAllBlueprints(): Promise<CollaborationBlueprint[]>;
  getBlueprint(id: string): Promise<CollaborationBlueprint | undefined>;
  getBlueprintBySectionName(sectionName: string): Promise<CollaborationBlueprint | undefined>;
  createBlueprint(blueprint: InsertBlueprint): Promise<CollaborationBlueprint>;
  updateBlueprint(id: string, data: Partial<InsertBlueprint>): Promise<CollaborationBlueprint | undefined>;
  deleteBlueprint(id: string): Promise<boolean>;

  // Spaces CRUD
  getAllSpaces(): Promise<Space[]>;
  getSpace(id: string): Promise<Space | undefined>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, data: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;
  getSpacesWithHierarchy(viewType?: string, userId?: string): Promise<SpaceWithHierarchy[]>;

  // Space members
  getSpaceMembers(spaceId: string): Promise<(SpaceMember & { user: { id: string; username: string; firstName: string | null; lastName: string | null; email: string } })[]>;
  addSpaceMember(spaceId: string, userId: string): Promise<SpaceMember>;
  removeSpaceMember(spaceId: string, userId: string): Promise<boolean>;
  isSpaceMember(spaceId: string, userId: string): Promise<boolean>;

  // Project Groups CRUD
  getAllProjectGroups(spaceId?: string): Promise<ProjectGroup[]>;
  getProjectGroup(id: string): Promise<ProjectGroup | undefined>;
  createProjectGroup(group: InsertProjectGroup): Promise<ProjectGroup>;
  updateProjectGroup(id: string, data: Partial<InsertProjectGroup>): Promise<ProjectGroup | undefined>;
  deleteProjectGroup(id: string): Promise<boolean>;

  // Projects CRUD
  getAllProjects(options?: { userId?: string; status?: string }): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectWithAssignments(id: string): Promise<ProjectWithAssignments | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Project assignments
  getProjectAssignments(projectId: string): Promise<ProjectAssignment[]>;
  createProjectAssignment(assignment: InsertProjectAssignment): Promise<ProjectAssignment>;
  deleteProjectAssignment(id: string): Promise<boolean>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  
  // Project comments
  getProjectComments(projectId: string): Promise<ProjectComment[]>;
  createProjectComment(comment: InsertProjectComment): Promise<ProjectComment>;
  
  // Project tags
  getAllProjectTags(): Promise<ProjectTagRecord[]>;
  getProjectTag(id: string): Promise<ProjectTagRecord | undefined>;
  createProjectTag(tag: InsertProjectTag): Promise<ProjectTagRecord>;
  updateProjectTag(id: string, data: Partial<InsertProjectTag>): Promise<ProjectTagRecord | undefined>;
  deleteProjectTag(id: string): Promise<boolean>;
  
  // Sprints
  getAllSprints(): Promise<Sprint[]>;
  getSprint(id: string): Promise<Sprint | undefined>;
  getActiveSprint(): Promise<Sprint | undefined>;
  createSprint(sprint: InsertSprint): Promise<Sprint>;
  updateSprint(id: string, data: Partial<InsertSprint>): Promise<Sprint | undefined>;
  deleteSprint(id: string): Promise<boolean>;
  closeSprint(id: string): Promise<{ sprint: Sprint; archivedCount: number } | undefined>;
  
  // User services (access control)
  getUserServices(userId: string): Promise<string[]>;
  setUserServices(userId: string, serviceIds: string[]): Promise<void>;

  // Section templates CRUD
  getAllSectionTemplates(): Promise<SectionTemplate[]>;
  getSectionTemplate(id: string): Promise<SectionTemplate | undefined>;
  getSectionTemplateByType(sectionType: string): Promise<SectionTemplate | undefined>;
  createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate>;
  updateSectionTemplate(id: string, data: Partial<InsertSectionTemplate>): Promise<SectionTemplate | undefined>;
  deleteSectionTemplate(id: string): Promise<boolean>;

  // Page sections CRUD
  getPageSectionsByService(serviceId: string): Promise<PageSectionWithTemplate[]>;
  getPageSection(id: string): Promise<PageSection | undefined>;
  createPageSection(section: InsertPageSection): Promise<PageSection>;
  updatePageSection(id: string, data: Partial<InsertPageSection>): Promise<PageSection | undefined>;
  deletePageSection(id: string): Promise<boolean>;
  reorderPageSections(serviceId: string, sectionIds: string[]): Promise<boolean>;

  // Icon library CRUD
  getAllIcons(): Promise<IconLibraryEntry[]>;
  getIcon(id: string): Promise<IconLibraryEntry | undefined>;
  getIconByName(name: string): Promise<IconLibraryEntry | undefined>;
  createIcon(icon: InsertIconLibrary): Promise<IconLibraryEntry>;
  deleteIcon(id: string): Promise<boolean>;

  // Requisitions
  getAllRequisitions(options?: { search?: string; status?: string; userId?: string; approverRequisitionIds?: string[] }): Promise<Requisition[]>;
  getRequisition(id: string): Promise<Requisition | undefined>;
  createRequisition(r: InsertRequisition & { userId?: string }): Promise<Requisition>;
  updateRequisition(id: string, d: Partial<InsertRequisition>): Promise<Requisition | undefined>;
  deleteRequisition(id: string): Promise<boolean>;
  getRequisitionAttachments(requisitionId: string): Promise<RequisitionAttachment[]>;
  getRequisitionAttachmentById(id: string): Promise<RequisitionAttachment | undefined>;
  createRequisitionAttachment(a: InsertRequisitionAttachment): Promise<RequisitionAttachment>;
  deleteRequisitionAttachment(id: string): Promise<boolean>;
  getRequisitionComments(requisitionId: string): Promise<RequisitionComment[]>;
  createRequisitionComment(c: InsertRequisitionComment): Promise<RequisitionComment>;

  // Requisition Approval Steps
  getApprovalSteps(requisitionId: string): Promise<ApprovalStep[]>;
  getApprovalStep(id: string): Promise<ApprovalStep | undefined>;
  resolveCostCenter(rawCostCenter: string): Promise<string>;
  getPendingApprovalSteps(userId: string): Promise<ApprovalStep[]>;
  createApprovalStep(step: InsertApprovalStep): Promise<ApprovalStep>;
  updateApprovalStep(id: string, data: Partial<ApprovalStep>): Promise<ApprovalStep | undefined>;
  getCurrentApprovalStep(requisitionId: string): Promise<ApprovalStep | undefined>;
  getUserPendingStepForRequisition(requisitionId: string, userId: string): Promise<ApprovalStep | undefined>;
  findAndRelinkOrphanedStep(requisitionId: string, userId: string, userName: string): Promise<ApprovalStep | undefined>;
  hasPendingStepForUser(requisitionId: string, userId: string): Promise<boolean>;
  hasAnyStepForUser(requisitionId: string, userId: string): Promise<boolean>;
  getPendingApprovalStepsByGroup(groupCostCenter: string, userId: string): Promise<ApprovalStep[]>;
  hasPendingGroupStepForUser(requisitionId: string, groupCostCenter: string): Promise<boolean>;

  // Requisition Quotations
  createQuotation(q: InsertRequisitionQuotation): Promise<RequisitionQuotation>;
  getQuotationsByRequisition(requisitionId: string): Promise<RequisitionQuotation[]>;
  getQuotation(id: string): Promise<RequisitionQuotation | undefined>;
  updateQuotation(id: string, data: Partial<RequisitionQuotation>): Promise<RequisitionQuotation | undefined>;
  deleteQuotation(id: string): Promise<boolean>;

  // Data Source Records (multi)
  getDsRecordsByField(dataSourceId: string, fieldKey: string, fieldValue: string, caseInsensitive?: boolean): Promise<DsRecord[]>;

  getAllDepartments(): Promise<Department[]>;
  getActiveDepartments(): Promise<Department[]>;
  getDepartment(internalId: number): Promise<Department | undefined>;
  upsertDepartments(rows: InsertDepartment[]): Promise<{ imported: number; updated: number }>;
}

export class DatabaseStorage implements IStorage {
  async getAllManagedUsers(): Promise<ManagedUser[]> {
    return await db.select().from(managedUsers).orderBy(managedUsers.createdAt);
  }

  async getManagedUser(id: string): Promise<ManagedUser | undefined> {
    const [user] = await db.select().from(managedUsers).where(eq(managedUsers.id, id));
    return user;
  }

  async getManagedUserByEmail(email: string): Promise<ManagedUser | undefined> {
    const [user] = await db.select().from(managedUsers).where(eq(managedUsers.email, email));
    return user;
  }

  async getManagedUserByUsername(username: string): Promise<ManagedUser | undefined> {
    const [user] = await db.select().from(managedUsers).where(eq(managedUsers.username, username));
    return user;
  }

  async getManagedUserByEmployeeCode(employeeCode: string): Promise<ManagedUser | undefined> {
    const [user] = await db.select().from(managedUsers).where(eq(managedUsers.employeeCode, employeeCode));
    return user;
  }

  async createManagedUser(userData: InsertManagedUser): Promise<ManagedUser> {
    const [user] = await db.insert(managedUsers).values(userData as any).returning();
    return user;
  }

  async updateManagedUser(id: string, data: Partial<InsertManagedUser>): Promise<ManagedUser | undefined> {
    const [user] = await db
      .update(managedUsers)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(managedUsers.id, id))
      .returning();
    return user;
  }

  async deleteManagedUser(id: string): Promise<boolean> {
    const result = await db.delete(managedUsers).where(eq(managedUsers.id, id)).returning();
    return result.length > 0;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [record] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return record;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [record] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return record;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));
  }

  async invalidateUserResetTokens(userId: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  }

  async destroyUserSessions(userId: string): Promise<number> {
    const result = await db.execute(
      sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`
    );
    return Number(result.rowCount ?? 0);
  }

  async createSsoToken(token: string, userId: string, expiresAt: Date): Promise<SsoToken> {
    const [created] = await db.insert(ssoTokens).values({ token, userId, expiresAt, used: false }).returning();
    return created;
  }

  async validateAndConsumeSsoToken(tokenValue: string): Promise<{ userId: string } | null> {
    const now = new Date();
    const [consumed] = await db.update(ssoTokens)
      .set({ used: true })
      .where(and(eq(ssoTokens.token, tokenValue), eq(ssoTokens.used, false), sql`${ssoTokens.expiresAt} > ${now}`))
      .returning();
    if (!consumed) return null;
    return { userId: consumed.userId };
  }

  async invalidateUserSsoTokens(userId: string): Promise<number> {
    const invalidated = await db.update(ssoTokens)
      .set({ used: true })
      .where(and(eq(ssoTokens.userId, userId), eq(ssoTokens.used, false)))
      .returning();
    return invalidated.length;
  }

  async createSsoAuditLog(log: InsertSsoAuditLog): Promise<SsoAuditLog> {
    const [created] = await db.insert(ssoAuditLogs).values(log).returning();
    return created;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const deletedSso = await db.delete(ssoTokens)
      .where(or(
        sql`${ssoTokens.expiresAt} < NOW()`,
        and(eq(ssoTokens.used, true), sql`${ssoTokens.createdAt} < ${oneHourAgo}`)
      ))
      .returning();
    const deletedPrt = await db.delete(passwordResetTokens)
      .where(or(
        sql`${passwordResetTokens.expiresAt} < NOW()`,
        sql`${passwordResetTokens.usedAt} IS NOT NULL`
      ))
      .returning();
    return deletedSso.length + deletedPrt.length;
  }

  async getUserStats(): Promise<{ totalUsers: number; activeUsers: number; totalEmployees: number; roleDistribution: { role: string; count: number }[] }> {
    const allUsers = await db.select().from(managedUsers);
    const totalUsers = allUsers.length;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = allUsers.filter(u => u.lastActiveAt && u.lastActiveAt > oneDayAgo).length;
    
    const roleMap = new Map<string, number>();
    allUsers.forEach(u => {
      const role = u.role || 'viewer';
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    });
    
    const roleDistribution = Array.from(roleMap.entries()).map(([role, count]) => ({ role, count }));

    let totalEmployees = 0;
    try {
      const empSource = await db.select().from(dataSources).where(eq(dataSources.slug, "employee-directory"));
      if (empSource.length > 0) {
        const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(dsRecords).where(eq(dsRecords.dataSourceId, empSource[0].id));
        totalEmployees = Number(countResult?.count || 0);
      }
    } catch {}
    
    return { totalUsers, activeUsers, totalEmployees, roleDistribution };
  }

  // System settings methods
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }

  async getSystemSettingsByCategory(category: string): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).where(eq(systemSettings.category, category));
  }

  async upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(setting.key);
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

  async deleteSystemSetting(key: string): Promise<boolean> {
    const result = await db.delete(systemSettings).where(eq(systemSettings.key, key)).returning();
    return result.length > 0;
  }

  // External services methods
  async getExternalServices(): Promise<ExternalService[]> {
    return await db.select().from(externalServices).orderBy(asc(externalServices.sortOrder));
  }

  async getEnabledExternalServices(): Promise<ExternalService[]> {
    return await db.select().from(externalServices)
      .where(eq(externalServices.isEnabled, true))
      .orderBy(asc(externalServices.sortOrder));
  }

  async getExternalService(id: string): Promise<ExternalService | undefined> {
    const [service] = await db.select().from(externalServices).where(eq(externalServices.id, id));
    return service;
  }

  async createExternalService(service: InsertExternalService): Promise<ExternalService> {
    const [created] = await db.insert(externalServices).values(service).returning();
    return created;
  }

  async updateExternalService(id: string, data: Partial<InsertExternalService>): Promise<ExternalService | undefined> {
    const [updated] = await db
      .update(externalServices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(externalServices.id, id))
      .returning();
    return updated;
  }

  async deleteExternalService(id: string): Promise<boolean> {
    const result = await db.delete(externalServices).where(eq(externalServices.id, id)).returning();
    return result.length > 0;
  }

  // Audit log methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(options?: { 
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
    if (options?.category) {
      conditions.push(eq(auditLogs.category, options.category));
    }
    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    if (options?.search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${options.search}%`),
          ilike(auditLogs.userEmail || '', `%${options.search}%`)
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

  // Ticket methods
  async initTicketSequence(): Promise<void> {
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS ticket_tracking_seq`);
    const [maxRow] = await db.select({
      maxNum: sql<number>`COALESCE(MAX(
        CASE WHEN tracking_id ~ '^DT[0-9]+$'
          THEN CAST(SUBSTRING(tracking_id FROM 3) AS INTEGER)
          ELSE 0
        END
      ), 0)`
    }).from(tickets);
    const maxNum = Number(maxRow.maxNum) || 0;
    if (maxNum > 0) {
      await db.execute(sql`SELECT setval('ticket_tracking_seq', ${maxNum})`);
    }
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    const [{ next_num }] = await db.select({
      next_num: sql<string>`nextval('ticket_tracking_seq')`,
    }).from(sql`(SELECT 1) AS _dummy`);
    const trackingId = `DT${next_num}`;

    const [ticket] = await db.insert(tickets).values({
      ...ticketData,
      trackingId,
    }).returning();
    return ticket;
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async getTicketByTrackingId(trackingId: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.trackingId, trackingId));
    return ticket;
  }

  async getTicketsByUser(userId: string): Promise<Ticket[]> {
    return await db.select().from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.createdAt));
  }

  async getAllTickets(options?: { status?: string; category?: string; limit?: number; offset?: number; userId?: string }): Promise<{ tickets: Ticket[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const conditions = [];
    if (options?.userId) {
      conditions.push(eq(tickets.userId, options.userId));
    }
    if (options?.status) {
      conditions.push(eq(tickets.status, options.status));
    }
    if (options?.category) {
      conditions.push(eq(tickets.category, options.category));
    }

    let query = db.select().from(tickets);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(tickets);
    
    if (conditions.length > 0) {
      const where = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(where!) as typeof query;
      countQuery = countQuery.where(where!) as typeof countQuery;
    }
    
    const ticketList = await query.orderBy(desc(tickets.createdAt)).limit(limit).offset(offset);
    const [{ count: total }] = await countQuery;
    
    return { tickets: ticketList, total: Number(total) };
  }

  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    const [ticket] = await db
      .update(tickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return ticket;
  }

  async deleteTicket(id: string): Promise<boolean> {
    const result = await db.delete(tickets).where(eq(tickets.id, id)).returning();
    return result.length > 0;
  }

  // Ticket comment methods
  async createTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const [created] = await db.insert(ticketComments).values(comment).returning();
    return created;
  }

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return await db.select().from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(asc(ticketComments.createdAt));
  }

  // Ticket attachment methods
  async getTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
    return await db.select().from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(asc(ticketAttachments.uploadedAt));
  }

  async getTicketAttachmentById(id: string): Promise<TicketAttachment | undefined> {
    const [att] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id));
    return att;
  }

  async createTicketAttachment(a: InsertTicketAttachment): Promise<TicketAttachment> {
    const [created] = await db.insert(ticketAttachments).values(a).returning();
    return created;
  }

  async deleteTicketAttachment(id: string): Promise<boolean> {
    const r = await db.delete(ticketAttachments).where(eq(ticketAttachments.id, id)).returning();
    return r.length > 0;
  }

  // FAQ methods
  async getAllFaqEntries(): Promise<FaqEntry[]> {
    return await db.select().from(faqEntries)
      .where(eq(faqEntries.isPublished, true))
      .orderBy(faqEntries.category, faqEntries.order);
  }

  async getFaqEntriesByCategory(category: string): Promise<FaqEntry[]> {
    return await db.select().from(faqEntries)
      .where(and(eq(faqEntries.category, category), eq(faqEntries.isPublished, true)))
      .orderBy(faqEntries.order);
  }

  async createFaqEntry(entry: InsertFaqEntry): Promise<FaqEntry> {
    const [created] = await db.insert(faqEntries).values(entry).returning();
    return created;
  }

  async updateFaqEntry(id: string, data: Partial<InsertFaqEntry>): Promise<FaqEntry | undefined> {
    const [updated] = await db
      .update(faqEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(faqEntries.id, id))
      .returning();
    return updated;
  }

  async deleteFaqEntry(id: string): Promise<boolean> {
    const result = await db.delete(faqEntries).where(eq(faqEntries.id, id)).returning();
    return result.length > 0;
  }

  // User manual methods
  async getAllUserManuals(): Promise<UserManual[]> {
    return await db.select().from(userManuals)
      .where(eq(userManuals.isPublished, true))
      .orderBy(userManuals.category, userManuals.order);
  }

  async getUserManualsByCategory(category: string): Promise<UserManual[]> {
    return await db.select().from(userManuals)
      .where(and(eq(userManuals.category, category), eq(userManuals.isPublished, true)))
      .orderBy(userManuals.order);
  }

  async getUserManual(id: string): Promise<UserManual | undefined> {
    const [manual] = await db.select().from(userManuals).where(eq(userManuals.id, id));
    return manual;
  }

  async createUserManual(manual: InsertUserManual): Promise<UserManual> {
    const [created] = await db.insert(userManuals).values(manual).returning();
    return created;
  }

  async updateUserManual(id: string, data: Partial<InsertUserManual>): Promise<UserManual | undefined> {
    const [updated] = await db
      .update(userManuals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userManuals.id, id))
      .returning();
    return updated;
  }

  async deleteUserManual(id: string): Promise<boolean> {
    const result = await db.delete(userManuals).where(eq(userManuals.id, id)).returning();
    return result.length > 0;
  }

  // Customer methods
  async getAllCustomers(options?: { search?: string; type?: string; unit?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: string }): Promise<{ customers: Customer[]; total: number }> {
    const { search, type, unit, limit = 50, offset = 0, sortBy, sortOrder } = options || {};
    
    let conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(customers.firstName, `%${search}%`),
          ilike(customers.lastName, `%${search}%`),
          ilike(customers.email, `%${search}%`),
          ilike(customers.contact, `%${search}%`)
        )
      );
    }
    if (type) {
      conditions.push(eq(customers.type, type));
    }
    if (unit) {
      conditions.push(eq(customers.primaryUnit, unit));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause);

    const sortColumnMap: Record<string, any> = {
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      contact: customers.contact,
      primaryUnit: customers.primaryUnit,
      source: customers.source,
      createdAt: customers.createdAt,
    };
    const sortCol = sortColumnMap[sortBy || ""] || customers.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;
    
    const result = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset);
    
    return { customers: result, total: countResult?.count || 0 };
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByExternalCode(code: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.externalCode, code));
    return customer;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    await db.delete(customerProfiles).where(eq(customerProfiles.customerId, id));
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  // Customer profile methods
  async getCustomerProfile(customerId: string): Promise<CustomerProfile | undefined> {
    const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.customerId, customerId));
    return profile;
  }

  async upsertCustomerProfile(profile: InsertCustomerProfile): Promise<CustomerProfile> {
    const existing = await this.getCustomerProfile(profile.customerId);
    if (existing) {
      const [updated] = await db
        .update(customerProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(customerProfiles.customerId, profile.customerId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(customerProfiles).values(profile).returning();
      return created;
    }
  }

  async deleteCustomerProfile(customerId: string): Promise<boolean> {
    const result = await db.delete(customerProfiles).where(eq(customerProfiles.customerId, customerId)).returning();
    return result.length > 0;
  }

  // Combined customer with profile
  async getCustomerWithProfile(id: string): Promise<CustomerWithProfile | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;
    
    const profile = await this.getCustomerProfile(id);
    return { ...customer, profile: profile || undefined };
  }

  // Data Sources methods
  async getAllDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources).orderBy(dataSources.name);
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, id));
    return ds;
  }

  async getDataSourceBySlug(slug: string): Promise<DataSource | undefined> {
    const [ds] = await db.select().from(dataSources).where(eq(dataSources.slug, slug));
    return ds;
  }

  async updateDataSource(id: string, data: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [updated] = await db.update(dataSources).set(data as any).where(eq(dataSources.id, id)).returning();
    return updated;
  }

  async getDsRecords(dataSourceId: string, options?: { search?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: string }): Promise<{ records: DsRecord[]; total: number }> {
    const limit = options?.limit || 25;
    const offset = options?.offset || 0;

    const conditions = [eq(dsRecords.dataSourceId, dataSourceId)];

    if (options?.search) {
      conditions.push(sql`${dsRecords.data}::text ILIKE ${'%' + options.search + '%'}`);
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(dsRecords).where(where);
    const total = Number(countResult?.count || 0);

    let orderClause;
    if (options?.sortBy && options.sortBy !== 'createdAt') {
      const sanitizedKey = options.sortBy.replace(/[^a-zA-Z0-9_]/g, '');
      if (options.sortOrder === 'asc') {
        orderClause = sql`${dsRecords.data}->>${sanitizedKey} ASC`;
      } else {
        orderClause = sql`${dsRecords.data}->>${sanitizedKey} DESC`;
      }
    } else {
      orderClause = options?.sortOrder === 'asc' ? asc(dsRecords.createdAt) : desc(dsRecords.createdAt);
    }

    const records = await db.select().from(dsRecords).where(where).orderBy(orderClause, asc(dsRecords.id)).limit(limit).offset(offset);

    return { records, total };
  }

  async getDsRecord(id: string): Promise<DsRecord | undefined> {
    const [record] = await db.select().from(dsRecords).where(eq(dsRecords.id, id));
    return record;
  }

  async getDsRecordByField(dataSourceId: string, fieldKey: string, fieldValue: string, caseInsensitive?: boolean): Promise<DsRecord | undefined> {
    const sanitizedKey = fieldKey.replace(/[^a-zA-Z0-9_]/g, '');
    const fieldExpr = sql`${dsRecords.data}->>${sql.raw(`'${sanitizedKey}'`)}`;
    const matchCondition = caseInsensitive
      ? sql`LOWER(${fieldExpr}) = LOWER(${fieldValue})`
      : sql`${fieldExpr} = ${fieldValue}`;
    const [record] = await db.select().from(dsRecords).where(
      and(eq(dsRecords.dataSourceId, dataSourceId), matchCondition)
    ).limit(1);
    return record;
  }

  async createDsRecord(record: InsertDsRecord): Promise<DsRecord> {
    const [created] = await db.insert(dsRecords).values(record).returning();
    return created;
  }

  async createDsRecordsBulk(records: InsertDsRecord[]): Promise<DsRecord[]> {
    if (records.length === 0) return [];
    const created = await db.insert(dsRecords).values(records).returning();
    return created;
  }

  async updateDsRecord(id: string, data: Record<string, any>): Promise<DsRecord | undefined> {
    const existing = await this.getDsRecord(id);
    if (!existing) return undefined;
    const merged = { ...(existing.data as Record<string, any>), ...data };
    const [updated] = await db.update(dsRecords).set({ data: merged }).where(eq(dsRecords.id, id)).returning();
    return updated;
  }

  async deleteDsRecord(id: string): Promise<boolean> {
    const result = await db.delete(dsRecords).where(eq(dsRecords.id, id)).returning();
    return result.length > 0;
  }

  async deleteDsRecordsBySource(dataSourceId: string): Promise<number> {
    const result = await db.delete(dsRecords).where(eq(dsRecords.dataSourceId, dataSourceId)).returning();
    return result.length;
  }

  // Collaboration blueprints methods
  async getAllBlueprints(): Promise<CollaborationBlueprint[]> {
    return await db.select().from(collaborationBlueprints).orderBy(collaborationBlueprints.sectionName);
  }

  async getBlueprint(id: string): Promise<CollaborationBlueprint | undefined> {
    const [blueprint] = await db.select().from(collaborationBlueprints).where(eq(collaborationBlueprints.id, id));
    return blueprint;
  }

  async getBlueprintBySectionName(sectionName: string): Promise<CollaborationBlueprint | undefined> {
    const [blueprint] = await db.select().from(collaborationBlueprints).where(eq(collaborationBlueprints.sectionName, sectionName));
    return blueprint;
  }

  async createBlueprint(blueprint: InsertBlueprint): Promise<CollaborationBlueprint> {
    const [created] = await db.insert(collaborationBlueprints).values(blueprint).returning();
    return created;
  }

  async updateBlueprint(id: string, data: Partial<InsertBlueprint>): Promise<CollaborationBlueprint | undefined> {
    const [updated] = await db
      .update(collaborationBlueprints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collaborationBlueprints.id, id))
      .returning();
    return updated;
  }

  async deleteBlueprint(id: string): Promise<boolean> {
    const result = await db.delete(collaborationBlueprints).where(eq(collaborationBlueprints.id, id)).returning();
    return result.length > 0;
  }

  // Spaces methods
  async getAllSpaces(): Promise<Space[]> {
    return await db.select().from(spaces).orderBy(asc(spaces.name));
  }

  async getSpace(id: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
    return space;
  }

  async createSpace(space: InsertSpace): Promise<Space> {
    const [created] = await db.insert(spaces).values(space).returning();
    return created;
  }

  async updateSpace(id: string, data: Partial<InsertSpace>): Promise<Space | undefined> {
    const [updated] = await db.update(spaces).set(data).where(eq(spaces.id, id)).returning();
    return updated;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const result = await db.delete(spaces).where(eq(spaces.id, id)).returning();
    return result.length > 0;
  }

  async getSpacesWithHierarchy(viewType?: string, userId?: string): Promise<SpaceWithHierarchy[]> {
    let allSpaces = await this.getAllSpaces();

    // Filter spaces by user visibility:
    // - Spaces with no ownerId are "public" (visible to all) — backward compat for seeded data
    // - Spaces with an ownerId are private: visible to the owner and their invited members
    if (userId) {
      const memberRows = await db.select({ spaceId: spaceMembers.spaceId }).from(spaceMembers).where(eq(spaceMembers.userId, userId));
      const memberSpaceIds = new Set(memberRows.map(r => r.spaceId));
      allSpaces = allSpaces.filter(s =>
        !s.ownerId ||           // public (no owner set)
        s.ownerId === userId || // current user owns it
        memberSpaceIds.has(s.id) // current user is a member
      );
    }

    const allGroups = await db.select().from(projectGroups).orderBy(asc(projectGroups.name));
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    const allAssignments = await db.select().from(projectAssignments);
    const allUsers = await db.select().from(managedUsers);

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const assignmentsByProject = new Map<string, (ProjectAssignment & { user?: any })[]>();
    for (const a of allAssignments) {
      const list = assignmentsByProject.get(a.projectId) || [];
      list.push({ ...a, user: userMap.get(a.userId) });
      assignmentsByProject.set(a.projectId, list);
    }

    return allSpaces.map(space => ({
      ...space,
      projectGroups: allGroups
        .filter(g => g.spaceId === space.id)
        .map(group => ({
          ...group,
          tasks: allProjects
            .filter(p => p.projectGroupId === group.id)
            .map(p => ({
              ...p,
              assignments: assignmentsByProject.get(p.id) || [],
              ownerUser: p.ownerUserId ? (userMap.get(p.ownerUserId) || null) : null,
              createdByUser: p.createdBy ? (userMap.get(p.createdBy) || null) : null,
            })),
        })),
    }));
  }

  async getSpaceMembers(spaceId: string): Promise<(SpaceMember & { user: { id: string; username: string; firstName: string | null; lastName: string | null; email: string } })[]> {
    const rows = await db
      .select({
        member: spaceMembers,
        userId: managedUsers.id,
        username: managedUsers.username,
        firstName: managedUsers.firstName,
        lastName: managedUsers.lastName,
        email: managedUsers.email,
      })
      .from(spaceMembers)
      .innerJoin(managedUsers, eq(spaceMembers.userId, managedUsers.id))
      .where(eq(spaceMembers.spaceId, spaceId));
    return rows.map(r => ({
      ...r.member,
      user: { id: r.userId, username: r.username, firstName: r.firstName, lastName: r.lastName, email: r.email },
    }));
  }

  async addSpaceMember(spaceId: string, userId: string): Promise<SpaceMember> {
    const [created] = await db
      .insert(spaceMembers)
      .values({ spaceId, userId })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      const [existing] = await db.select().from(spaceMembers).where(
        and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId))
      );
      return existing;
    }
    return created;
  }

  async removeSpaceMember(spaceId: string, userId: string): Promise<boolean> {
    const result = await db.delete(spaceMembers).where(
      and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId))
    ).returning();
    return result.length > 0;
  }

  async isSpaceMember(spaceId: string, userId: string): Promise<boolean> {
    const rows = await db.select().from(spaceMembers).where(
      and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId))
    );
    return rows.length > 0;
  }

  // Project Groups methods
  async getAllProjectGroups(spaceId?: string): Promise<ProjectGroup[]> {
    if (spaceId) {
      return await db.select().from(projectGroups).where(eq(projectGroups.spaceId, spaceId)).orderBy(asc(projectGroups.name));
    }
    return await db.select().from(projectGroups).orderBy(asc(projectGroups.name));
  }

  async getProjectGroup(id: string): Promise<ProjectGroup | undefined> {
    const [group] = await db.select().from(projectGroups).where(eq(projectGroups.id, id));
    return group;
  }

  async createProjectGroup(group: InsertProjectGroup): Promise<ProjectGroup> {
    const [created] = await db.insert(projectGroups).values(group).returning();
    return created;
  }

  async updateProjectGroup(id: string, data: Partial<InsertProjectGroup>): Promise<ProjectGroup | undefined> {
    const [updated] = await db.update(projectGroups).set(data).where(eq(projectGroups.id, id)).returning();
    return updated;
  }

  async deleteProjectGroup(id: string): Promise<boolean> {
    const result = await db.delete(projectGroups).where(eq(projectGroups.id, id)).returning();
    return result.length > 0;
  }

  // Projects methods
  async getAllProjects(options?: { userId?: string; status?: string }): Promise<Project[]> {
    let query = db.select().from(projects);
    const conditions = [];
    
    if (options?.status) {
      conditions.push(eq(projects.status, options.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectWithAssignments(id: string): Promise<ProjectWithAssignments | undefined> {
    const project = await this.getProject(id);
    if (!project) return undefined;
    
    const assignments = await this.getProjectAssignments(id);
    const comments = await this.getProjectComments(id);
    
    const assignmentsWithUsers = await Promise.all(
      assignments.map(async (assignment) => {
        const user = await this.getManagedUser(assignment.userId);
        return { ...assignment, user };
      })
    );
    
    const ownerUser = project.ownerUserId ? await this.getManagedUser(project.ownerUserId) : null;
    const createdByUser = project.createdBy ? await this.getManagedUser(project.createdBy) : null;
    
    return { ...project, assignments: assignmentsWithUsers, comments, ownerUser, createdByUser };
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    await db.delete(projectAssignments).where(eq(projectAssignments.projectId, id));
    await db.delete(projectComments).where(eq(projectComments.projectId, id));
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Project assignments methods
  async getProjectAssignments(projectId: string): Promise<ProjectAssignment[]> {
    return await db.select().from(projectAssignments).where(eq(projectAssignments.projectId, projectId));
  }

  async createProjectAssignment(assignment: InsertProjectAssignment): Promise<ProjectAssignment> {
    const [created] = await db.insert(projectAssignments).values(assignment).returning();
    return created;
  }

  async deleteProjectAssignment(id: string): Promise<boolean> {
    const result = await db.delete(projectAssignments).where(eq(projectAssignments.id, id)).returning();
    return result.length > 0;
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    const assignments = await db.select().from(projectAssignments).where(eq(projectAssignments.userId, userId));
    const projectIds = assignments.map(a => a.projectId);
    
    if (projectIds.length === 0) return [];
    
    const userProjects = await db.select().from(projects).where(
      or(...projectIds.map(pid => eq(projects.id, pid)))
    );
    return userProjects;
  }

  // Project comments methods
  async getProjectComments(projectId: string): Promise<ProjectComment[]> {
    return await db.select().from(projectComments)
      .where(eq(projectComments.projectId, projectId))
      .orderBy(asc(projectComments.createdAt));
  }

  async createProjectComment(comment: InsertProjectComment): Promise<ProjectComment> {
    const [created] = await db.insert(projectComments).values(comment).returning();
    return created;
  }

  // Project tags methods
  async getAllProjectTags(): Promise<ProjectTagRecord[]> {
    return await db.select().from(projectTagsTable).orderBy(asc(projectTagsTable.name));
  }

  async getProjectTag(id: string): Promise<ProjectTagRecord | undefined> {
    const [tag] = await db.select().from(projectTagsTable).where(eq(projectTagsTable.id, id));
    return tag;
  }

  async createProjectTag(tag: InsertProjectTag): Promise<ProjectTagRecord> {
    const [created] = await db.insert(projectTagsTable).values(tag).returning();
    return created;
  }

  async updateProjectTag(id: string, data: Partial<InsertProjectTag>): Promise<ProjectTagRecord | undefined> {
    const [updated] = await db.update(projectTagsTable)
      .set(data)
      .where(eq(projectTagsTable.id, id))
      .returning();
    return updated;
  }

  async deleteProjectTag(id: string): Promise<boolean> {
    const result = await db.delete(projectTagsTable).where(eq(projectTagsTable.id, id));
    return true;
  }

  // Sprint methods
  async getAllSprints(): Promise<Sprint[]> {
    return await db.select().from(sprints).orderBy(asc(sprints.startDate));
  }

  async getSprint(id: string): Promise<Sprint | undefined> {
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id));
    return sprint;
  }

  async getActiveSprint(): Promise<Sprint | undefined> {
    const [sprint] = await db.select().from(sprints).where(eq(sprints.isActive, true));
    return sprint;
  }

  async createSprint(sprint: InsertSprint): Promise<Sprint> {
    const [created] = await db.insert(sprints).values(sprint).returning();
    return created;
  }

  async updateSprint(id: string, data: Partial<InsertSprint>): Promise<Sprint | undefined> {
    const [updated] = await db.update(sprints)
      .set(data)
      .where(eq(sprints.id, id))
      .returning();
    return updated;
  }

  async deleteSprint(id: string): Promise<boolean> {
    await db.delete(sprints).where(eq(sprints.id, id));
    return true;
  }

  async closeSprint(id: string): Promise<{ sprint: Sprint; archivedCount: number } | undefined> {
    const sprint = await this.getSprint(id);
    if (!sprint) return undefined;

    // Use transaction to ensure data integrity
    return await db.transaction(async (tx) => {
      // Count completed tasks from this sprint
      const completedTasks = await tx.select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.sprintId, id), eq(projects.status, "completed")));
      
      const archivedCount = completedTasks.length;
      
      // Mark sprint as closed first
      const [updated] = await tx.update(sprints)
        .set({ isClosed: true, isActive: false })
        .where(eq(sprints.id, id))
        .returning();

      // Delete the completed tasks after sprint is closed
      if (archivedCount > 0) {
        await tx.delete(projects).where(and(eq(projects.sprintId, id), eq(projects.status, "completed")));
      }

      return { sprint: updated, archivedCount };
    });
  }

  // User services (access control) methods
  async getUserServices(userId: string): Promise<string[]> {
    const services = await db.select({ serviceId: userServices.serviceId })
      .from(userServices)
      .where(eq(userServices.userId, userId));
    return services.map(s => s.serviceId);
  }

  async setUserServices(userId: string, serviceIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(userServices).where(eq(userServices.userId, userId));
      if (serviceIds.length > 0) {
        await tx.insert(userServices).values(
          serviceIds.map(serviceId => ({ userId, serviceId }))
        );
      }
    });
  }

  // Section templates methods
  async getAllSectionTemplates(): Promise<SectionTemplate[]> {
    return await db.select().from(sectionTemplates).orderBy(asc(sectionTemplates.name));
  }

  async getSectionTemplate(id: string): Promise<SectionTemplate | undefined> {
    const [template] = await db.select().from(sectionTemplates).where(eq(sectionTemplates.id, id));
    return template;
  }

  async getSectionTemplateByType(sectionType: string): Promise<SectionTemplate | undefined> {
    const [template] = await db.select().from(sectionTemplates).where(eq(sectionTemplates.sectionType, sectionType));
    return template;
  }

  async createSectionTemplate(template: InsertSectionTemplate): Promise<SectionTemplate> {
    const [created] = await db.insert(sectionTemplates).values(template).returning();
    return created;
  }

  async updateSectionTemplate(id: string, data: Partial<InsertSectionTemplate>): Promise<SectionTemplate | undefined> {
    const [updated] = await db
      .update(sectionTemplates)
      .set(data)
      .where(eq(sectionTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteSectionTemplate(id: string): Promise<boolean> {
    const result = await db.delete(sectionTemplates).where(eq(sectionTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Page sections methods
  async getPageSectionsByService(serviceId: string): Promise<PageSectionWithTemplate[]> {
    const rows = await db
      .select({
        section: pageSections,
        template: sectionTemplates,
      })
      .from(pageSections)
      .leftJoin(sectionTemplates, eq(pageSections.sectionTemplateId, sectionTemplates.id))
      .where(eq(pageSections.serviceId, serviceId))
      .orderBy(asc(pageSections.sortOrder));

    return rows.map(row => ({
      ...row.section,
      template: row.template || null,
    }));
  }

  async getPageSection(id: string): Promise<PageSection | undefined> {
    const [section] = await db.select().from(pageSections).where(eq(pageSections.id, id));
    return section;
  }

  async createPageSection(section: InsertPageSection): Promise<PageSection> {
    const [created] = await db.insert(pageSections).values(section).returning();
    return created;
  }

  async updatePageSection(id: string, data: Partial<InsertPageSection>): Promise<PageSection | undefined> {
    const [updated] = await db
      .update(pageSections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pageSections.id, id))
      .returning();
    return updated;
  }

  async deletePageSection(id: string): Promise<boolean> {
    const result = await db.delete(pageSections).where(eq(pageSections.id, id)).returning();
    return result.length > 0;
  }

  async reorderPageSections(serviceId: string, sectionIds: string[]): Promise<boolean> {
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

  async getAllIcons(): Promise<IconLibraryEntry[]> {
    return await db.select().from(iconLibrary).orderBy(iconLibrary.category, iconLibrary.label);
  }

  async getIcon(id: string): Promise<IconLibraryEntry | undefined> {
    const [icon] = await db.select().from(iconLibrary).where(eq(iconLibrary.id, id));
    return icon;
  }

  async getIconByName(name: string): Promise<IconLibraryEntry | undefined> {
    const [icon] = await db.select().from(iconLibrary).where(eq(iconLibrary.name, name));
    return icon;
  }

  async createIcon(icon: InsertIconLibrary): Promise<IconLibraryEntry> {
    const [created] = await db.insert(iconLibrary).values(icon).returning();
    return created;
  }

  async deleteIcon(id: string): Promise<boolean> {
    const result = await db.delete(iconLibrary).where(eq(iconLibrary.id, id)).returning();
    return result.length > 0;
  }

  // Requisitions implementations
  async getAllRequisitions(options?: { search?: string; status?: string; userId?: string; approverRequisitionIds?: string[] }): Promise<Requisition[]> {
    const filterConditions = [];
    if (options?.status) {
      filterConditions.push(eq(requisitions.status, options.status));
    }
    if (options?.search) {
      const term = `%${options.search}%`;
      filterConditions.push(or(
        ilike(requisitions.requestTitle, term),
        ilike(requisitions.department, term),
        ilike(requisitions.requestedBy, term),
      )!);
    }

    let ownershipCondition = undefined;
    if (options?.userId && options?.approverRequisitionIds && options.approverRequisitionIds.length > 0) {
      ownershipCondition = or(
        eq(requisitions.userId, options.userId),
        inArray(requisitions.id, options.approverRequisitionIds)
      );
    } else if (options?.userId) {
      ownershipCondition = eq(requisitions.userId, options.userId);
    }

    const allConditions = ownershipCondition
      ? [ownershipCondition, ...filterConditions]
      : filterConditions;

    if (allConditions.length > 0) {
      return await db.select().from(requisitions).where(and(...allConditions)).orderBy(desc(requisitions.createdAt));
    }
    return await db.select().from(requisitions).orderBy(desc(requisitions.createdAt));
  }
  async getRequisition(id: string): Promise<Requisition | undefined> {
    const [r] = await db.select().from(requisitions).where(eq(requisitions.id, id));
    return r;
  }
  async createRequisition(r: InsertRequisition & { userId?: string }): Promise<Requisition> {
    const [created] = await db.insert(requisitions).values(r).returning();
    return created;
  }
  async updateRequisition(id: string, d: Partial<InsertRequisition>): Promise<Requisition | undefined> {
    const [updated] = await db.update(requisitions).set({ ...d, updatedAt: new Date() }).where(eq(requisitions.id, id)).returning();
    return updated;
  }
  async deleteRequisition(id: string): Promise<boolean> {
    const r = await db.delete(requisitions).where(eq(requisitions.id, id)).returning();
    return r.length > 0;
  }
  async getRequisitionAttachments(requisitionId: string): Promise<RequisitionAttachment[]> {
    return await db.select().from(requisitionAttachments).where(eq(requisitionAttachments.requisitionId, requisitionId));
  }
  async getRequisitionAttachmentById(id: string): Promise<RequisitionAttachment | undefined> {
    const rows = await db.select().from(requisitionAttachments).where(eq(requisitionAttachments.id, id));
    return rows[0];
  }
  async createRequisitionAttachment(a: InsertRequisitionAttachment): Promise<RequisitionAttachment> {
    const [created] = await db.insert(requisitionAttachments).values(a).returning();
    return created;
  }
  async deleteRequisitionAttachment(id: string): Promise<boolean> {
    const r = await db.delete(requisitionAttachments).where(eq(requisitionAttachments.id, id)).returning();
    return r.length > 0;
  }
  async getRequisitionComments(requisitionId: string): Promise<RequisitionComment[]> {
    return await db.select().from(requisitionComments).where(eq(requisitionComments.requisitionId, requisitionId)).orderBy(requisitionComments.createdAt);
  }
  async createRequisitionComment(c: InsertRequisitionComment): Promise<RequisitionComment> {
    const [created] = await db.insert(requisitionComments).values(c).returning();
    return created;
  }

  // Requisition Approval Steps implementations
  async getApprovalSteps(requisitionId: string): Promise<ApprovalStep[]> {
    return await db.select().from(requisitionApprovalSteps)
      .where(eq(requisitionApprovalSteps.requisitionId, requisitionId))
      .orderBy(asc(requisitionApprovalSteps.createdAt));
  }
  async getApprovalStep(id: string): Promise<ApprovalStep | undefined> {
    const [step] = await db.select().from(requisitionApprovalSteps).where(eq(requisitionApprovalSteps.id, id));
    return step;
  }
  async resolveCostCenter(rawCostCenter: string): Promise<string> {
    if (/^\d+$/.test(rawCostCenter)) return rawCostCenter;
    try {
      const [exactDept] = await db.select().from(departments)
        .where(ilike(departments.name, rawCostCenter))
        .limit(1);
      if (exactDept) return exactDept.externalId;
      const [partialDept] = await db.select().from(departments)
        .where(ilike(departments.name, `%${rawCostCenter}%`))
        .limit(1);
      if (partialDept) return partialDept.externalId;
    } catch (err) {
      console.warn("[storage] Error resolving cost center:", err);
    }
    return rawCostCenter;
  }

  async getPendingApprovalSteps(userId: string): Promise<ApprovalStep[]> {
    const directSteps = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.assignedTo, userId),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .orderBy(desc(requisitionApprovalSteps.createdAt));
    console.log(`[storage] getPendingApprovalSteps user=${userId}: ${directSteps.length} direct steps found`);

    let groupSteps: ApprovalStep[] = [];
    try {
      const user = await this.getManagedUser(userId);
      if (user) {
        const empDs = await this.getDataSourceBySlug("employee-directory");
        if (empDs) {
          const email = user.email?.trim().toLowerCase();
          const empRecord = user.employeeCode
            ? await this.getDsRecordByField(empDs.id, "employee_code", user.employeeCode)
            : null;
          const record = empRecord || (email ? await this.getDsRecordByField(empDs.id, "email", email, true) : null);
          if (record) {
            const rawCostCenter = String((record.data as any).cost_center || "").trim();
            console.log(`[storage] getPendingApprovalSteps user=${userId}: employee record found, rawCostCenter="${rawCostCenter}"`);
            if (rawCostCenter) {
              const costCenter = await this.resolveCostCenter(rawCostCenter);
              console.log(`[storage] getPendingApprovalSteps user=${userId}: resolved costCenter="${costCenter}" (from raw="${rawCostCenter}")`);
              groupSteps = await db.select().from(requisitionApprovalSteps)
                .where(and(
                  eq(requisitionApprovalSteps.assignedToGroup, costCenter),
                  eq(requisitionApprovalSteps.decision, "pending")
                ))
                .orderBy(desc(requisitionApprovalSteps.createdAt));
              console.log(`[storage] getPendingApprovalSteps user=${userId}: ${groupSteps.length} group steps found for costCenter="${costCenter}"`);
            } else {
              console.log(`[storage] getPendingApprovalSteps user=${userId}: employee record has no cost_center field`);
            }
          } else {
            console.log(`[storage] getPendingApprovalSteps user=${userId}: no employee record found (email=${email}, employeeCode=${user.employeeCode || "none"})`);
          }
        } else {
          console.log(`[storage] getPendingApprovalSteps user=${userId}: employee-directory data source not found`);
        }
      } else {
        console.log(`[storage] getPendingApprovalSteps user=${userId}: managed user not found`);
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
  async createApprovalStep(step: InsertApprovalStep): Promise<ApprovalStep> {
    const [created] = await db.insert(requisitionApprovalSteps).values(step).returning();
    return created;
  }
  async updateApprovalStep(id: string, data: Partial<ApprovalStep>): Promise<ApprovalStep | undefined> {
    const [updated] = await db.update(requisitionApprovalSteps).set(data).where(eq(requisitionApprovalSteps.id, id)).returning();
    return updated;
  }
  async getCurrentApprovalStep(requisitionId: string): Promise<ApprovalStep | undefined> {
    const [step] = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .orderBy(desc(requisitionApprovalSteps.createdAt))
      .limit(1);
    return step;
  }
  async getUserPendingStepForRequisition(requisitionId: string, userId: string): Promise<ApprovalStep | undefined> {
    const [step] = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedTo, userId),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .limit(1);
    return step;
  }
  async findAndRelinkOrphanedStep(requisitionId: string, userId: string, userName: string): Promise<ApprovalStep | undefined> {
    const trimmedName = userName.trim();
    const [candidate] = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.decision, "pending"),
        isNull(requisitionApprovalSteps.assignedTo),
        ilike(requisitionApprovalSteps.assignedToName, trimmedName)
      ))
      .orderBy(asc(requisitionApprovalSteps.createdAt))
      .limit(1);
    if (!candidate) return undefined;
    const [updated] = await db.update(requisitionApprovalSteps)
      .set({ assignedTo: userId })
      .where(and(
        eq(requisitionApprovalSteps.id, candidate.id),
        isNull(requisitionApprovalSteps.assignedTo)
      ))
      .returning();
    if (updated) {
      console.log(`[approval-relink] Re-linked orphaned step ${updated.id} (assignedToName="${updated.assignedToName}") to user ${userId}`);
      return updated;
    }
    return undefined;
  }
  async hasPendingStepForUser(requisitionId: string, userId: string): Promise<boolean> {
    const step = await this.getUserPendingStepForRequisition(requisitionId, userId);
    if (step) return true;
    const groupStep = await this.hasPendingGroupStepForUserInternal(requisitionId, userId);
    if (groupStep) return true;
    const user = await this.getManagedUser(userId);
    if (user) {
      const displayName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
      const relinked = await this.findAndRelinkOrphanedStep(requisitionId, userId, displayName);
      if (relinked) return true;
    }
    return false;
  }

  async hasAnyStepForUser(requisitionId: string, userId: string): Promise<boolean> {
    const steps = await db.select({ id: requisitionApprovalSteps.id })
      .from(requisitionApprovalSteps)
      .where(
        and(
          eq(requisitionApprovalSteps.requisitionId, requisitionId),
          eq(requisitionApprovalSteps.assignedTo, userId)
        )
      )
      .limit(1);
    return steps.length > 0;
  }

  private async hasPendingGroupStepForUserInternal(requisitionId: string, userId: string): Promise<boolean> {
    const user = await this.getManagedUser(userId);
    if (!user) return false;
    const empDs = await this.getDataSourceBySlug("employee-directory");
    if (!empDs) return false;
    const email = user.email?.trim().toLowerCase();
    let record = null;
    if (user.employeeCode) {
      record = await this.getDsRecordByField(empDs.id, "employee_code", user.employeeCode);
    }
    if (!record && email) {
      record = await this.getDsRecordByField(empDs.id, "email", email, true);
    }
    if (!record) return false;
    const rawCostCenter = String((record.data as any).cost_center || "").trim();
    if (!rawCostCenter) return false;
    const costCenter = await this.resolveCostCenter(rawCostCenter);
    const [step] = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedToGroup, costCenter),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .limit(1);
    return !!step;
  }

  async getPendingApprovalStepsByGroup(groupCostCenter: string, _userId: string): Promise<ApprovalStep[]> {
    return await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.assignedToGroup, groupCostCenter),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .orderBy(desc(requisitionApprovalSteps.createdAt));
  }

  async hasPendingGroupStepForUser(requisitionId: string, groupCostCenter: string): Promise<boolean> {
    const [step] = await db.select().from(requisitionApprovalSteps)
      .where(and(
        eq(requisitionApprovalSteps.requisitionId, requisitionId),
        eq(requisitionApprovalSteps.assignedToGroup, groupCostCenter),
        eq(requisitionApprovalSteps.decision, "pending")
      ))
      .limit(1);
    return !!step;
  }

  async createQuotation(q: InsertRequisitionQuotation): Promise<RequisitionQuotation> {
    const [created] = await db.insert(requisitionQuotations).values(q).returning();
    return created;
  }

  async getQuotationsByRequisition(requisitionId: string): Promise<RequisitionQuotation[]> {
    return await db.select().from(requisitionQuotations)
      .where(eq(requisitionQuotations.requisitionId, requisitionId))
      .orderBy(desc(requisitionQuotations.createdAt));
  }

  async getQuotation(id: string): Promise<RequisitionQuotation | undefined> {
    const [q] = await db.select().from(requisitionQuotations).where(eq(requisitionQuotations.id, id));
    return q;
  }

  async updateQuotation(id: string, data: Partial<RequisitionQuotation>): Promise<RequisitionQuotation | undefined> {
    const [updated] = await db.update(requisitionQuotations).set(data).where(eq(requisitionQuotations.id, id)).returning();
    return updated;
  }

  async deleteQuotation(id: string): Promise<boolean> {
    const [deleted] = await db.delete(requisitionQuotations).where(eq(requisitionQuotations.id, id)).returning();
    return !!deleted;
  }

  async getDsRecordsByField(dataSourceId: string, fieldKey: string, fieldValue: string, caseInsensitive?: boolean): Promise<DsRecord[]> {
    const sanitizedKey = fieldKey.replace(/[^a-zA-Z0-9_]/g, '');
    const fieldExpr = sql`${dsRecords.data}->>${sql.raw(`'${sanitizedKey}'`)}`;
    const matchCondition = caseInsensitive
      ? sql`LOWER(${fieldExpr}) = LOWER(${fieldValue})`
      : sql`${fieldExpr} = ${fieldValue}`;
    return await db.select().from(dsRecords).where(
      and(eq(dsRecords.dataSourceId, dataSourceId), matchCondition)
    );
  }

  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.internalId);
  }

  async getActiveDepartments(): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.inactive, false)).orderBy(departments.name);
  }

  async upsertDepartments(rows: InsertDepartment[]): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const row of rows) {
        const [ex] = await tx.select({ internalId: departments.internalId }).from(departments).where(eq(departments.internalId, row.internalId));
        if (ex) {
          await tx.update(departments).set({
            externalId: row.externalId,
            name: row.name,
            inactive: row.inactive ?? false,
          }).where(eq(departments.internalId, row.internalId));
          updated++;
        } else {
          await tx.insert(departments).values(row);
          imported++;
        }
      }
    });

    return { imported, updated };
  }

  async getDepartment(internalId: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.internalId, internalId));
    return dept;
  }
}

export const storage = new DatabaseStorage();
