import { Express, Request, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { passwordSchema } from "@workspace/db";
import { env, isProd, isDev } from "./lib/env";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function getResetBaseUrl(req: Request): string {
  if (env.APP_URL) {
    return env.APP_URL.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
}

export function setupAuth(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isReplit = !!env.REPL_ID;

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd || isReplit,
        sameSite: isReplit ? "none" as const : "lax" as const,
        maxAge: sessionTtl,
      },
      proxy: true,
    })
  );
}

export function registerAuthRoutes(app: Express) {
  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = username.includes("@")
        ? await storage.getManagedUserByEmail(username)
        : await storage.getManagedUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is disabled" });
      }

      // Regenerate session to prevent session fixation
      const oldSession = req.session;
      await new Promise<void>((resolve, reject) => {
        oldSession.regenerate((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      req.session.userId = user.id;

      // Update last active
      await storage.updateManagedUser(user.id, { lastActiveAt: new Date() });

      // Return user without sensitive fields
      const { password: _p, mfaSecret: _m, mfaBackupCodes: _b, ...userWithoutSensitive } = user;
      res.json(userWithoutSensitive);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    if (userId) {
      try {
        await storage.invalidateUserSsoTokens(userId);
      } catch (err) {
        console.error("Failed to invalidate SSO tokens on logout:", err);
        return res.status(500).json({ message: "Logout failed: could not invalidate active tokens" });
      }
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getManagedUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      // Return user without sensitive fields
      const { password: _, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = user;
      res.json(userWithoutSensitive);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Please provide a valid email" });

      const user = await storage.getManagedUserByEmail(parsed.data.email);
      if (!user) {
        return res.json({ message: "If an account with that email exists, a reset link has been generated" });
      }

      await storage.invalidateUserResetTokens(user.id);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = getResetBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password/${token}`;
      console.log(`[Reset] Built reset URL for ${user.email}: ${baseUrl}/reset-password/***`);
      let emailSent = false;
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: user.email,
          subject: "Password Reset — Unified Portal",
          html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, you can ignore this email.</p>`,
        });
        emailSent = true;
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailErr: any) {
        const errMsg = emailErr?.message || "Unknown error";
        console.error(`[WARN] Failed to send password reset email to ${user.email}: ${errMsg}`);
      }

      if (!emailSent) {
        console.warn(`[WARN] Password reset requested for ${user.email} but email was NOT delivered. Check SendGrid configuration.`);
      }

      const showDevToken = isDev && env.DEV_SHOW_RESET_TOKEN === "true";
      res.json({ message: "If an account with that email exists, a reset link has been generated", token: (!emailSent && showDevToken) ? token : undefined });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const parsed = z.object({ token: z.string(), newPassword: passwordSchema }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });

      const resetToken = await storage.getPasswordResetToken(parsed.data.token);
      if (!resetToken) return res.status(400).json({ message: "Invalid or expired reset link" });
      if (resetToken.usedAt) return res.status(400).json({ message: "This reset link has already been used" });
      if (resetToken.expiresAt < new Date()) return res.status(400).json({ message: "This reset link has expired" });

      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
      await storage.updateManagedUser(resetToken.userId, { password: hashedPassword } as any);
      await storage.markPasswordResetTokenUsed(parsed.data.token);

      await storage.destroyUserSessions(resetToken.userId);

      const user = await storage.getManagedUser(resetToken.userId);
      if (user) {
        try {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: user.email,
            subject: "Password Changed — Unified Portal",
            html: `<p>Your password was successfully changed.</p><p>If you did not make this change, please contact support immediately.</p>`,
          });
          console.log(`Password change confirmation email sent to ${user.email}`);
        } catch (emailErr: any) {
          const errMsg = emailErr?.message || "Unknown error";
          console.error(`[WARN] Failed to send password change confirmation to ${user.email}: ${errMsg}`);
        }
      }

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/validate-reset-token/:token", async (req, res) => {
    try {
      const tokenPrefix = req.params.token.substring(0, 8);
      const resetToken = await storage.getPasswordResetToken(req.params.token);
      if (!resetToken) {
        console.warn(`[Reset] Token ${tokenPrefix}… not found in database`);
        return res.status(400).json({ valid: false, message: "Invalid or expired reset link" });
      }
      if (resetToken.usedAt) {
        console.warn(`[Reset] Token ${tokenPrefix}… already used at ${resetToken.usedAt.toISOString()}`);
        return res.status(400).json({ valid: false, message: "This reset link has already been used" });
      }
      const now = new Date();
      if (resetToken.expiresAt.getTime() < now.getTime()) {
        console.warn(`[Reset] Token ${tokenPrefix}… expired at ${resetToken.expiresAt.toISOString()}, now is ${now.toISOString()}`);
        return res.status(400).json({ valid: false, message: "This reset link has expired" });
      }
      console.log(`[Reset] Token ${tokenPrefix}… validated successfully, expires ${resetToken.expiresAt.toISOString()}`);
      res.json({ valid: true });
    } catch (error) {
      console.error("Validate reset token error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate token" });
    }
  });

  app.post("/api/admin/users/:id/reset-password-link", isAuthenticated, async (req, res) => {
    try {
      const adminUser = (req as any).managedUser;
      if (adminUser.role !== "admin" && adminUser.role !== "superadmin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const user = await storage.getManagedUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      await storage.invalidateUserResetTokens(user.id);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = getResetBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password/${token}`;
      console.log(`[Reset] Admin reset URL for ${user.email}: ${baseUrl}/reset-password/***`);

      let emailSent = false;
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: user.email,
          subject: "Password Reset — Unified Portal",
          html: `<p>An administrator has initiated a password reset for your account.</p><p><a href="${resetUrl}">Click here to set your new password</a></p><p>This link expires in 24 hours.</p>`,
        });
        emailSent = true;
        console.log(`Admin-initiated password reset email sent to ${user.email}`);
      } catch (emailErr: any) {
        const errMsg = emailErr?.message || "Unknown error";
        console.error(`[WARN] Failed to send admin reset email to ${user.email}: ${errMsg}`);
      }

      if (!emailSent) {
        console.warn(`[WARN] Admin reset link generated for ${user.email} but email was NOT delivered. Check SendGrid configuration.`);
      }

      res.json({ resetUrl, emailSent });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Failed to generate reset link" });
    }
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getManagedUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "User not found" });
  }

  // Store user in request for later use
  (req as any).managedUser = user;
  next();
};

// Seed default admin user
function generateSecurePassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function seedAdminUser() {
  try {
    const existingAdmin = await storage.getManagedUserByUsername("admin");
    if (existingAdmin) {
      if (existingAdmin.role !== "superadmin") {
        await storage.updateManagedUser(existingAdmin.id, { role: "superadmin" });
        console.log("Admin user upgraded to superadmin");
      }
      if (env.ADMIN_DEFAULT_PASSWORD) {
        const hashedPassword = await bcrypt.hash(env.ADMIN_DEFAULT_PASSWORD, 10);
        await storage.updateManagedUser(existingAdmin.id, { password: hashedPassword });
        console.log("Admin password updated from ADMIN_DEFAULT_PASSWORD env var");
      } else {
        console.log("Admin user already exists");
      }
    } else {
      const adminPassword = env.ADMIN_DEFAULT_PASSWORD || generateSecurePassword();
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await storage.createManagedUser({
        email: "admin@example.com",
        username: "admin",
        password: hashedPassword,
        firstName: "System",
        lastName: "Admin",
        role: "superadmin",
        isActive: true,
        lastActiveAt: null,
      });
      if (env.ADMIN_DEFAULT_PASSWORD) {
        console.log("Default admin user created (username: admin, password from ADMIN_DEFAULT_PASSWORD env var)");
      } else {
        console.log("Default admin user created (username: admin). Set ADMIN_DEFAULT_PASSWORD env var or change the password immediately.");
      }
    }

    const existingSystemAdmin = await storage.getManagedUserByUsername("systemadmin");
    if (!existingSystemAdmin) {
      const systemAdminPassword = env.SYSTEMADMIN_DEFAULT_PASSWORD || generateSecurePassword();
      const hashedPassword = await bcrypt.hash(systemAdminPassword, 10);
      await storage.createManagedUser({
        email: "systemadmin@example.com",
        username: "systemadmin",
        password: hashedPassword,
        firstName: "System",
        lastName: "Admin",
        role: "superadmin",
        isActive: true,
        lastActiveAt: null,
      });
      if (env.SYSTEMADMIN_DEFAULT_PASSWORD) {
        console.log("Systemadmin user created (username: systemadmin, password from SYSTEMADMIN_DEFAULT_PASSWORD env var)");
      } else {
        console.log("Systemadmin user created (username: systemadmin, password auto-generated). Change immediately or set SYSTEMADMIN_DEFAULT_PASSWORD env var.");
      }
    } else {
      console.log("Systemadmin user already exists");
    }
  } catch (error) {
    console.error("Failed to seed admin user:", error);
  }
}
