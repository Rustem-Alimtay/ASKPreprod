/**
 * sm2-schema.ts
 * Stable-Master tables integrated into Unified Portal.
 * All DB table names are prefixed with "sm2_" to avoid conflicts with existing tables.
 * TypeScript variables are prefixed with "sm2" to avoid naming conflicts.
 * Type aliases (without prefix) are exported for use within stable-master pages.
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, boolean, date, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const sm2UserRoleEnum = pgEnum("sm2_user_role", ["ADMIN", "LIVERY_ADMIN", "VETERINARY", "STORES", "FINANCE"]);

export const sm2InvoiceStatusEnum = pgEnum("sm2_invoice_status", [
  "DRAFT", "VET_VALIDATION", "STORES_VALIDATION", "FINANCE_VALIDATION",
  "APPROVED", "PUSHED_TO_ERP", "REJECTED",
]);

export const sm2ValidationStepEnum = pgEnum("sm2_validation_step", ["VET", "STORES", "FINANCE", "ADMIN_OVERRIDE"]);
export const sm2ValidationActionEnum = pgEnum("sm2_validation_action", ["APPROVED", "REJECTED"]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const sm2Users = pgTable("sm2_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("LIVERY_ADMIN"),
});

export const insertSm2UserSchema = createInsertSchema(sm2Users).omit({ id: true });
export type InsertSm2User = z.infer<typeof insertSm2UserSchema>;
export type Sm2User = typeof sm2Users.$inferSelect;
// Alias for SM pages
export type User = Sm2User;
export type InsertUser = InsertSm2User;

// ─── Customers ───────────────────────────────────────────────────────────────

export const sm2Customers = pgTable("sm2_customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  fullname: text("fullname").notNull().default(""),
  firstname: text("firstname").notNull().default(""),
  lastname: text("lastname").notNull().default(""),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("active"),
});

export const insertSm2CustomerSchema = createInsertSchema(sm2Customers).omit({ id: true });
export type InsertSm2Customer = z.infer<typeof insertSm2CustomerSchema>;
export type Sm2Customer = typeof sm2Customers.$inferSelect;
// Alias for SM pages
export type { Sm2Customer as Customer, InsertSm2Customer as InsertCustomer };

// ─── Horses ──────────────────────────────────────────────────────────────────

export const sm2Horses = pgTable("sm2_horses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  horseName: text("horse_name").notNull(),
  passportName: text("passport_name"),
  passportNumber: text("passport_number"),
  sex: text("sex"),
  size: text("size"),
  color: text("color"),
  breed: text("breed"),
  dateOfBirth: text("date_of_birth"),
  comments: text("comments"),
  status: text("status").notNull().default("active"),
});

export const insertSm2HorseSchema = createInsertSchema(sm2Horses).omit({ id: true });
export type InsertSm2Horse = z.infer<typeof insertSm2HorseSchema>;
export type Sm2Horse = typeof sm2Horses.$inferSelect;
// Alias for SM pages
export type { Sm2Horse as Horse, InsertSm2Horse as InsertHorse };

// ─── Stables ─────────────────────────────────────────────────────────────────

export const sm2Stables = pgTable("sm2_stables", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
});

export const insertSm2StableSchema = createInsertSchema(sm2Stables).omit({ id: true });
export type InsertSm2Stable = z.infer<typeof insertSm2StableSchema>;
export type Sm2Stable = typeof sm2Stables.$inferSelect;
// Alias for SM pages
export type { Sm2Stable as Stable, InsertSm2Stable as InsertStable };

// ─── Boxes ───────────────────────────────────────────────────────────────────

export const sm2Boxes = pgTable("sm2_boxes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("box"),
  stableId: uuid("stable_id").notNull().references(() => sm2Stables.id),
  status: text("status").notNull().default("active"),
});

export const insertSm2BoxSchema = createInsertSchema(sm2Boxes).omit({ id: true });
export type InsertSm2Box = z.infer<typeof insertSm2BoxSchema>;
export type Sm2Box = typeof sm2Boxes.$inferSelect;
// Alias for SM pages
export type { Sm2Box as Box, InsertSm2Box as InsertBox };

// ─── Items ───────────────────────────────────────────────────────────────────

export const sm2Items = pgTable("sm2_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  name: text("name").notNull(),
  unitFactor: numeric("unit_factor"),
  price: numeric("price"),
  averageCost: numeric("average_cost"),
  department: text("department"),
  class: text("class"),
  location: text("location"),
  isInactive: boolean("is_inactive").notNull().default(false),
  status: text("status").notNull().default("active"),
  isLiveryPackage: boolean("is_livery_package").notNull().default(false),
});

export const insertSm2ItemSchema = createInsertSchema(sm2Items).omit({ id: true });
export type InsertSm2Item = z.infer<typeof insertSm2ItemSchema>;
export type Sm2Item = typeof sm2Items.$inferSelect;
// Alias for SM pages
export type { Sm2Item as Item, InsertSm2Item as InsertItem };

// ─── Item Prices ─────────────────────────────────────────────────────────────

export const sm2ItemPrices = pgTable("sm2_item_prices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: uuid("item_id").notNull().references(() => sm2Items.id),
  price: numeric("price").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const insertSm2ItemPriceSchema = createInsertSchema(sm2ItemPrices).omit({ id: true, createdAt: true });
export type InsertSm2ItemPrice = z.infer<typeof insertSm2ItemPriceSchema>;
export type Sm2ItemPrice = typeof sm2ItemPrices.$inferSelect;
// Alias for SM pages
export type { Sm2ItemPrice as ItemPrice, InsertSm2ItemPrice as InsertItemPrice };

// ─── Livery Agreements ───────────────────────────────────────────────────────

export const sm2LiveryAgreements = pgTable("sm2_livery_agreements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").notNull(),
  agreementCategory: text("agreement_category").notNull().default("with_horse"),
  customerId: uuid("customer_id").notNull().references(() => sm2Customers.id),
  boxId: uuid("box_id").notNull().references(() => sm2Boxes.id),
  itemId: uuid("item_id").notNull().references(() => sm2Items.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  type: text("type").notNull().default("permanent"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  checkoutReason: text("checkout_reason"),
  monthlyAmount: numeric("monthly_amount"),
});

export const insertSm2LiveryAgreementSchema = createInsertSchema(sm2LiveryAgreements).omit({ id: true });
export type InsertSm2LiveryAgreement = z.infer<typeof insertSm2LiveryAgreementSchema>;
export type Sm2LiveryAgreement = typeof sm2LiveryAgreements.$inferSelect;
// Alias for SM pages
export type { Sm2LiveryAgreement as LiveryAgreement, InsertSm2LiveryAgreement as InsertLiveryAgreement };

// ─── Billing Elements ────────────────────────────────────────────────────────

export const sm2BillingElements = pgTable("sm2_billing_elements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  horseId: uuid("horse_id").references(() => sm2Horses.id),
  customerId: uuid("customer_id").notNull().references(() => sm2Customers.id),
  boxId: uuid("box_id").references(() => sm2Boxes.id),
  itemId: uuid("item_id").notNull().references(() => sm2Items.id),
  agreementId: uuid("agreement_id").references(() => sm2LiveryAgreements.id),
  quantity: integer("quantity").notNull().default(1),
  base: numeric("base"),
  price: numeric("price").notNull(),
  transactionDate: text("transaction_date").notNull(),
  billingMonth: text("billing_month"),
  billed: boolean("billed").notNull().default(false),
  invoiceId: uuid("invoice_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSm2BillingElementSchema = createInsertSchema(sm2BillingElements).omit({ id: true, createdAt: true });
export type InsertSm2BillingElement = z.infer<typeof insertSm2BillingElementSchema>;
export type Sm2BillingElement = typeof sm2BillingElements.$inferSelect;
// Alias for SM pages
export type { Sm2BillingElement as BillingElement, InsertSm2BillingElement as InsertBillingElement };

// ─── Invoices ────────────────────────────────────────────────────────────────

export const sm2Invoices = pgTable("sm2_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  netsuiteId: text("netsuite_id"),
  customerId: uuid("customer_id").notNull().references(() => sm2Customers.id),
  invoiceDate: text("invoice_date").notNull(),
  billingMonth: text("billing_month"),
  totalAmount: numeric("total_amount").notNull(),
  status: text("status").notNull().default("DRAFT"),
  soGenerated: boolean("so_generated").notNull().default(false),
  sentToNetsuite: boolean("sent_to_netsuite").notNull().default(false),
  poNumber: text("po_number"),
  netsuiteJson: text("netsuite_json"),
});

export const insertSm2InvoiceSchema = createInsertSchema(sm2Invoices).omit({ id: true });
export type InsertSm2Invoice = z.infer<typeof insertSm2InvoiceSchema>;
export type Sm2Invoice = typeof sm2Invoices.$inferSelect;
// Alias for SM pages
export type { Sm2Invoice as Invoice, InsertSm2Invoice as InsertInvoice };

// ─── Agreement Documents ─────────────────────────────────────────────────────

export const sm2AgreementDocuments = pgTable("sm2_agreement_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: uuid("agreement_id").notNull().references(() => sm2LiveryAgreements.id),
  filename: text("filename").notNull(),
  fileData: text("file_data").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSm2AgreementDocumentSchema = createInsertSchema(sm2AgreementDocuments).omit({ id: true, uploadedAt: true });
export type InsertSm2AgreementDocument = z.infer<typeof insertSm2AgreementDocumentSchema>;
export type Sm2AgreementDocument = typeof sm2AgreementDocuments.$inferSelect;
// Alias for SM pages
export type { Sm2AgreementDocument as AgreementDocument, InsertSm2AgreementDocument as InsertAgreementDocument };

// ─── App Settings ─────────────────────────────────────────────────────────────

export const sm2AppSettings = pgTable("sm2_app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Audit Logs (SM) ─────────────────────────────────────────────────────────

export const sm2AuditLogs = pgTable("sm2_audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSm2AuditLogSchema = createInsertSchema(sm2AuditLogs).omit({ id: true, createdAt: true });
export type InsertSm2AuditLog = z.infer<typeof insertSm2AuditLogSchema>;
export type Sm2AuditLog = typeof sm2AuditLogs.$inferSelect;
// Alias for SM pages
export type { Sm2AuditLog as AuditLog, InsertSm2AuditLog as InsertAuditLog };

// ─── Invoice Validations ──────────────────────────────────────────────────────

export const sm2InvoiceValidations = pgTable("sm2_invoice_validations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").notNull().references(() => sm2Invoices.id),
  step: text("step").notNull(),
  action: text("action").notNull(),
  userId: text("user_id").notNull(), // references managed_users.id (UP auth)
  username: text("username"), // stored directly to avoid join
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSm2InvoiceValidationSchema = createInsertSchema(sm2InvoiceValidations).omit({ id: true, createdAt: true });
export type InsertSm2InvoiceValidation = z.infer<typeof insertSm2InvoiceValidationSchema>;
export type Sm2InvoiceValidation = typeof sm2InvoiceValidations.$inferSelect;
// Alias for SM pages
export type { Sm2InvoiceValidation as InvoiceValidation, InsertSm2InvoiceValidation as InsertInvoiceValidation };

// ─── Horse Ownership ──────────────────────────────────────────────────────────

export const sm2HorseOwnership = pgTable("sm2_horse_ownership", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  horseId: uuid("horse_id").notNull().references(() => sm2Horses.id),
  customerId: uuid("customer_id").notNull().references(() => sm2Customers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSm2HorseOwnershipSchema = createInsertSchema(sm2HorseOwnership).omit({ id: true, createdAt: true });
export type InsertSm2HorseOwnership = z.infer<typeof insertSm2HorseOwnershipSchema>;
export type Sm2HorseOwnership = typeof sm2HorseOwnership.$inferSelect;
// Alias for SM pages
export type { Sm2HorseOwnership as HorseOwnership, InsertSm2HorseOwnership as InsertHorseOwnership };

// ─── Horse Movements ──────────────────────────────────────────────────────────

export const sm2HorseMovements = pgTable("sm2_horse_movements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: uuid("agreement_id").references(() => sm2LiveryAgreements.id),
  horseId: uuid("horse_id").notNull().references(() => sm2Horses.id),
  stableboxId: uuid("stablebox_id").notNull().references(() => sm2Boxes.id),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSm2HorseMovementSchema = createInsertSchema(sm2HorseMovements).omit({ id: true, createdAt: true });
export type InsertSm2HorseMovement = z.infer<typeof insertSm2HorseMovementSchema>;
export type Sm2HorseMovement = typeof sm2HorseMovements.$inferSelect;
// Alias for SM pages
export type { Sm2HorseMovement as HorseMovement, InsertSm2HorseMovement as InsertHorseMovement };

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_ROLES = ["ADMIN", "LIVERY_ADMIN", "VETERINARY", "STORES", "FINANCE"] as const;
export type UserRole = typeof VALID_ROLES[number];

export const INVOICE_STATUSES = [
  "DRAFT", "VET_VALIDATION", "STORES_VALIDATION", "FINANCE_VALIDATION",
  "APPROVED", "PUSHED_TO_ERP", "REJECTED",
] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
