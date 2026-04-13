import { Router, Request, Response, NextFunction } from "express";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { z } from "zod";
import { sm2Storage } from "../storage-sm2";
import { isAuthenticated } from "../portal-auth";
import {
  insertSm2UserSchema,
  insertSm2CustomerSchema,
  insertSm2HorseSchema,
  insertSm2StableSchema,
  insertSm2BoxSchema,
  insertSm2ItemSchema,
  insertSm2LiveryAgreementSchema,
  insertSm2BillingElementSchema,
  insertSm2InvoiceSchema,
  insertSm2AgreementDocumentSchema,
  insertSm2HorseOwnershipSchema,
  insertSm2HorseMovementSchema,
  VALID_ROLES,
} from "@workspace/db";
import type { InvoiceStatus as Sm2InvoiceStatus } from "@workspace/db";

const router = Router();

// All routes require authentication via Unified Portal session
router.use(isAuthenticated);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUpUser(req: Request) {
  return (req as any).managedUser as {
    id: string;
    username: string;
    role: string;
  };
}

/** Map Unified Portal role → Stable-Master role */
function getSmRole(upRole: string): string {
  const map: Record<string, string> = {
    superadmin: "ADMIN",
    admin: "ADMIN",
    livery: "LIVERY_ADMIN",
    finance: "FINANCE",
    procurement: "STORES",
    others: "VETERINARY",
  };
  return map[upRole] || "LIVERY_ADMIN";
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUpUser(req);
  if (user.role !== "admin" && user.role !== "superadmin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function requireRoles(...smRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getUpUser(req);
    const smRole = getSmRole(user.role);
    if (smRole === "ADMIN" || smRoles.includes(smRole)) return next();
    res.status(403).json({ message: "Insufficient permissions" });
  };
}

function validateBody(schema: any, body: any) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw { status: 400, message: result.error.errors.map((e: any) => e.message).join(", ") };
  }
  return result.data;
}

function auditLog(req: Request, action: string, entityType?: string, entityId?: string, details?: string) {
  const user = getUpUser(req);
  sm2Storage.createAuditLog({
    userId: user?.id || null,
    username: user?.username || null,
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    details: details || null,
  }).catch(err => console.error("SM2 Audit log error:", err));
}

// ─── /me ────────────────────────────────────────────────────────────────────

router.get("/me", (req, res) => {
  const user = getUpUser(req);
  res.json({
    id: user.id,
    username: user.username,
    role: getSmRole(user.role),
  });
});

// ─── Users (SM2 internal users) ─────────────────────────────────────────────

router.get("/users", requireAdmin, async (_req, res) => {
  try {
    const users = await sm2Storage.getUsers();
    res.json(users);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const data = validateBody(insertSm2UserSchema, req.body);
    if (!VALID_ROLES.includes(data.role as any)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }
    const user = await sm2Storage.createUser(data);
    auditLog(req, "create_user", "user", user.id, `Created user: ${user.username} (role: ${user.role})`);
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }
    const updated = await sm2Storage.updateUser(req.params.id, { role });
    if (!updated) return res.status(404).json({ message: "User not found" });
    auditLog(req, "update_user", "user", req.params.id, `Updated user role to: ${role}`);
    res.json({ id: updated.id, username: updated.username, role: updated.role });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Customers ───────────────────────────────────────────────────────────────

router.get("/customers", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const customers = await sm2Storage.getCustomers(search);
    res.json(customers);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await sm2Storage.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const data = validateBody(insertSm2CustomerSchema, req.body);
    const customer = await sm2Storage.createCustomer(data);
    res.json(customer);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/customers/import", async (req, res) => {
  try {
    const { customers: data } = req.body;
    if (!Array.isArray(data)) throw { status: 400, message: "customers must be an array" };
    const results = [];
    for (const c of data) {
      const withDefaults = {
        ...c,
        firstname: c.firstname || "",
        lastname: c.lastname || "",
      };
      const validated = validateBody(insertSm2CustomerSchema, withDefaults);
      const created = await sm2Storage.createCustomer(validated);
      results.push(created);
    }
    res.json(results);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Horses ──────────────────────────────────────────────────────────────────

router.get("/horses", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const customerSearch = req.query.customerSearch as string | undefined;
    const stableBoxSearch = req.query.stableBoxSearch as string | undefined;
    const horses = await sm2Storage.getHorses(search, customerSearch, stableBoxSearch);
    res.json(horses);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horses/available", async (_req, res) => {
  try {
    const available = await sm2Storage.getAvailableHorses();
    res.json(available);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horses/:id", async (req, res) => {
  try {
    const horse = await sm2Storage.getHorse(req.params.id);
    if (!horse) return res.status(404).json({ message: "Horse not found" });
    const ownership = await sm2Storage.getHorseOwnershipByHorseId(horse.id);
    let ownerName = null;
    let ownerId = null;
    if (ownership) {
      const owner = await sm2Storage.getCustomer(ownership.customerId);
      ownerName = owner?.fullname || null;
      ownerId = ownership.customerId;
    }
    res.json({ ...horse, ownerName, ownerId });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horses", async (req, res) => {
  try {
    const { ownerId, ...horseData } = req.body;
    if (!ownerId) {
      return res.status(400).json({ message: "Owner (ownerId) is required" });
    }
    const data = validateBody(insertSm2HorseSchema, horseData);
    const horse = await sm2Storage.createHorseWithOwner(data, ownerId);
    res.json(horse);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/horses/:id", async (req, res) => {
  try {
    const { ownerId, ...rest } = req.body;
    const data = validateBody(insertSm2HorseSchema.partial(), rest);
    const horse = await sm2Storage.updateHorse(req.params.id, data);
    if (!horse) return res.status(404).json({ message: "Horse not found" });
    if (ownerId) {
      const existingOwnership = await sm2Storage.getHorseOwnership(req.params.id);
      if (existingOwnership.length > 0) {
        const latest = existingOwnership.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];
        if (latest.customerId !== ownerId) {
          await sm2Storage.createHorseOwnership({ horseId: req.params.id, customerId: ownerId });
        }
      } else {
        await sm2Storage.createHorseOwnership({ horseId: req.params.id, customerId: ownerId });
      }
    }
    res.json(horse);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horses/import", async (req, res) => {
  try {
    const { horses: data } = req.body;
    if (!Array.isArray(data)) throw { status: 400, message: "horses must be an array" };
    const results = [];
    for (const h of data) {
      const validated = validateBody(insertSm2HorseSchema, h);
      const created = await sm2Storage.createHorse(validated);
      results.push(created);
    }
    res.json(results);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Stables ─────────────────────────────────────────────────────────────────

router.get("/stables", async (_req, res) => {
  try {
    const stables = await sm2Storage.getStables();
    res.json(stables);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/stables", async (req, res) => {
  try {
    const data = validateBody(insertSm2StableSchema, req.body);
    const stable = await sm2Storage.createStable(data);
    res.json(stable);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/stables/:id", async (req, res) => {
  try {
    const data = validateBody(insertSm2StableSchema.partial(), req.body);
    const stable = await sm2Storage.updateStable(req.params.id, data);
    if (!stable) return res.status(404).json({ message: "Stable not found" });
    res.json(stable);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.delete("/stables/:id", requireAdmin, async (req, res) => {
  try {
    const existing = await sm2Storage.getStable(req.params.id);
    if (!existing) return res.status(404).json({ message: "Stable not found" });
    await sm2Storage.deleteStable(req.params.id);
    auditLog(req, "delete_stable", "stable", req.params.id, `Deleted stable: ${existing.name}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Boxes ───────────────────────────────────────────────────────────────────

router.get("/boxes", async (req, res) => {
  try {
    const stableSearch = req.query.stableSearch as string | undefined;
    const boxSearch = req.query.boxSearch as string | undefined;
    const boxes = await sm2Storage.getBoxes(stableSearch, boxSearch);
    res.json(boxes);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/boxes", async (req, res) => {
  try {
    const data = validateBody(insertSm2BoxSchema, req.body);
    const box = await sm2Storage.createBox(data);
    res.json(box);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/boxes/:id", async (req, res) => {
  try {
    const data = validateBody(insertSm2BoxSchema.partial(), req.body);
    const box = await sm2Storage.updateBox(req.params.id, data);
    if (!box) return res.status(404).json({ message: "Box not found" });
    res.json(box);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.delete("/boxes/:id", requireAdmin, async (req, res) => {
  try {
    const existing = await sm2Storage.getBox(req.params.id);
    if (!existing) return res.status(404).json({ message: "Box not found" });
    await sm2Storage.deleteBox(req.params.id);
    auditLog(req, "delete_box", "box", req.params.id, `Deleted box: ${existing.name}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/boxes/import", async (req, res) => {
  try {
    const { boxes: data } = req.body;
    if (!Array.isArray(data)) throw { status: 400, message: "boxes must be an array" };
    const results = [];
    for (const b of data) {
      const validated = validateBody(insertSm2BoxSchema, b);
      const created = await sm2Storage.createBox(validated);
      results.push(created);
    }
    res.json(results);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Items ───────────────────────────────────────────────────────────────────

router.get("/items", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const items = await sm2Storage.getItems(search);
    res.json(items);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/items/livery-packages", async (_req, res) => {
  try {
    const items = await sm2Storage.getLiveryPackageItems();
    res.json(items);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/items/non-livery-packages", async (_req, res) => {
  try {
    const items = await sm2Storage.getNonLiveryPackageItems();
    res.json(items);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/items/import", async (req, res) => {
  try {
    const { items: data } = req.body;
    if (!Array.isArray(data)) throw { status: 400, message: "items must be an array" };
    const validated = data.map((item: any) => validateBody(insertSm2ItemSchema, item));
    const results = await sm2Storage.createItemsBulk(validated);
    res.json({ imported: results.length });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/items/:id", async (req, res) => {
  try {
    const data = validateBody(insertSm2ItemSchema.partial(), req.body);
    const item = await sm2Storage.updateItem(req.params.id, data);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/items/:id/price-history", async (req, res) => {
  try {
    const item = await sm2Storage.getItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    const history = await sm2Storage.getItemPriceHistory(req.params.id);
    res.json(history);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/items/:id/change-price", async (req, res) => {
  try {
    const item = await sm2Storage.getItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    const { price } = req.body;
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ message: "Valid positive price is required" });
    }
    const user = getUpUser(req);
    const newPriceRecord = await sm2Storage.changeItemPrice(req.params.id, String(price), user?.username);
    auditLog(req, "change_item_price", "item", req.params.id, `Price changed to ${price} for item ${item.name}`);
    res.json(newPriceRecord);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Livery Agreements ───────────────────────────────────────────────────────

router.get("/livery-agreements", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const agreements = await sm2Storage.getLiveryAgreements(status);
    res.json(agreements);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/livery-agreements", async (req, res) => {
  try {
    const data = validateBody(insertSm2LiveryAgreementSchema, req.body);
    const agreement = await sm2Storage.createLiveryAgreement(data);
    auditLog(req, "create_agreement", "agreement", agreement.id, `Created agreement: ${agreement.referenceNumber}`);
    res.json(agreement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/livery-agreements/:id", async (req, res) => {
  try {
    const data = validateBody(insertSm2LiveryAgreementSchema.partial(), req.body);
    const existing = await sm2Storage.getLiveryAgreement(req.params.id);
    if (!existing) return res.status(404).json({ message: "Agreement not found" });

    const movements = await sm2Storage.getHorseMovementsByAgreementId(req.params.id);
    const activeMovement = movements.find(m => !m.checkOut);

    if (data.endDate && activeMovement) {
      await sm2Storage.updateHorseMovement(activeMovement.id, { checkOut: data.endDate });
    }

    if (data.boxId && data.boxId !== existing.boxId && activeMovement) {
      await sm2Storage.updateHorseMovement(activeMovement.id, { checkOut: new Date().toISOString().split("T")[0] });
    }

    const agreement = await sm2Storage.updateLiveryAgreement(req.params.id, data);
    if (data.endDate) {
      auditLog(req, "checkout_agreement", "agreement", req.params.id, `Checkout agreement, end date: ${data.endDate}`);
    }
    res.json(agreement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/livery-agreements/:id/cancel-checkout", async (req, res) => {
  try {
    const agreement = await sm2Storage.getLiveryAgreement(req.params.id);
    if (!agreement) return res.status(404).json({ message: "Agreement not found" });
    if (!agreement.endDate) return res.status(400).json({ message: "Agreement does not have a checkout date" });
    const updated = await sm2Storage.updateLiveryAgreement(req.params.id, {
      endDate: null,
      checkoutReason: null,
    });
    auditLog(req, "cancel_checkout", "agreement", req.params.id, `Cancelled checkout for agreement ${agreement.referenceNumber}`);
    res.json(updated);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/boxes-with-status", async (_req, res) => {
  try {
    const boxes = await sm2Storage.getBoxesWithAgreementStatus();
    res.json(boxes);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/available-boxes", async (_req, res) => {
  try {
    const boxes = await sm2Storage.getBoxesWithAgreementStatus();
    res.json(boxes.filter((b: any) => b.isAvailable));
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Billing Elements ────────────────────────────────────────────────────────

router.get("/billing-elements", async (req, res) => {
  try {
    const billed = req.query.billed !== undefined ? req.query.billed === "true" : undefined;
    const elements = await sm2Storage.getBillingElements(billed);
    res.json(elements);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/billing-elements", async (req, res) => {
  try {
    if (req.body.transactionDate && !req.body.billingMonth) {
      req.body.billingMonth = req.body.transactionDate.substring(0, 7);
    }
    const data = validateBody(insertSm2BillingElementSchema, req.body);
    const element = await sm2Storage.createBillingElement(data);
    auditLog(req, "create_billing_element", "billing_element", element.id);
    res.json(element);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/billing-elements/:id", async (req, res) => {
  try {
    const existing = await sm2Storage.getBillingElement(req.params.id);
    if (!existing) return res.status(404).json({ message: "Billing element not found" });
    if (existing.billed) return res.status(400).json({ message: "Cannot edit a billed element" });

    const editSchema = z.object({
      horseId: z.string().uuid().nullable().optional(),
      itemId: z.string().uuid().optional(),
      quantity: z.number().int().min(1).optional(),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format").optional(),
      transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
    });
    const parsed = editSchema.parse(req.body);
    const allowedFields: Record<string, any> = {};
    if (parsed.horseId !== undefined) allowedFields.horseId = parsed.horseId;
    if (parsed.itemId !== undefined) allowedFields.itemId = parsed.itemId;
    if (parsed.quantity !== undefined) allowedFields.quantity = parsed.quantity;
    if (parsed.price !== undefined) allowedFields.price = parsed.price;
    if (parsed.transactionDate !== undefined) {
      allowedFields.transactionDate = parsed.transactionDate;
      allowedFields.billingMonth = parsed.transactionDate.substring(0, 7);
    }
    if (Object.keys(allowedFields).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    const updated = await sm2Storage.updateBillingElement(req.params.id, allowedFields);
    auditLog(req, "update_billing_element", "billing_element", req.params.id);
    res.json(updated);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: e.errors.map((err: any) => err.message).join(", ") });
    }
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.delete("/billing-elements/:id", async (req, res) => {
  try {
    const deleted = await sm2Storage.deleteBillingElement(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Billing element not found" });
    auditLog(req, "delete_billing_element", "billing_element", req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horses-with-agreements", async (_req, res) => {
  try {
    const horses = await sm2Storage.getHorsesWithActiveAgreements();
    res.json(horses);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horses-with-owners", async (_req, res) => {
  try {
    const horses = await sm2Storage.getHorsesWithOwners();
    res.json(horses);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Invoices ────────────────────────────────────────────────────────────────

router.get("/invoices", async (_req, res) => {
  try {
    const invoices = await sm2Storage.getInvoices();
    res.json(invoices);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/invoices/:id/details", async (req, res) => {
  try {
    const details = await sm2Storage.getInvoiceDetails(req.params.id);
    if (!details) return res.status(404).json({ message: "Invoice not found" });
    res.json(details);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/billed-months", async (req, res) => {
  try {
    const agreementIds = (req.query.agreementIds as string || "").split(",").filter(Boolean);
    const result = await sm2Storage.getBilledMonthsForAgreements(agreementIds);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { customerId, invoiceDate, billingMonth, totalAmount, billingElementIds, liveryItems } = req.body;
    if (!customerId || !invoiceDate || !totalAmount) {
      throw { status: 400, message: "Missing required fields: customerId, invoiceDate, totalAmount" };
    }

    if (billingMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      const unassigned = await sm2Storage.checkAgreementsHorseAssignment(billingMonth, customerId);
      if (unassigned.length > 0) {
        return res.status(400).json({
          message: "Invoice generation blocked — some boxes have no horse assigned for this period",
          unassignedAgreements: unassigned,
        });
      }
    }

    const invoice = await sm2Storage.createInvoice({ customerId, invoiceDate, billingMonth, totalAmount, status: "DRAFT" });

    if (liveryItems && Array.isArray(liveryItems) && liveryItems.length > 0) {
      for (const item of liveryItems) {
        const validatedItem = validateBody(insertSm2BillingElementSchema, {
          horseId: item.horseId,
          customerId,
          boxId: item.boxId,
          itemId: item.itemId,
          agreementId: item.agreementId,
          quantity: 1,
          price: item.price,
          transactionDate: invoiceDate,
          billingMonth: item.billingMonth,
          billed: true,
          invoiceId: invoice.id,
        });
        await sm2Storage.createBillingElement(validatedItem);
      }
    }

    if (billingElementIds && billingElementIds.length > 0) {
      await sm2Storage.markBillingElementsByIds(billingElementIds, invoice.id);
    }

    auditLog(req, "create_invoice", "invoice", invoice.id, `Created invoice for billing month ${billingMonth || "N/A"}`);
    res.json(invoice);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.delete("/invoices/:id", requireAdmin, async (req, res) => {
  try {
    await sm2Storage.deleteInvoice(req.params.id);
    auditLog(req, "delete_invoice", "invoice", req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/invoices/:id/rollback", requireRoles("LIVERY_ADMIN"), async (req, res) => {
  try {
    const invoice = await sm2Storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "PUSHED_TO_ERP") {
      return res.status(400).json({ message: "Cannot rollback an invoice that has been pushed to ERP" });
    }
    await sm2Storage.deleteInvoice(req.params.id);
    auditLog(req, "rollback_invoice", "invoice", req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/invoices/:id/send-for-validation", requireRoles("LIVERY_ADMIN"), async (req, res) => {
  try {
    const invoice = await sm2Storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const user = getUpUser(req);
    const smRole = getSmRole(user.role);
    if (invoice.status !== "DRAFT" && smRole !== "ADMIN") {
      return res.status(400).json({ message: "Invoice must be in DRAFT status to send for validation" });
    }
    await sm2Storage.updateInvoice(req.params.id, { status: "VET_VALIDATION" });
    await sm2Storage.createInvoiceValidation({
      invoiceId: req.params.id,
      step: smRole === "ADMIN" ? "ADMIN_OVERRIDE" : "VET",
      action: "APPROVED",
      userId: user.id,
      comment: "Sent for validation",
    });
    auditLog(req, "send_for_validation", "invoice", req.params.id, "Invoice sent for VET validation");
    res.json({ success: true, status: "VET_VALIDATION" });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/invoices/:id/validate", async (req, res) => {
  try {
    const invoice = await sm2Storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const user = getUpUser(req);
    const smRole = getSmRole(user.role);
    const { action, comment } = req.body;
    if (!action || !["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({ message: "Action must be APPROVED or REJECTED" });
    }

    const statusRoleMap: Record<string, { role: string; step: string; nextStatus: string }> = {
      "VET_VALIDATION": { role: "VETERINARY", step: "VET", nextStatus: "STORES_VALIDATION" },
      "STORES_VALIDATION": { role: "STORES", step: "STORES", nextStatus: "FINANCE_VALIDATION" },
      "FINANCE_VALIDATION": { role: "FINANCE", step: "FINANCE", nextStatus: "APPROVED" },
    };

    const currentStep = statusRoleMap[invoice.status];
    if (!currentStep && smRole !== "ADMIN") {
      return res.status(400).json({ message: "Invoice is not in a validation state" });
    }
    if (currentStep && smRole !== "ADMIN" && smRole !== currentStep.role) {
      return res.status(403).json({ message: `Only ${currentStep.role} or ADMIN can validate at this step` });
    }

    const step = smRole === "ADMIN" ? "ADMIN_OVERRIDE" : currentStep?.step || "ADMIN_OVERRIDE";

    if (action === "REJECTED") {
      await sm2Storage.updateInvoice(req.params.id, { status: "DRAFT" });
      await sm2Storage.createInvoiceValidation({
        invoiceId: req.params.id, step, action: "REJECTED", userId: user.id, comment: comment || null,
      });
      auditLog(req, "reject_invoice", "invoice", req.params.id, `Rejected at ${step}: ${comment || ""}`);
      return res.json({ success: true, status: "DRAFT" });
    }

    let newStatus: Sm2InvoiceStatus;
    if (smRole === "ADMIN") {
      if (invoice.status === "FINANCE_VALIDATION" || !currentStep) {
        newStatus = "APPROVED";
      } else {
        newStatus = currentStep.nextStatus as Sm2InvoiceStatus;
      }
    } else {
      newStatus = currentStep!.nextStatus as Sm2InvoiceStatus;
    }

    await sm2Storage.updateInvoice(req.params.id, { status: newStatus });
    await sm2Storage.createInvoiceValidation({
      invoiceId: req.params.id, step, action: "APPROVED", userId: user.id, comment: comment || null,
    });
    auditLog(req, "approve_invoice", "invoice", req.params.id, `Approved at ${step}, new status: ${newStatus}`);

    if (newStatus === "APPROVED" && currentStep?.step === "FINANCE") {
      try {
        const details = await sm2Storage.getInvoiceDetailsForSO(req.params.id);
        if (details?.customer?.netsuiteId) {
          const poNumber = invoice.poNumber || await sm2Storage.getNextPoNumber();
          const billingMonth = invoice.billingMonth || "";
          let memoMonth = "";
          if (billingMonth) {
            const [y, m] = billingMonth.split("-").map(Number);
            const date = new Date(y, m - 1);
            memoMonth = date.toLocaleString("en-US", { month: "short", year: "numeric" });
          }
          const customerName = details.customer ? details.customer.fullname : "Unknown";
          const today = new Date();
          const tranDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
          const soJson = {
            customerId: details.customer?.netsuiteId || "",
            po: poNumber,
            department: "32",
            memo: `Monthly Livery Invoice - ${customerName} (${memoMonth})`,
            tranDate,
            items: details.items,
          };
          const jsonString = JSON.stringify(soJson, null, 2);
          await sm2Storage.updateInvoice(req.params.id, {
            soGenerated: true, poNumber, netsuiteJson: jsonString,
          });

          const webhookUrl = await sm2Storage.getSetting("n8n_webhook_url");
          if (webhookUrl) {
            const webhookResponse = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: jsonString,
            });
            if (webhookResponse.ok) {
              let netsuiteId: string | null = null;
              try {
                const responseData = await webhookResponse.json();
                if (responseData?.netsuiteId) netsuiteId = String(responseData.netsuiteId);
                else if (responseData?.id) netsuiteId = String(responseData.id);
              } catch {}
              const erpUpdate: any = { sentToNetsuite: true, status: "PUSHED_TO_ERP" };
              if (netsuiteId) erpUpdate.netsuiteId = netsuiteId;
              await sm2Storage.updateInvoice(req.params.id, erpUpdate);
              return res.json({ success: true, status: "PUSHED_TO_ERP", erpPushed: true });
            }
          }
        }
      } catch (erpErr) {
        console.error("ERP push after finance approval failed:", erpErr);
      }
    }

    res.json({ success: true, status: newStatus });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/invoices/:id/validations", async (req, res) => {
  try {
    const validations = await sm2Storage.getInvoiceValidations(req.params.id);
    res.json(validations);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/invoices/:id/generate-so", requireRoles("FINANCE"), async (req, res) => {
  try {
    const invoice = await sm2Storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const details = await sm2Storage.getInvoiceDetailsForSO(req.params.id);
    if (!details) return res.status(404).json({ message: "Invoice details not found" });

    if (!details.customer?.netsuiteId) {
      return res.status(400).json({ message: "Customer does not have a NetSuite ID. Please set it before generating SO." });
    }

    const missingItems: string[] = [];
    for (const item of details.items) {
      if (!item.itemId) missingItems.push(`Item "${item.description}" is missing NetSuite ID`);
      if (item.horseId && !item.horse) missingItems.push(`Horse for item "${item.description}" is missing NetSuite ID`);
    }
    if (missingItems.length > 0) {
      return res.status(400).json({ message: `Missing NetSuite IDs:\n${missingItems.join("\n")}` });
    }

    const poNumber = invoice.poNumber || await sm2Storage.getNextPoNumber();
    const billingMonth = invoice.billingMonth || "";
    let memoMonth = "";
    if (billingMonth) {
      const [y, m] = billingMonth.split("-").map(Number);
      const date = new Date(y, m - 1);
      memoMonth = date.toLocaleString("en-US", { month: "short", year: "numeric" });
    }
    const customerName = details.customer ? details.customer.fullname : "Unknown";
    const today = new Date();
    const tranDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

    const soJson = {
      customerId: details.customer?.netsuiteId || "",
      po: poNumber,
      department: "32",
      memo: `Monthly Livery Invoice - ${customerName} (${memoMonth})`,
      tranDate,
      items: details.items,
    };

    const jsonString = JSON.stringify(soJson, null, 2);
    await sm2Storage.updateInvoice(req.params.id, {
      soGenerated: true,
      poNumber,
      netsuiteJson: jsonString,
      sentToNetsuite: false,
    });

    res.json({ success: true, poNumber, json: soJson });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

router.get("/reports/kpis", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month parameter required (YYYY-MM)" });
    }
    const data = await sm2Storage.getReportKpis(month);
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/reports/all-customers", async (_req, res) => {
  try {
    const data = await sm2Storage.getAllCustomersReport();
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/reports/livery", async (req, res) => {
  try {
    const groupBy = (req.query.groupBy as string) || "month";
    const month = req.query.month as string | undefined;
    const data = await sm2Storage.getReportData(groupBy, month);
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/reports/new-livery-horses", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month parameter required (YYYY-MM)" });
    }
    const data = await sm2Storage.getNewLiveryHorses(month);
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/reports/departed-livery-horses", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month parameter required (YYYY-MM)" });
    }
    const data = await sm2Storage.getDepartedLiveryHorses(month);
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/reports/livery-customers-info", async (_req, res) => {
  try {
    const data = await sm2Storage.getLiveryCustomersInfo();
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── NetSuite RESTlet ────────────────────────────────────────────────────────

router.post("/invoices/:id/send-to-netsuite", requireRoles("FINANCE"), async (req, res) => {
  try {
    const invoice = await sm2Storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (!invoice.soGenerated) return res.status(400).json({ message: "SO must be generated before sending to NetSuite" });
    if (!invoice.netsuiteJson) return res.status(400).json({ message: "No NetSuite JSON found on this invoice" });

    const restletUrl = process.env.NETSUITE_RESTLET_URL;
    const consumerKey = process.env.NETSUITE_CONSUMER_KEY;
    const consumerSecret = process.env.NETSUITE_CONSUMER_SECRET;
    const tokenId = process.env.NETSUITE_TOKEN_ID;
    const tokenSecret = process.env.NETSUITE_TOKEN_SECRET;
    const accountId = process.env.NETSUITE_ACCOUNT_ID;

    if (!restletUrl || !consumerKey || !consumerSecret || !tokenId || !tokenSecret || !accountId) {
      return res.status(400).json({ message: "NetSuite RESTlet credentials are not configured. Please set NETSUITE_* environment variables." });
    }

    const oauth = new OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: "HMAC-SHA256",
      hash_function(baseString: string, key: string) {
        return crypto.createHmac("sha256", key).update(baseString).digest("base64");
      },
    });

    const token = { key: tokenId, secret: tokenSecret };
    const requestData = { url: restletUrl, method: "POST" };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    const authWithRealm = authHeader.Authorization.replace(
      "OAuth ",
      `OAuth realm="${accountId}", `
    );

    const response = await fetch(restletUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authWithRealm,
        "Cookie": "",
      },
      body: invoice.netsuiteJson,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return res.status(502).json({ message: `NetSuite RESTlet returned error: ${response.status} - ${errorText}` });
    }

    let netsuiteId: string | null = null;
    try {
      const responseText = await response.text();
      console.log("[NetSuite] Raw response body:", responseText);
      const responseData = JSON.parse(responseText);
      console.log("[NetSuite] Parsed response keys:", Object.keys(responseData));
      if (responseData?.netsuiteId) netsuiteId = String(responseData.netsuiteId);
      else if (responseData?.salesOrderId) netsuiteId = String(responseData.salesOrderId);
      else if (responseData?.SalesOrderId) netsuiteId = String(responseData.SalesOrderId);
      else if (responseData?.salesOrderInternalId) netsuiteId = String(responseData.salesOrderInternalId);
      else if (responseData?.internalId) netsuiteId = String(responseData.internalId);
      else if (responseData?.id) netsuiteId = String(responseData.id);
      console.log("[NetSuite] Extracted netsuiteId:", netsuiteId);
    } catch {
      console.log("[NetSuite] Response was not valid JSON");
    }

    const updateData: any = { sentToNetsuite: true, status: "PUSHED_TO_ERP" };
    if (netsuiteId) updateData.netsuiteId = netsuiteId;
    await sm2Storage.updateInvoice(req.params.id, updateData);

    res.json({ success: true, netsuiteId });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get("/settings/n8n-webhook", async (_req, res) => {
  try {
    const url = await sm2Storage.getSetting("n8n_webhook_url");
    res.json({ url: url || "" });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/settings/n8n-webhook", requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (typeof url !== "string") return res.status(400).json({ message: "URL must be a string" });
    if (url.trim() && !/^https?:\/\/.+/i.test(url.trim())) {
      return res.status(400).json({ message: "URL must start with http:// or https://" });
    }
    await sm2Storage.setSetting("n8n_webhook_url", url.trim());
    auditLog(req, "update_setting", "setting", "n8n_webhook_url", `Updated N8N webhook URL`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/settings/livery-packages", requireAdmin, async (req, res) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) throw { status: 400, message: "itemIds must be an array" };
    const allItems = await sm2Storage.getItems();
    for (const item of allItems) {
      const isPackage = itemIds.includes(item.id);
      if (item.isLiveryPackage !== isPackage) {
        await sm2Storage.updateItem(item.id, { isLiveryPackage: isPackage });
      }
    }
    auditLog(req, "update_setting", "setting", "livery_packages", `Updated livery packages`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Agreement Documents ─────────────────────────────────────────────────────

router.get("/livery-agreements/:id/documents", async (req, res) => {
  try {
    const docs = await sm2Storage.getAgreementDocuments(req.params.id);
    res.json(docs.map(d => ({ id: d.id, agreementId: d.agreementId, filename: d.filename, uploadedAt: d.uploadedAt })));
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/livery-agreements/:id/documents", async (req, res) => {
  try {
    const { filename, fileData } = req.body;
    if (!filename || !fileData) throw { status: 400, message: "filename and fileData are required" };

    if (!fileData.startsWith("JVBERi")) {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    const existingDocs = await sm2Storage.getAgreementDocuments(req.params.id);
    if (existingDocs.length >= 20) {
      return res.status(400).json({ message: "Maximum 20 documents per agreement reached" });
    }

    const doc = await sm2Storage.createAgreementDocument({
      agreementId: req.params.id,
      filename,
      fileData,
    });
    auditLog(req, "upload_document", "agreement_document", doc.id, `Uploaded ${filename} for agreement ${req.params.id}`);
    res.json({ id: doc.id, agreementId: doc.agreementId, filename: doc.filename, uploadedAt: doc.uploadedAt });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/agreement-documents/:id/download", async (req, res) => {
  try {
    const doc = await sm2Storage.getAgreementDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const buffer = Buffer.from(doc.fileData, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.delete("/agreement-documents/:id", async (req, res) => {
  try {
    const deleted = await sm2Storage.deleteAgreementDocument(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Document not found" });
    auditLog(req, "delete_document", "agreement_document", req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get("/audit-logs", requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const logs = await sm2Storage.getAuditLogs(limit, offset);
    res.json(logs);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Horse Ownership ─────────────────────────────────────────────────────────

router.get("/horse-ownership/:horseId", async (req, res) => {
  try {
    const ownership = await sm2Storage.getHorseOwnershipByHorseId(req.params.horseId);
    res.json(ownership || null);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horse-ownership/customer/:customerId", async (req, res) => {
  try {
    const ownership = await sm2Storage.getHorseOwnershipByCustomerId(req.params.customerId);
    res.json(ownership);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horse-ownership", async (req, res) => {
  try {
    const data = validateBody(insertSm2HorseOwnershipSchema, req.body);
    const ownership = await sm2Storage.createHorseOwnership(data);
    res.json(ownership);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

// ─── Horse Movements ─────────────────────────────────────────────────────────

router.get("/horse-movements", async (_req, res) => {
  try {
    const movements = await sm2Storage.getHorseMovements();
    res.json(movements);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horse-movements/enriched", async (_req, res) => {
  try {
    const movements = await sm2Storage.getEnrichedHorseMovements();
    res.json(movements);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horse-movements/agreement/:agreementId", async (req, res) => {
  try {
    const movements = await sm2Storage.getHorseMovementsByAgreementId(req.params.agreementId);
    res.json(movements);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horse-movements/box/:boxId/active", async (req, res) => {
  try {
    const movement = await sm2Storage.getActiveMovementByBoxId(req.params.boxId);
    res.json(movement || null);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horse-movements", async (req, res) => {
  try {
    const data = validateBody(insertSm2HorseMovementSchema, req.body);
    const allMovements = await sm2Storage.getHorseMovements();
    const activeHorseMovement = allMovements.find(m => m.horseId === data.horseId && !m.checkOut);
    if (activeHorseMovement) {
      return res.status(400).json({ message: "This horse is already checked in to another box" });
    }
    if (data.stableboxId) {
      const activeBoxMovement = await sm2Storage.getActiveMovementByBoxId(data.stableboxId);
      if (activeBoxMovement) {
        return res.status(400).json({ message: "This box already has a horse checked in" });
      }
    }
    const movement = await sm2Storage.createHorseMovement(data);
    res.json(movement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.patch("/horse-movements/:id", async (req, res) => {
  try {
    const data = validateBody(insertSm2HorseMovementSchema.partial(), req.body);
    const movement = await sm2Storage.updateHorseMovement(req.params.id, data);
    if (!movement) return res.status(404).json({ message: "Movement not found" });
    res.json(movement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/horse-assignment-check", async (req, res) => {
  try {
    const billingMonth = req.query.billingMonth as string;
    const customerId = req.query.customerId as string | undefined;
    if (!billingMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      return res.status(400).json({ message: "billingMonth query param required (YYYY-MM, valid month 01-12)" });
    }
    const unassigned = await sm2Storage.checkAgreementsHorseAssignment(billingMonth, customerId);
    res.json(unassigned);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.get("/box-grid", async (_req, res) => {
  try {
    const grid = await sm2Storage.getBoxGridWithOccupants();
    res.json(grid);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horse-movements/move", async (req, res) => {
  try {
    const schema = z.object({ movementId: z.string().uuid(), newBoxId: z.string().uuid() });
    const data = validateBody(schema, req.body);
    const newMovement = await sm2Storage.moveHorseToBox(data.movementId, data.newBoxId);
    auditLog(req, "move_horse", "horse_movement", newMovement.id, `Moved horse to new box`);
    res.json(newMovement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

router.post("/horse-movements/swap", async (req, res) => {
  try {
    const schema = z.object({
      movementId: z.string().uuid(),
      newHorseId: z.string().uuid(),
    });
    const data = validateBody(schema, req.body);
    const newMovement = await sm2Storage.swapHorseInBox(data.movementId, data.newHorseId);
    auditLog(req, "swap_horse", "horse_movement", newMovement.id, `Swapped horse in box`);
    res.json(newMovement);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

export default router;
