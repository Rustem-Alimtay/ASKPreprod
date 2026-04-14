import type { Express } from "express";
import type { Server } from "http";

import { registerErpDashboardRoutes } from "./erp-dashboards";
import { registerAdminRoutes } from "./admin";
import { registerTicketRoutes } from "./tickets";
import { registerCustomerRoutes } from "./customers";
import { registerDataSourceRoutes } from "./data-sources";
import { registerProjectRoutes } from "./projects";
import { registerRequisitionRoutes } from "./requisitions";
import { registerSsoRoutes } from "./sso";
import { registerDepartmentRoutes } from "./departments";
import { registerAzureTableRoutes } from "./azure-tables";

export async function registerAllRoutes(app: Express, httpServer: Server): Promise<void> {
  registerErpDashboardRoutes(app, httpServer);
  await registerAdminRoutes(app, httpServer);
  await registerTicketRoutes(app, httpServer);
  await registerCustomerRoutes(app, httpServer);
  await registerDataSourceRoutes(app, httpServer);
  await registerProjectRoutes(app, httpServer);
  await registerRequisitionRoutes(app, httpServer);
  await registerSsoRoutes(app, httpServer);
  await registerDepartmentRoutes(app, httpServer);
  await registerAzureTableRoutes(app, httpServer);
}
