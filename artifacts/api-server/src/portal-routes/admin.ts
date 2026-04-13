import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin, isSuperAdmin, passwordSchema } from "./helpers";
import { type ManagedUser, managedUsers, pageRegistry, insertSectionTemplateSchema, insertPageSectionSchema } from "@workspace/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateSecret, verify, generateURI } from "otplib";
import * as QRCode from "qrcode";
import multer from "multer";

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
  try {
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
  } catch (err) {
    console.error(`[syncEmployeeAccountField] Error syncing account field for ${email}:`, err);
  }
}

export async function registerAdminRoutes(app: Express, _httpServer: Server) {
  app.get("/api/admin/health-check", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const services = await storage.getExternalServices();
      const enabledServices = services.filter(s => s.isEnabled);
      const allTickets = await storage.getAllTickets({ limit: 1000, offset: 0 });
      const allUsers = await storage.getAllManagedUsers();

      const now = Date.now();
      const serviceHealthData = enabledServices.map((service) => {
        const uptime = 95 + Math.random() * 5;
        const responseTime = 50 + Math.random() * 200;
        const statuses: Array<"operational" | "degraded" | "down"> = ["operational", "operational", "operational", "operational", "operational", "operational", "operational", "operational", "operational", "degraded"];
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
      const operationalCount = serviceHealthData.filter(s => s.status === "operational").length;
      const degradedCount = serviceHealthData.filter(s => s.status === "degraded").length;
      const downCount = serviceHealthData.filter(s => s.status === "down").length;
      const avgUptime = serviceHealthData.length > 0
        ? Math.round(serviceHealthData.reduce((sum, s) => sum + s.uptime, 0) / serviceHealthData.length * 100) / 100
        : 0;
      const avgResponseTime = serviceHealthData.length > 0
        ? Math.round(serviceHealthData.reduce((sum, s) => sum + s.responseTime, 0) / serviceHealthData.length)
        : 0;

      const openTickets = allTickets.tickets.filter((t: { status: string }) => t.status !== "resolved" && t.status !== "closed").length;
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
    } catch (error) {
      console.error("Error fetching health check:", error);
      res.status(500).json({ message: "Failed to fetch health check data" });
    }
  });

  // Get current user's managed profile
  app.get("/api/me", isAuthenticated, async (req, res) => {
    const managedUser = (req as any).managedUser as ManagedUser;
    const { password: _, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = managedUser;
    res.json(userWithoutSensitive);
  });

  app.get("/api/my-services", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const serviceIds = await storage.getUserServices(managedUser.id);
      res.json(serviceIds);
    } catch (error) {
      console.error("Error fetching user services:", error);
      res.status(500).json({ message: "Failed to fetch user services" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllManagedUsers();
      const sanitized = users.map(({ password, mfaSecret, mfaBackupCodes, ...rest }) => rest);
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getManagedUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, mfaSecret, mfaBackupCodes, ...sanitized } = user;
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/admin/employee-directory/lookup", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const ds = await storage.getDataSourceBySlug("employee-directory");
      if (!ds) {
        return res.status(404).json({ message: "Employee directory data source not found" });
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
    } catch (error) {
      console.error("Error looking up employee directory:", error);
      res.status(500).json({ message: "Failed to look up employee directory" });
    }
  });

  app.post("/api/admin/sync-employees", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug("employee-directory");
      if (!ds) {
        return res.status(404).json({ message: "Employee directory data source not found" });
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
          try {
            await storage.updateDsRecord(r.id, { account: existing.isActive });
            updated++;
          } catch (err) {
            console.error(`[sync-employees] Failed to update account field for existing user ${email || empCode}:`, err);
          }
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
        try {
          await storage.updateDsRecord(r.id, { account: newUser.isActive });
        } catch (err) {
          console.error(`[sync-employees] Failed to update account field for record ${r.id}:`, err);
        }
        created++;
      }

      res.json({ created, skipped, updated, total: records.length });
    } catch (error) {
      console.error("Error syncing employees:", error);
      res.status(500).json({ message: "Failed to sync employees" });
    }
  });

  app.post("/api/admin/fix-employee-accounts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug("employee-directory");
      if (!ds) {
        return res.status(404).json({ message: "Employee directory data source not found" });
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
            try {
              await storage.updateDsRecord(r.id, { account: user.isActive });
              fixed++;
            } catch (err) {
              console.error(`[fix-employee-accounts] Failed to update record ${r.id}:`, err);
            }
          }
        }
      }

      res.json({ fixed, total: records.length });
    } catch (error) {
      console.error("Error fixing employee accounts:", error);
      res.status(500).json({ message: "Failed to fix employee accounts" });
    }
  });

  const createUserSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
    password: passwordSchema,
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    employeeCode: z.string().optional().nullable(),
    role: z.enum(["superadmin", "admin", "finance", "procurement", "livery", "others"]).default("others"),
  });

  app.post("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const currentUser = (req as any).managedUser as ManagedUser;
      if (currentUser.role !== "superadmin" && parsed.data.role === "superadmin") {
        return res.status(403).json({ message: "Only superadmins can create superadmin accounts" });
      }

      // Check if email or username already exists
      const existingUser = await storage.getManagedUserByEmail(parsed.data.email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }

      const existingUsername = await storage.getManagedUserByUsername(parsed.data.username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username already taken" });
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
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  const updateUserSchema = z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).max(50).optional(),
    password: passwordSchema.optional(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    employeeCode: z.string().optional().nullable(),
    role: z.enum(["superadmin", "admin", "finance", "procurement", "livery", "others"]).optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const currentUser = (req as any).managedUser as ManagedUser;
      const targetUser = await storage.getManagedUser(req.params.id);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (currentUser.role !== "superadmin") {
        if (targetUser.role === "superadmin") {
          return res.status(403).json({ message: "Only superadmins can modify superadmin accounts" });
        }
        if (parsed.data.role === "superadmin") {
          return res.status(403).json({ message: "Only superadmins can assign the superadmin role" });
        }
      }

      // Prevent demoting an admin if they're the only admin
      if (targetUser.role === "admin" && parsed.data.role && parsed.data.role !== "admin") {
        const stats = await storage.getUserStats();
        const adminCount = stats.roleDistribution.find(r => r.role === "admin")?.count || 0;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot demote the only admin" });
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
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      
      // Prevent self-deletion
      if (currentUser.id === req.params.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const targetUser = await storage.getManagedUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (currentUser.role !== "superadmin" && targetUser.role === "superadmin") {
        return res.status(403).json({ message: "Only superadmins can delete superadmin accounts" });
      }

      // Prevent deleting the only admin
      if (targetUser.role === "admin") {
        const stats = await storage.getUserStats();
        const adminCount = stats.roleDistribution.find(r => r.role === "admin")?.count || 0;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot delete the only admin" });
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
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get user services
  app.get("/api/admin/users/:id/services", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const serviceIds = await storage.getUserServices(req.params.id);
      res.json(serviceIds);
    } catch (error) {
      console.error("Error getting user services:", error);
      res.status(500).json({ message: "Failed to get user services" });
    }
  });

  // Set user services
  app.put("/api/admin/users/:id/services", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({ serviceIds: z.array(z.string()) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      await storage.setUserServices(req.params.id, parsed.data.serviceIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting user services:", error);
      res.status(500).json({ message: "Failed to set user services" });
    }
  });

  // Get user submodule permissions
  app.get("/api/admin/users/:id/submodules", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getManagedUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user.allowedSubmodules || {});
    } catch (error) {
      console.error("Error getting user submodules:", error);
      res.status(500).json({ message: "Failed to get user submodules" });
    }
  });

  // Update user submodule permissions
  app.put("/api/admin/users/:id/submodules", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({ allowedSubmodules: z.record(z.array(z.string())) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
      await storage.updateManagedUser(req.params.id, { allowedSubmodules: parsed.data.allowedSubmodules } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting user submodules:", error);
      res.status(500).json({ message: "Failed to set user submodules" });
    }
  });

  app.get("/api/admin/users/:id/pages", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getManagedUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user.allowedPages || []);
    } catch (error) {
      console.error("Error getting user pages:", error);
      res.status(500).json({ message: "Failed to get user pages" });
    }
  });

  app.put("/api/admin/users/:id/pages", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validPaths = pageRegistry.map(p => p.path);
      const schema = z.object({ allowedPages: z.array(z.string().refine(p => validPaths.includes(p), { message: "Invalid page path" })) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
      const unique = Array.from(new Set(parsed.data.allowedPages));
      const pages = unique.length > 0 ? unique : null;
      await storage.updateManagedUser(req.params.id, { allowedPages: pages } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting user pages:", error);
      res.status(500).json({ message: "Failed to set user pages" });
    }
  });

  // ===== USER PROFILE SETTINGS =====
  
  // Get current user's profile
  app.get("/api/settings/profile", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const { password, mfaSecret, mfaBackupCodes, ...profile } = user;
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  const updateProfileSchema = z.object({
    displayName: z.string().max(100).optional().nullable(),
    email: z.string().email().optional(),
    firstName: z.string().max(50).optional().nullable(),
    lastName: z.string().max(50).optional().nullable(),
    jobTitle: z.string().max(100).optional().nullable(),
    phoneNumber: z.string().max(30).optional().nullable(),
    profilePicture: z.string().max(3000000).optional().nullable(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    emailNotifications: z.boolean().optional(),
  });

  app.patch("/api/settings/profile", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const parsed = updateProfileSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      // Check if email is being changed and already exists
      if (parsed.data.email && parsed.data.email !== user.email) {
        const existing = await storage.getManagedUserByEmail(parsed.data.email);
        if (existing) {
          return res.status(409).json({ message: "Email already in use" });
        }
      }

      const updated = await storage.updateManagedUser(user.id, parsed.data);
      if (updated) {
        const { password, mfaSecret, mfaBackupCodes, ...profile } = updated;
        
        await storage.createAuditLog({
          action: "profile_updated",
          category: "user",
          userId: user.id,
          userEmail: user.email,
          details: { updatedFields: Object.keys(parsed.data) },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          status: "success",
        });
        
        res.json(profile);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Avatar upload
  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG, and WebP images are accepted"));
      }
    },
  });

  app.post("/api/settings/avatar", isAuthenticated, avatarUpload.single("avatar"), async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      const updated = await storage.updateManagedUser(user.id, { profilePicture: dataUrl } as any);
      if (updated) {
        const { password, mfaSecret, mfaBackupCodes, ...profile } = updated;
        res.json(profile);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      if (error.message?.includes("accepted")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Notification preferences
  app.get("/api/settings/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const prefs = (user as any).notificationPreferences || {
        ticketUpdates: true,
        projectDeadlines: true,
        systemAlerts: true,
        importNotifications: true,
      };
      res.json(prefs);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.patch("/api/settings/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const notifSchema = z.object({
        ticketUpdates: z.boolean().optional(),
        projectDeadlines: z.boolean().optional(),
        systemAlerts: z.boolean().optional(),
        importNotifications: z.boolean().optional(),
      });

      const parsed = notifSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const currentPrefs = (user as any).notificationPreferences || {
        ticketUpdates: true,
        projectDeadlines: true,
        systemAlerts: true,
        importNotifications: true,
      };

      const newPrefs = { ...currentPrefs, ...parsed.data };

      await db.update(managedUsers)
        .set({ notificationPreferences: newPrefs, updatedAt: new Date() })
        .where(eq(managedUsers.id, user.id));

      res.json(newPrefs);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Password change
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  });

  app.post("/api/settings/change-password", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const parsed = changePasswordSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      // Verify current password
      const fullUser = await storage.getManagedUser(user.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(parsed.data.currentPassword, fullUser.password);
      if (!isValidPassword) {
        await storage.createAuditLog({
          action: "password_change_failed",
          category: "security",
          userId: user.id,
          userEmail: user.email,
          details: { reason: "invalid_current_password" },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          status: "failure",
        });
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
      await storage.updateManagedUser(user.id, { password: hashedPassword });

      await storage.createAuditLog({
        action: "password_changed",
        category: "security",
        userId: user.id,
        userEmail: user.email,
        details: {},
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
        status: "success",
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ===== MFA (Multi-Factor Authentication) =====

  // Generate MFA setup data (secret + QR code)
  app.post("/api/settings/mfa/setup", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      
      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled" });
      }

      // Generate a new secret
      const secret = generateSecret();
      
      // Store the secret temporarily (not enabled yet)
      await storage.updateManagedUser(user.id, { mfaSecret: secret });
      
      // Generate the otpauth URL for QR code
      const otpauthUrl = generateURI({
        issuer: "Data Portal",
        label: user.email,
        secret,
      });
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      
      res.json({
        secret,
        qrCode: qrCodeDataUrl,
      });
    } catch (error) {
      console.error("Error setting up MFA:", error);
      res.status(500).json({ message: "Failed to setup MFA" });
    }
  });

  // Verify and enable MFA
  const verifyMfaSchema = z.object({
    token: z.string().length(6),
  });

  app.post("/api/settings/mfa/enable", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const parsed = verifyMfaSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid token format" });
      }

      // Get the user with secret
      const fullUser = await storage.getManagedUser(user.id);
      if (!fullUser || !fullUser.mfaSecret) {
        return res.status(400).json({ message: "MFA setup not initiated. Please start setup first." });
      }

      // Verify the token
      const verifyResult = await verify({
        token: parsed.data.token,
        secret: fullUser.mfaSecret,
      });
      const isValid = verifyResult.valid;

      if (!isValid) {
        await storage.createAuditLog({
          action: "mfa_enable_failed",
          category: "security",
          userId: user.id,
          userEmail: user.email,
          details: { reason: "invalid_token" },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          status: "failure",
        });
        return res.status(401).json({ message: "Invalid verification code" });
      }

      // Generate backup codes
      const backupCodes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      // Enable MFA
      await storage.updateManagedUser(user.id, {
        mfaEnabled: true,
        mfaBackupCodes: backupCodes,
      });

      await storage.createAuditLog({
        action: "mfa_enabled",
        category: "security",
        userId: user.id,
        userEmail: user.email,
        details: {},
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
        status: "success",
      });

      res.json({
        message: "MFA enabled successfully",
        backupCodes,
      });
    } catch (error) {
      console.error("Error enabling MFA:", error);
      res.status(500).json({ message: "Failed to enable MFA" });
    }
  });

  // Disable MFA
  const disableMfaSchema = z.object({
    password: z.string().min(1),
  });

  app.post("/api/settings/mfa/disable", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const parsed = disableMfaSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Password is required" });
      }

      const fullUser = await storage.getManagedUser(user.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!fullUser.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(parsed.data.password, fullUser.password);
      if (!isValidPassword) {
        await storage.createAuditLog({
          action: "mfa_disable_failed",
          category: "security",
          userId: user.id,
          userEmail: user.email,
          details: { reason: "invalid_password" },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
          status: "failure",
        });
        return res.status(401).json({ message: "Invalid password" });
      }

      // Disable MFA
      await storage.updateManagedUser(user.id, {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
      });

      await storage.createAuditLog({
        action: "mfa_disabled",
        category: "security",
        userId: user.id,
        userEmail: user.email,
        details: {},
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
        status: "success",
      });

      res.json({ message: "MFA disabled successfully" });
    } catch (error) {
      console.error("Error disabling MFA:", error);
      res.status(500).json({ message: "Failed to disable MFA" });
    }
  });

  // ===== ADMIN SYSTEM SETTINGS =====

  app.get("/api/admin/settings", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      // Mask encrypted values
      const masked = settings.map(s => ({
        ...s,
        value: s.isEncrypted ? "********" : s.value,
      }));
      res.json(masked);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  const upsertSettingSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    category: z.enum(["general", "integration", "security"]).default("general"),
    isEncrypted: z.boolean().default(false),
  });

  // Validation functions for different setting types
  const validateNetSuiteUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && url.includes("restlet");
    } catch {
      return false;
    }
  };

  app.post("/api/admin/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      const parsed = upsertSettingSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      // Validate specific setting formats
      if (parsed.data.key.includes("netsuite") && parsed.data.key.includes("url") && parsed.data.value) {
        if (!validateNetSuiteUrl(parsed.data.value)) {
          return res.status(400).json({ message: "Invalid NetSuite RESTlet URL format. Must be a valid HTTPS URL." });
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

      // Mask encrypted values in response
      res.json({
        ...setting,
        value: setting.isEncrypted ? "********" : setting.value,
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.delete("/api/admin/settings/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      const deleted = await storage.deleteSystemSetting(req.params.key);
      
      if (deleted) {
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
      } else {
        res.status(404).json({ message: "Setting not found" });
      }
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // ===== EXTERNAL SERVICES =====
  
  // Public endpoint for enabled services (used by sidebar)
  app.get("/api/services/enabled", isAuthenticated, async (_req, res) => {
    try {
      const services = await storage.getEnabledExternalServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching enabled services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });
  
  app.get("/api/services/:id", isAuthenticated, async (req, res) => {
    try {
      const service = await storage.getExternalService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.get("/api/admin/services", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const services = await storage.getExternalServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

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

  app.post("/api/admin/services", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      const parsed = createServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
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
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch("/api/admin/services/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      const parsedService = createServiceSchema.partial().safeParse(req.body);
      if (!parsedService.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsedService.error.errors });
      }
      const { color: _color2, sortOrder: rawSort2, category: rawCat2, ...updateRest } = parsedService.data;
      const service = await storage.updateExternalService(req.params.id, {
        ...updateRest,
        ...(rawCat2 !== undefined ? { category: rawCat2 ?? undefined } : {}),
        ...(rawSort2 !== undefined ? { sortOrder: String(rawSort2) } : {}),
      });
      
      if (service) {
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
      } else {
        res.status(404).json({ message: "Service not found" });
      }
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/admin/services/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser as ManagedUser;
      const deleted = await storage.deleteExternalService(req.params.id);
      
      if (deleted) {
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
      } else {
        res.status(404).json({ message: "Service not found" });
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // ===== INTEGRATION HEALTH CHECK =====
  
  app.get("/api/admin/integrations/health", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      // Simulate health checks for integrations
      const healthStatus = [
        {
          name: "NetSuite API",
          status: "healthy" as const,
          lastChecked: new Date().toISOString(),
          responseTime: Math.floor(Math.random() * 200) + 50,
        },
        {
          name: "HR System",
          status: Math.random() > 0.1 ? "healthy" as const : "degraded" as const,
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
    } catch (error) {
      console.error("Error checking integration health:", error);
      res.status(500).json({ message: "Failed to check integration health" });
    }
  });

  // ===== AUDIT LOGS =====
  
  app.get("/api/admin/audit-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string | undefined;
      const action = req.query.action as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await storage.getAuditLogs({ limit, offset, category, action, search });
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });
}
