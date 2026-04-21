import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin, isSuperAdmin, passwordSchema } from "./helpers";
import {
  type ManagedUser,
  managedUsers,
  pageRegistry,
  insertSectionTemplateSchema,
  insertPageSectionSchema,
} from "@workspace/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/httpError";

async function ensureAccountColumn(ds: any) {
  const columns: any[] = ds.columns || [];
  const existingIndex = columns.findIndex((c: any) => c.key === "account");
  if (existingIndex === -1) {
    const updatedColumns = [...columns, { key: "account", label: "Account", type: "boolean" }];
    await storage.updateDataSource(ds.id, { columns: updatedColumns });
  } else if (columns[existingIndex].type !== "boolean") {
    const updatedColumns = [...columns];
    updatedColumns[existingIndex] = { ...updatedColumns[existingIndex], type: "boolean" };
    await storage.updateDataSource(ds.id, { columns: updatedColumns });
  }
}

async function syncEmployeeAccountField(email: string, isActive: boolean) {
  
  const ds = await storage.getDataSourceBySlug("employee-directory");
  if (!ds) return;
  await ensureAccountColumn(ds);
  const { records } = await storage.getDsRecords(ds.id, { limit: 10000 });
  const normalizedEmail = email.trim().toLowerCase();
  const match = records.find((r: any) => {
    const data = r.data as Record<string, any>;
    return data.email && String(data.email).trim().toLowerCase() === normalizedEmail;
  });
  if (match) {
    await storage.updateDsRecord(match.id, { account: isActive });
  }

}

export async function registerAdminRoutes(app: Express, _httpServer: Server) {
  // Get current user's managed profile
  app.get("/api/me", isAuthenticated, asyncHandler(async (req, res) => {
    const managedUser = (req as any).managedUser as ManagedUser;
    const { password: _, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = managedUser;
    res.json(userWithoutSensitive);
  }));

  app.get("/api/my-services", isAuthenticated, asyncHandler(async (req, res) => {
    const managedUser = (req as any).managedUser as ManagedUser;
    const serviceIds = await storage.getUserServices(managedUser.id);
    res.json(serviceIds);
  }));

  // Admin routes
  app.get("/api/admin/stats", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const stats = await storage.getUserStats();
    res.json(stats);
  }));

  app.get("/api/admin/users", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const users = await storage.getAllManagedUsers();
    const sanitized = users.map(({ password, mfaSecret, mfaBackupCodes, ...rest }) => rest);
    res.json(sanitized);
  }));

  app.get("/api/admin/users/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const user = await storage.getManagedUser(req.params.id);
    if (!user) {
      throw HttpError.notFound("User not found");
    }
    const { password: _, mfaSecret, mfaBackupCodes, ...sanitized } = user;
    res.json(sanitized);
  }));

  app.get("/api/admin/employee-directory/lookup", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || "";
    const ds = await storage.getDataSourceBySlug("employee-directory");
    if (!ds) {
      throw HttpError.notFound("Employee directory data source not found");
    }
    const { records } = await storage.getDsRecords(ds.id, { search, limit: 50 });
    const employees = records.map(r => ({
      id: r.id,
      employeeCode: r.data.employee_code ?? null,
      fullName: (r.data.full_name as string) || "",
      email: (r.data.email as string) || "",
      position: (r.data.position as string) || "",
      department: (r.data.department_english as string) || "",
    }));
    res.json(employees);
  }));

  app.post("/api/admin/sync-employees", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const ds = await storage.getDataSourceBySlug("employee-directory");
    if (!ds) {
      throw HttpError.notFound("Employee directory data source not found");
    }
    await ensureAccountColumn(ds);
    const { records } = await storage.getDsRecords(ds.id, { limit: 10000 });

    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const r of records) {
      const email = ((r.data.email as string) || "").trim().toLowerCase();
      const empCode = r.data.employee_code ? String(r.data.employee_code).trim() : null;
      const hasValidEmail = email && email.includes("@");

      let existing: Awaited<ReturnType<typeof storage.getManagedUserByEmail>> | undefined;
      if (hasValidEmail) {
        existing = await storage.getManagedUserByEmail(email);
      }
      if (!existing && empCode) {
        existing = await storage.getManagedUserByEmployeeCode(empCode);
      }
      if (existing) {
        if (existing.role === "superadmin") {
          skipped++;
          continue;
        }
        
        await storage.updateDsRecord(r.id, { account: existing.isActive });
        updated++;
      
        skipped++;
        continue;
      }

      if (!hasValidEmail) {
        skipped++;
        continue;
      }

      const fullName = ((r.data.full_name as string) || "").trim();
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
      let username = baseUsername;
      let suffix = 1;
      while (await storage.getManagedUserByUsername(username)) {
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      const randomPassword = Array.from({ length: 16 }, () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%"[Math.floor(Math.random() * 69)]
      ).join("");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = await storage.createManagedUser({
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: "others",
        isActive: false,
        employeeCode: empCode,
      });
      
      await storage.updateDsRecord(r.id, { account: newUser.isActive });
    
      created++;
    }

    res.json({ created, skipped, updated, total: records.length });
  }));

  app.post("/api/admin/fix-employee-accounts", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const ds = await storage.getDataSourceBySlug("employee-directory");
    if (!ds) {
      throw HttpError.notFound("Employee directory data source not found");
    }
    await ensureAccountColumn(ds);
    const { records } = await storage.getDsRecords(ds.id, { limit: 10000 });
    let fixed = 0;

    for (const r of records) {
      const email = ((r.data.email as string) || "").trim().toLowerCase();
      const empCode = r.data.employee_code ? String(r.data.employee_code).trim() : null;

      let user = email ? await storage.getManagedUserByEmail(email) : undefined;
      if (!user && empCode) {
        user = await storage.getManagedUserByEmployeeCode(empCode);
      }
      if (user) {
        if (user.role === "superadmin") {
          continue;
        }
        const currentAccount = r.data.account;
        if (currentAccount !== user.isActive) {
          
          await storage.updateDsRecord(r.id, { account: user.isActive });
          fixed++;
        
        }
      }
    }

    res.json({ fixed, total: records.length });
  }));

  const createUserSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
    password: passwordSchema,
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    employeeCode: z.string().optional().nullable(),
    role: z.enum(["superadmin", "admin", "others"]).default("others"),
  });

  app.post("/api/admin/users", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const parsed = { data: createUserSchema.parse(req.body) } as const;

    const currentUser = (req as any).managedUser as ManagedUser;
    if (currentUser.role !== "superadmin" && parsed.data.role === "superadmin") {
      throw HttpError.forbidden("Only superadmins can create superadmin accounts");
    }

    // Check if email or username already exists
    const existingUser = await storage.getManagedUserByEmail(parsed.data.email);
    if (existingUser) {
      throw HttpError.conflict("User with this email already exists");
    }

    const existingUsername = await storage.getManagedUserByUsername(parsed.data.username);
    if (existingUsername) {
      throw HttpError.conflict("Username already taken");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

    const user = await storage.createManagedUser({
      ...parsed.data,
      password: hashedPassword,
      isActive: true,
      lastActiveAt: null,
    });

    // Return user without sensitive fields
    const { password: _, mfaSecret, mfaBackupCodes, ...sanitized } = user;
    res.status(201).json(sanitized);
  }));

  const updateUserSchema = z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).max(50).optional(),
    password: passwordSchema.optional(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    employeeCode: z.string().optional().nullable(),
    role: z.enum(["superadmin", "admin", "others"]).optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const parsed = { data: updateUserSchema.parse(req.body) } as const;

    const currentUser = (req as any).managedUser as ManagedUser;
    const targetUser = await storage.getManagedUser(req.params.id);
      
    if (!targetUser) {
      throw HttpError.notFound("User not found");
    }

    if (currentUser.role !== "superadmin") {
      if (targetUser.role === "superadmin") {
        throw HttpError.forbidden("Only superadmins can modify superadmin accounts");
      }
      if (parsed.data.role === "superadmin") {
        throw HttpError.forbidden("Only superadmins can assign the superadmin role");
      }
    }

    // Prevent demoting an admin if they're the only admin
    if (targetUser.role === "admin" && parsed.data.role && parsed.data.role !== "admin") {
      const stats = await storage.getUserStats();
      const adminCount = stats.roleDistribution.find(r => r.role === "admin")?.count || 0;
      if (adminCount <= 1) {
        throw HttpError.badRequest("Cannot demote the only admin");
      }
    }

    // Hash password if provided
    const updateData = { ...parsed.data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const user = await storage.updateManagedUser(req.params.id, updateData);
    if (user) {
      if (parsed.data.isActive !== undefined && parsed.data.isActive !== targetUser.isActive) {
        await syncEmployeeAccountField(targetUser.email, parsed.data.isActive);
        if (parsed.data.email && parsed.data.email !== targetUser.email) {
          await syncEmployeeAccountField(parsed.data.email, parsed.data.isActive);
        }
      }
      const { password: _, mfaSecret, mfaBackupCodes, ...sanitized } = user;
      res.json(sanitized);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  }));

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
      
    // Prevent self-deletion
    if (currentUser.id === req.params.id) {
      throw HttpError.badRequest("Cannot delete your own account");
    }

    const targetUser = await storage.getManagedUser(req.params.id);
    if (!targetUser) {
      throw HttpError.notFound("User not found");
    }

    if (currentUser.role !== "superadmin" && targetUser.role === "superadmin") {
      throw HttpError.forbidden("Only superadmins can delete superadmin accounts");
    }

    // Prevent deleting the only admin
    if (targetUser.role === "admin") {
      const stats = await storage.getUserStats();
      const adminCount = stats.roleDistribution.find(r => r.role === "admin")?.count || 0;
      if (adminCount <= 1) {
        throw HttpError.badRequest("Cannot delete the only admin");
      }
    }

    await storage.deleteManagedUser(req.params.id);
      
    // Log the action
    await storage.createAuditLog({
      action: "user_deleted",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { deletedUserId: req.params.id, deletedUserEmail: targetUser.email },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });
      
    res.status(204).send();
  }));

  // Get user services
  app.get("/api/admin/users/:id/services", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const serviceIds = await storage.getUserServices(req.params.id);
    res.json(serviceIds);
  }));

  // Set user services
  app.put("/api/admin/users/:id/services", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const schema = z.object({ serviceIds: z.array(z.string()) });
    const parsed = { data: schema.parse(req.body) } as const;
    await storage.setUserServices(req.params.id, parsed.data.serviceIds);
    res.json({ success: true });
  }));

  // Get user submodule permissions
  app.get("/api/admin/users/:id/submodules", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const user = await storage.getManagedUser(req.params.id);
    if (!user) throw HttpError.notFound("User not found");
    res.json(user.allowedSubmodules || {});
  }));

  // Update user submodule permissions
  app.put("/api/admin/users/:id/submodules", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const schema = z.object({ allowedSubmodules: z.record(z.array(z.string())) });
    const parsed = { data: schema.parse(req.body) } as const;
    await storage.updateManagedUser(req.params.id, { allowedSubmodules: parsed.data.allowedSubmodules } as any);
    res.json({ success: true });
  }));

  app.get("/api/admin/users/:id/pages", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const user = await storage.getManagedUser(req.params.id);
    if (!user) throw HttpError.notFound("User not found");
    res.json(user.allowedPages || []);
  }));

  app.put("/api/admin/users/:id/pages", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const validPaths = pageRegistry.map(p => p.path);
    const schema = z.object({ allowedPages: z.array(z.string().refine(p => validPaths.includes(p), { message: "Invalid page path" })) });
    const parsed = { data: schema.parse(req.body) } as const;
    const unique = Array.from(new Set(parsed.data.allowedPages));
    const pages = unique.length > 0 ? unique : null;
    await storage.updateManagedUser(req.params.id, { allowedPages: pages } as any);
    res.json({ success: true });
  }));


  // ===== EXTERNAL SERVICES =====
  
  // Public endpoint for enabled services (used by sidebar)
  app.get("/api/services/enabled", isAuthenticated, asyncHandler(async (_req, res) => {
    const services = await storage.getEnabledExternalServices();
    res.json(services);
  }));
  
  app.get("/api/services/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const service = await storage.getExternalService(req.params.id);
    if (!service) {
      throw HttpError.notFound("Service not found");
    }
    res.json(service);
  }));

  // ===== SYSTEM SETTINGS (Configuration tab) =====

  app.get("/api/admin/settings", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const settings = await storage.getAllSystemSettings();
    // Mask encrypted values
    const masked = settings.map((s) => ({
      ...s,
      value: s.isEncrypted ? "********" : s.value,
    }));
    res.json(masked);
  }));

  const upsertSettingSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    category: z.enum(["general", "integration", "security"]).default("general"),
    isEncrypted: z.boolean().default(false),
  });

  const validateNetSuiteUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && url.includes("restlet");
    } catch {
      return false;
    }
  };

  app.post("/api/admin/settings", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
    const parsed = upsertSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }

    if (parsed.data.key.includes("netsuite") && parsed.data.key.includes("url") && parsed.data.value) {
      if (!validateNetSuiteUrl(parsed.data.value)) {
        throw HttpError.badRequest("Invalid NetSuite RESTlet URL format. Must be a valid HTTPS URL.");
      }
    }

    const setting = await storage.upsertSystemSetting({
      ...parsed.data,
      updatedBy: currentUser.id,
    });

    await storage.createAuditLog({
      action: "setting_updated",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { settingKey: parsed.data.key, isEncrypted: parsed.data.isEncrypted },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });

    res.json({
      ...setting,
      value: setting.isEncrypted ? "********" : setting.value,
    });
  }));

  app.delete("/api/admin/settings/:key", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
    const deleted = await storage.deleteSystemSetting(req.params.key);
    if (!deleted) {
      throw HttpError.notFound("Setting not found");
    }
    await storage.createAuditLog({
      action: "setting_deleted",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { settingKey: req.params.key },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });
    res.status(204).send();
  }));

  // ===== AUDIT LOGS tab =====

  app.get("/api/admin/audit-logs", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const category = req.query.category as string | undefined;
    const action = req.query.action as string | undefined;
    const search = req.query.search as string | undefined;
    const result = await storage.getAuditLogs({ limit, offset, category, action, search });
    res.json(result);
  }));

  // ===== HEALTH CHECK tab =====

  app.get("/api/admin/health-check", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const services = await storage.getExternalServices();
    const enabledServices = services.filter((s) => s.isEnabled);
    const allTickets = await storage.getAllTickets({ limit: 1000, offset: 0 });
    const allUsers = await storage.getAllManagedUsers();

    const now = Date.now();
    const serviceHealthData = enabledServices.map((service) => {
      const uptime = 95 + Math.random() * 5;
      const responseTime = 50 + Math.random() * 200;
      const statuses: Array<"operational" | "degraded" | "down"> = [
        "operational", "operational", "operational", "operational", "operational",
        "operational", "operational", "operational", "operational", "degraded",
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      return {
        id: service.id,
        name: service.name,
        url: service.url,
        icon: service.icon,
        category: service.category,
        status,
        uptime: Math.round(uptime * 100) / 100,
        responseTime: Math.round(responseTime),
        lastChecked: new Date(now - Math.floor(Math.random() * 300000)).toISOString(),
      };
    });

    const totalServices = enabledServices.length;
    const operationalCount = serviceHealthData.filter((s) => s.status === "operational").length;
    const degradedCount = serviceHealthData.filter((s) => s.status === "degraded").length;
    const downCount = serviceHealthData.filter((s) => s.status === "down").length;
    const avgUptime = serviceHealthData.length > 0
      ? Math.round(serviceHealthData.reduce((sum, s) => sum + s.uptime, 0) / serviceHealthData.length * 100) / 100
      : 0;
    const avgResponseTime = serviceHealthData.length > 0
      ? Math.round(serviceHealthData.reduce((sum, s) => sum + s.responseTime, 0) / serviceHealthData.length)
      : 0;

    const openTickets = allTickets.tickets.filter(
      (t: { status: string }) => t.status !== "resolved" && t.status !== "closed",
    ).length;
    const activeUsers = allUsers.filter((u: { isActive: boolean }) => u.isActive).length;

    res.json({
      services: serviceHealthData,
      summary: {
        totalServices,
        operationalCount,
        degradedCount,
        downCount,
        avgUptime,
        avgResponseTime,
        openTickets,
        activeUsers,
        totalUsers: allUsers.length,
      },
    });
  }));

  // ===== INTEGRATIONS HEALTH tab =====

  app.get("/api/admin/integrations/health", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const healthStatus = [
      {
        name: "NetSuite API",
        status: "healthy" as const,
        lastChecked: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 200) + 50,
      },
      {
        name: "HR System",
        status: Math.random() > 0.1 ? ("healthy" as const) : ("degraded" as const),
        lastChecked: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 300) + 100,
      },
      {
        name: "Livery Tracking",
        status: "healthy" as const,
        lastChecked: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 150) + 30,
      },
    ];
    res.json(healthStatus);
  }));

  // ===== EXTERNAL SERVICES CRUD (Integrations tab) =====

  app.get("/api/admin/services", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const services = await storage.getExternalServices();
    res.json(services);
  }));

  const createServiceSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    url: z.string().max(500).optional().nullable(),
    icon: z.string().max(100).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    color: z.string().max(50).optional().nullable(),
  });

  app.post("/api/admin/services", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const { color: _color, sortOrder: rawSort, category: rawCat, ...serviceRest } = parsed.data;
    let service = await storage.createExternalService({
      ...serviceRest,
      category: rawCat ?? undefined,
      sortOrder: rawSort != null ? String(rawSort) : undefined,
    });

    if (!service.url) {
      const updated = await storage.updateExternalService(service.id, { url: `/services/${service.id}` });
      if (updated) service = updated;
    }

    // Auto-attach a hero banner section if template exists
    const heroTemplate = await storage.getSectionTemplateByType("hero_banner");
    if (heroTemplate) {
      await storage.createPageSection({
        serviceId: service.id,
        sectionTemplateId: heroTemplate.id,
        title: service.name,
        subtitle: service.description || "",
        icon: "LayoutDashboard",
        sortOrder: 0,
        isEnabled: true,
        isExpandable: false,
        config: null,
      });
    }

    await storage.createAuditLog({
      action: "service_created",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { serviceName: req.body.name },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });
    res.status(201).json(service);
  }));

  app.patch("/api/admin/services/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
    const parsedService = createServiceSchema.partial().safeParse(req.body);
    if (!parsedService.success) {
      throw HttpError.badRequest(`Invalid input: ${parsedService.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const { color: _color2, sortOrder: rawSort2, category: rawCat2, ...updateRest } = parsedService.data;
    const service = await storage.updateExternalService(req.params.id, {
      ...updateRest,
      ...(rawCat2 !== undefined ? { category: rawCat2 ?? undefined } : {}),
      ...(rawSort2 !== undefined ? { sortOrder: String(rawSort2) } : {}),
    });
    if (!service) {
      throw HttpError.notFound("Service not found");
    }
    await storage.createAuditLog({
      action: "service_updated",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { serviceId: req.params.id, changes: req.body },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });
    res.json(service);
  }));

  app.delete("/api/admin/services/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const currentUser = (req as any).managedUser as ManagedUser;
    const deleted = await storage.deleteExternalService(req.params.id);
    if (!deleted) {
      throw HttpError.notFound("Service not found");
    }
    await storage.createAuditLog({
      action: "service_deleted",
      category: "admin",
      userId: currentUser.id,
      userEmail: currentUser.email,
      details: { serviceId: req.params.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      status: "success",
    });
    res.status(204).send();
  }));

  // ===== SECTION TEMPLATES (Page Sections tab) =====

  app.get("/api/admin/section-templates", isAuthenticated, isAdmin, asyncHandler(async (_req, res) => {
    const templates = await storage.getAllSectionTemplates();
    res.json(templates);
  }));

  app.post("/api/admin/section-templates", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const parsed = insertSectionTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const template = await storage.createSectionTemplate(parsed.data);
    res.status(201).json(template);
  }));

  app.patch("/api/admin/section-templates/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const parsed = insertSectionTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const template = await storage.updateSectionTemplate(req.params.id, parsed.data);
    if (!template) {
      throw HttpError.notFound("Section template not found");
    }
    res.json(template);
  }));

  app.delete("/api/admin/section-templates/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const deleted = await storage.deleteSectionTemplate(req.params.id);
    if (!deleted) {
      throw HttpError.notFound("Section template not found");
    }
    res.status(204).send();
  }));

  // ===== PAGE SECTIONS (Page Sections tab) =====

  app.get("/api/services/:serviceId/sections", isAuthenticated, asyncHandler(async (req, res) => {
    const sections = await storage.getPageSectionsByService(req.params.serviceId);
    res.json(sections);
  }));

  app.post("/api/admin/services/:serviceId/sections", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const data: Record<string, any> = { ...req.body, serviceId: req.params.serviceId };
    if (data.sectionTemplateId) {
      const template = await storage.getSectionTemplate(data.sectionTemplateId);
      if (template) {
        if (!data.icon && template.icon) data.icon = template.icon;
        if (!data.config && template.defaultConfig) data.config = template.defaultConfig;
      }
    }
    const parsed = insertPageSectionSchema.safeParse(data);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const section = await storage.createPageSection(parsed.data);
    res.status(201).json(section);
  }));

  app.patch("/api/admin/sections/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const data: Record<string, any> = { ...req.body };
    if (data.sectionTemplateId) {
      const template = await storage.getSectionTemplate(data.sectionTemplateId);
      if (template) {
        if (!data.icon && template.icon) data.icon = template.icon;
        if (!data.config && template.defaultConfig) data.config = template.defaultConfig;
      }
    }
    const parsed = insertPageSectionSchema.partial().safeParse(data);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    const section = await storage.updatePageSection(req.params.id, parsed.data);
    if (!section) {
      throw HttpError.notFound("Page section not found");
    }
    res.json(section);
  }));

  app.delete("/api/admin/sections/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const deleted = await storage.deletePageSection(req.params.id);
    if (!deleted) {
      throw HttpError.notFound("Page section not found");
    }
    res.status(204).send();
  }));

  app.put("/api/admin/services/:serviceId/sections/reorder", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const schema = z.object({ sectionIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest(`Invalid input: ${parsed.error.errors.map(e => `${e.path.join(".")} - ${e.message}`).join("; ")}`);
    }
    await storage.reorderPageSections(req.params.serviceId, parsed.data.sectionIds);
    res.json({ success: true });
  }));

  // ===== ICON LIBRARY =====

  app.get("/api/icons", isAuthenticated, asyncHandler(async (_req, res) => {
    const icons = await storage.getAllIcons();
    res.json(icons);
  }));

  app.post("/api/admin/icons", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const { name, label, category, description } = req.body || {};
    if (!name || !label) {
      throw HttpError.badRequest("Name and label are required");
    }
    const existing = await storage.getIconByName(name);
    if (existing) {
      throw HttpError.conflict("An icon with this name already exists in the library");
    }
    const icon = await storage.createIcon({
      name,
      label,
      category: category || "custom",
      description: description || null,
      isCustom: true,
    });
    res.status(201).json(icon);
  }));

  app.delete("/api/admin/icons/:id", isAuthenticated, isAdmin, asyncHandler(async (req, res) => {
    const deleted = await storage.deleteIcon(req.params.id);
    if (!deleted) {
      throw HttpError.notFound("Icon not found");
    }
    res.json({ success: true });
  }));

}
