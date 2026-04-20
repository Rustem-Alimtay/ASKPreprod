/**
 * Centralized, validated environment configuration.
 *
 * All reads from `process.env` in this app must go through this module.
 * At startup we validate the required set — if any REQUIRED var is missing,
 * the process fails fast with a clear error rather than failing mysteriously later.
 */
import { z } from "zod";

const schema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Database + session — REQUIRED in production
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be ≥32 chars"),

  // App URL — defaults to localhost for dev; should be overridden in prod
  APP_URL: z.string().url().default("http://localhost:5000"),

  // Admin bootstrap (optional — creates default superadmin if set)
  ADMIN_DEFAULT_PASSWORD: z.string().optional(),
  SYSTEMADMIN_DEFAULT_PASSWORD: z.string().optional(),

  // Dev-only helpers
  DEV_SHOW_RESET_TOKEN: z.string().optional(),

  // SSO
  SSO_ALLOWED_ORIGINS: z.string().optional(),

  // Email (SendGrid)
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  SMTP_USER: z.string().optional(),

  // NetSuite integration
  NETSUITE_ACCOUNT_ID: z.string().optional(),
  NETSUITE_CONSUMER_KEY: z.string().optional(),
  NETSUITE_CONSUMER_SECRET: z.string().optional(),
  NETSUITE_TOKEN_ID: z.string().optional(),
  NETSUITE_TOKEN_SECRET: z.string().optional(),
  NETSUITE_RESTLET_URL: z.string().url().optional(),

  // Stable Master subdomain
  STABLE_MASTER_URL: z.string().url().optional(),

  // Procurement workflow: cost-center code for the purchasing-review group step
  PROCUREMENT_COST_CENTER: z.string().default("118001003"),

  // Replit-specific
  REPL_ID: z.string().optional(),
  REPL_IDENTITY: z.string().optional(),
  REPLIT_CONNECTORS_HOSTNAME: z.string().optional(),
  WEB_REPL_RENEWAL: z.string().optional(),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Environment validation failed — see stderr for details");
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;

export const isDev = env.NODE_ENV !== "production";
export const isProd = env.NODE_ENV === "production";
