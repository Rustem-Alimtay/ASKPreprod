// Validate env FIRST, before any module that reads process.env at import time
import { env, isDev } from "./lib/env";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes, seedAdminUser } from "./portal-auth";
import { registerAllRoutes } from "./portal-routes/index";
import { seedExternalServices, seedDataSources } from "./seedServices";
import { storage } from "./storage";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";

const app: Express = express();
export const httpServer = createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://*.powerbi.com", "https://*.msecnd.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://*.powerbi.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", ...(isDev ? ["ws:"] : [])],
      frameSrc: ["'self'", "https://view.monday.com", "https://*.powerbi.com", "https://*.microsoft.com", "https://*.microsoftonline.com", "https://*.msftauth.net", "https://*.msauth.net", "https://*.live.com", "https://*.office.com", "https://*.sharepoint.com"],
      frameAncestors: ["'self'", "https://*.replit.dev", "https://*.replit.app"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: "Too many password reset requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many reset attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", resetPasswordLimiter);

const largeJsonParser = express.json({ limit: "50mb" });
const importRoutes = [
  "/api/customers/import",
  "/api/data-sources/:slug/import",
  "/api/sm2/customers/import",
  "/api/sm2/horses/import",
  "/api/sm2/boxes/import",
  "/api/sm2/items/import",
];
app.post("/api/requisitions", largeJsonParser);
app.post("/api/requisitions/:id/attachments", largeJsonParser);
app.post("/api/requisitions/:id/quotations", largeJsonParser);
app.post("/api/tickets/:id/attachments", largeJsonParser);
app.post("/api/sm2/livery-agreements/:id/documents", largeJsonParser);
importRoutes.forEach(route => app.post(route, largeJsonParser));

app.use(
  express.json({
    limit: "5mb",
  }),
);

app.use(express.urlencoded({ extended: false, limit: "5mb" }));

app.get('/api/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

let appReady = false;

async function initializeApp() {
  try {
    setupAuth(app);
    registerAuthRoutes(app);
    await registerAllRoutes(app, httpServer);
    // errorHandler must be registered LAST, after all routes
    app.use(errorHandler);
    await seedAdminUser();
    await storage.initTicketSequence();
    await seedExternalServices();
    await seedDataSources();
    appReady = true;
    logger.info("Portal app initialized successfully");
  } catch (error) {
    logger.fatal({ error }, "Fatal error initializing portal app — refusing to start");
    process.exit(1);
  }
}

initializeApp();

export default app;
