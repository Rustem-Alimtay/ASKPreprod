import * as userMethods from "./user";
import * as systemMethods from "./system";
import * as ticketMethods from "./ticket";
import * as customerMethods from "./customer";
import * as dataSourceMethods from "./dataSource";
import * as requisitionMethods from "./requisition";

// Re-export individual domain functions for direct import
export * from "./user";
export * from "./system";
export * from "./ticket";
export * from "./customer";
export * from "./dataSource";
export * from "./requisition";

// Backward-compatible combined storage object — all callers use this
export const storage = {
  ...userMethods,
  ...systemMethods,
  ...ticketMethods,
  ...customerMethods,
  ...dataSourceMethods,
  ...requisitionMethods,
};
