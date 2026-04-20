import type { Express } from "express";
import type { Server } from "http";

import { registerAdminRoutes } from "./admin";
import { registerTicketRoutes } from "./tickets";
import { registerCustomerRoutes } from "./customers";
import { registerDataSourceRoutes } from "./data-sources";
import { registerRequisitionRoutes } from "./requisitions";
import { registerSsoRoutes } from "./sso";
import { registerDepartmentRoutes } from "./departments";
import sm2Router from "./stable-master";

export async function registerAllRoutes(app: Express, httpServer: Server): Promise<void> {
  await registerAdminRoutes(app, httpServer);
  await registerTicketRoutes(app, httpServer);
  await registerCustomerRoutes(app, httpServer);
  await registerDataSourceRoutes(app, httpServer);
  await registerRequisitionRoutes(app, httpServer);
  await registerSsoRoutes(app, httpServer);
  await registerDepartmentRoutes(app, httpServer);
  app.use("/api/sm2", sm2Router);
}
