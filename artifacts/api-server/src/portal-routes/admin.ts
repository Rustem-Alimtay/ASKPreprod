import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin, isSuperAdmin, passwordSchema } from "./helpers";
import { type ManagedUser, managedUsers, pageRegistry } from "@workspace/db";
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

}
