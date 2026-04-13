import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin } from "./helpers";
import { type ManagedUser } from "@workspace/db";
import { z } from "zod";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

export async function registerSsoRoutes(app: Express, _httpServer: Server) {
  app.post("/api/admin/cleanup-all-data", isAuthenticated, isAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Data cleanup is disabled in production" });
    }

    const { confirmation } = req.body;
    if (confirmation !== "DELETE_ALL_DATA") {
      return res.status(400).json({ message: "Confirmation string required: DELETE_ALL_DATA" });
    }

    try {
      const user = (req as any).managedUser as ManagedUser;

      await storage.createAuditLog({
        action: "full_data_cleanup",
        category: "admin",
        userId: user.id,
        userEmail: user.email,
        details: { warning: "All data wiped" },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
        status: "success",
      });

      await db.execute(sql`DELETE FROM project_assignments`);
      await db.execute(sql`DELETE FROM project_comments`);
      await db.execute(sql`DELETE FROM project_tags`);
      await db.execute(sql`DELETE FROM projects`);
      await db.execute(sql`DELETE FROM project_groups`);
      await db.execute(sql`DELETE FROM sprints`);
      await db.execute(sql`DELETE FROM ticket_comments`);
      await db.execute(sql`DELETE FROM tickets`);
      await db.execute(sql`DELETE FROM customer_profiles`);
      await db.execute(sql`DELETE FROM customers`);
      await db.execute(sql`DELETE FROM collaboration_blueprints`);
      await db.execute(sql`DELETE FROM faq_entries`);
      await db.execute(sql`DELETE FROM user_manuals`);
      res.json({ success: true, message: "All data cleaned up" });
    } catch (error) {
      console.error("Error cleaning up data:", error);
      res.status(500).json({ message: "Failed to clean up data" });
    }
  });
  const ssoAllowedOrigins = process.env.SSO_ALLOWED_ORIGINS
    ? process.env.SSO_ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["https://stable-master.replit.app"];

  const ssoVerifyCors = cors({
    origin: ssoAllowedOrigins,
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  });

  const ssoVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req: any, res: any) => {
      const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
      try { await storage.createSsoAuditLog({ userId: "unknown", ip: clientIp, action: "verify-token", success: false, details: "Rate limited" }); } catch {}
      res.status(429).json({ message: "Too many verification attempts, please try again later" });
    },
  });

  // SSO token endpoints
  const ssoGenerateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req: any) => req.session?.userId || "anonymous",
    message: { message: "Too many token generation attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false },
    handler: async (req: any, res: any) => {
      const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
      try { await storage.createSsoAuditLog({ userId: req.session?.userId || "unknown", ip: clientIp, action: "generate-token", success: false, details: "Rate limited" }); } catch {}
      res.status(429).json({ message: "Too many token generation attempts, please try again later" });
    },
  });

  app.post("/api/sso/generate-token", isAuthenticated, ssoGenerateLimiter, async (req: any, res) => {
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
    try {
      const user = req.managedUser;
      if (!user) {
        await storage.createSsoAuditLog({ userId: req.session?.userId || "unknown", ip: clientIp, action: "generate-token", success: false, details: "User not found" });
        return res.status(401).json({ message: "User not found" });
      }
      const isSuperOrAdmin = user.role === "superadmin" || user.role === "admin";
      if (!isSuperOrAdmin) {
        const allowed = user.allowedSubmodules as Record<string, string[]> | null;
        const hasAccess = allowed && allowed["equestrian"] && (
          allowed["equestrian"].includes("stable-master") || allowed["equestrian"].includes("stable-assets")
        );
        if (!hasAccess) {
          await storage.createSsoAuditLog({ userId: req.session.userId, ip: clientIp, action: "generate-token", success: false, details: "No access to equestrian module" });
          return res.status(403).json({ message: "No access to equestrian module" });
        }
      }
      const token = crypto.randomBytes(64).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await storage.createSsoToken(token, req.session.userId, expiresAt);
      const stableMasterUrl = (process.env.STABLE_MASTER_URL || "https://stable-master.replit.app").replace(/\/+$/, "");
      const url = `${stableMasterUrl}/sso?token=${token}`;
      await storage.createSsoAuditLog({ userId: req.session.userId, ip: clientIp, action: "generate-token", success: true });
      res.json({ url });
    } catch (e: any) {
      try { await storage.createSsoAuditLog({ userId: req.session?.userId || "unknown", ip: clientIp, action: "generate-token", success: false, details: e.message }); } catch {}
      res.status(500).json({ message: e.message });
    }
  });

  const ssoVerifySchema = z.object({
    token: z.string().min(1, "Token is required"),
  });

  app.options("/api/sso/verify-token", ssoVerifyCors);
  app.post("/api/sso/verify-token", ssoVerifyCors, ssoVerifyLimiter, async (req, res) => {
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
    try {
      const parsed = ssoVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        await storage.createSsoAuditLog({ userId: "unknown", ip: clientIp, action: "verify-token", success: false, details: "Token is required or invalid type" });
        return res.status(400).json({ message: "Token is required" });
      }
      const { token } = parsed.data;
      const result = await storage.validateAndConsumeSsoToken(token);
      if (!result) {
        await storage.createSsoAuditLog({ userId: "unknown", ip: clientIp, action: "verify-token", success: false, details: "Invalid, expired, or already used token" });
        return res.status(401).json({ message: "Invalid, expired, or already used token" });
      }
      const user = await storage.getManagedUser(result.userId);
      if (!user || !user.isActive) {
        await storage.createSsoAuditLog({ userId: result.userId, ip: clientIp, action: "verify-token", success: false, details: "User not found or inactive" });
        return res.status(401).json({ message: "User not found or inactive" });
      }
      await storage.createSsoAuditLog({ userId: result.userId, ip: clientIp, action: "verify-token", success: true });
      // NOTE for Stable Master consumer: After successful verification, call
      // history.replaceState(null, '', '/') to strip the SSO token from the
      // browser URL bar and prevent it from leaking via history or Referer header.
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (e: any) {
      try { await storage.createSsoAuditLog({ userId: "unknown", ip: clientIp, action: "verify-token", success: false, details: e.message }); } catch {}
      res.status(500).json({ message: e.message });
    }
  });
}
