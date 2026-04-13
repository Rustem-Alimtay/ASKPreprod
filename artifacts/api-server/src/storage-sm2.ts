/**
 * storage-sm2.ts
 * Storage class for the Stable-Master 2 (SM2) module.
 * All queries use the sm2_* prefixed tables from shared/sm2-schema.ts.
 */

import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  sm2Users, sm2Customers, sm2Horses, sm2Stables, sm2Boxes, sm2Items, sm2ItemPrices,
  sm2LiveryAgreements, sm2BillingElements, sm2Invoices, sm2AppSettings,
  sm2AgreementDocuments, sm2AuditLogs, sm2InvoiceValidations,
  sm2HorseOwnership, sm2HorseMovements,
  type Sm2User, type InsertSm2User,
  type Sm2Customer, type InsertSm2Customer,
  type Sm2Horse, type InsertSm2Horse,
  type Sm2Stable, type InsertSm2Stable,
  type Sm2Box, type InsertSm2Box,
  type Sm2Item, type InsertSm2Item,
  type Sm2ItemPrice, type InsertSm2ItemPrice,
  type Sm2LiveryAgreement, type InsertSm2LiveryAgreement,
  type Sm2BillingElement, type InsertSm2BillingElement,
  type Sm2Invoice, type InsertSm2Invoice,
  type Sm2AgreementDocument, type InsertSm2AgreementDocument,
  type Sm2AuditLog, type InsertSm2AuditLog,
  type Sm2InvoiceValidation, type InsertSm2InvoiceValidation,
  type Sm2HorseOwnership, type InsertSm2HorseOwnership,
  type Sm2HorseMovement, type InsertSm2HorseMovement,
} from "@workspace/db";

export class Sm2Storage {
  // ─── Users ───────────────────────────────────────────────────────────────
  async createUser(user: InsertSm2User): Promise<Sm2User> {
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [created] = await db.insert(sm2Users).values({ ...user, password: hashedPassword }).returning();
    return created;
  }

  async getUser(id: string): Promise<Sm2User | undefined> {
    const [user] = await db.select().from(sm2Users).where(eq(sm2Users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<Sm2User | undefined> {
    const [user] = await db.select().from(sm2Users).where(eq(sm2Users.username, username));
    return user;
  }

  async getUsers(): Promise<Omit<Sm2User, "password">[]> {
    return await db.select({ id: sm2Users.id, username: sm2Users.username, role: sm2Users.role }).from(sm2Users);
  }

  async updateUser(id: string, data: Partial<{ username: string; role: string }>): Promise<Sm2User | undefined> {
    const [updated] = await db.update(sm2Users).set(data).where(eq(sm2Users.id, id)).returning();
    return updated;
  }

  // ─── Customers ───────────────────────────────────────────────────────────
  async getCustomers(search?: string): Promise<Sm2Customer[]> {
    if (search) {
      return await db.select().from(sm2Customers).where(ilike(sm2Customers.fullname, `%${search}%`));
    }
    return await db.select().from(sm2Customers);
  }

  async getCustomer(id: string): Promise<Sm2Customer | undefined> {
    const [customer] = await db.select().from(sm2Customers).where(eq(sm2Customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertSm2Customer): Promise<Sm2Customer> {
    const [created] = await db.insert(sm2Customers).values(customer).returning();
    return created;
  }

  async updateCustomer(id: string, customer: Partial<InsertSm2Customer>): Promise<Sm2Customer | undefined> {
    const [updated] = await db.update(sm2Customers).set(customer).where(eq(sm2Customers.id, id)).returning();
    return updated;
  }

  // ─── Horses ──────────────────────────────────────────────────────────────
  async getHorses(search?: string, customerSearch?: string, stableBoxSearch?: string): Promise<any[]> {
    const allHorses = await db.select().from(sm2Horses);
    const allAgreements = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, "active"));
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allOwnership = await db.select().from(sm2HorseOwnership);
    const allMovements = await db.select().from(sm2HorseMovements);

    let result = allHorses.map(horse => {
      const activeMovement = allMovements.find(m => m.horseId === horse.id && !m.checkOut);
      const agreement = activeMovement ? allAgreements.find(a => a.id === activeMovement.agreementId) : null;
      const customer = agreement ? allCustomers.find(c => c.id === agreement.customerId) : null;
      const box = agreement ? allBoxes.find(b => b.id === agreement.boxId) : null;
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const ownershipRecords = allOwnership.filter(o => o.horseId === horse.id);
      const ownership = ownershipRecords.length > 0
        ? ownershipRecords.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0]
        : null;
      const owner = ownership ? allCustomers.find(c => c.id === ownership.customerId) : null;
      return {
        ...horse,
        customer: customer ? customer.fullname : null,
        customerId: customer?.id || null,
        box: box?.name || null,
        boxId: box?.id || null,
        stable: stable?.name || null,
        stableId: stable?.id || null,
        ownerName: owner ? owner.fullname : null,
        ownerId: ownership?.customerId || null,
      };
    });

    if (search) result = result.filter(h => h.horseName.toLowerCase().includes(search.toLowerCase()));
    if (customerSearch) result = result.filter(h => h.customer && h.customer.toLowerCase().includes(customerSearch.toLowerCase()));
    if (stableBoxSearch) {
      result = result.filter(h =>
        (h.stable && h.stable.toLowerCase().includes(stableBoxSearch.toLowerCase())) ||
        (h.box && h.box.toLowerCase().includes(stableBoxSearch.toLowerCase()))
      );
    }
    return result;
  }

  async getHorse(id: string): Promise<Sm2Horse | undefined> {
    const [horse] = await db.select().from(sm2Horses).where(eq(sm2Horses.id, id));
    return horse;
  }

  async createHorse(horse: InsertSm2Horse): Promise<Sm2Horse> {
    const [created] = await db.insert(sm2Horses).values(horse).returning();
    return created;
  }

  async createHorseWithOwner(horse: InsertSm2Horse, ownerId: string): Promise<Sm2Horse> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(sm2Horses).values(horse).returning();
      await tx.insert(sm2HorseOwnership).values({ horseId: created.id, customerId: ownerId });
      return created;
    });
  }

  async updateHorse(id: string, horse: Partial<InsertSm2Horse>): Promise<Sm2Horse | undefined> {
    const [updated] = await db.update(sm2Horses).set(horse).where(eq(sm2Horses.id, id)).returning();
    return updated;
  }

  async createHorsesBulk(horsesList: InsertSm2Horse[]): Promise<Sm2Horse[]> {
    if (horsesList.length === 0) return [];
    const batchSize = 100;
    const results: Sm2Horse[] = [];
    for (let i = 0; i < horsesList.length; i += batchSize) {
      const batch = horsesList.slice(i, i + batchSize);
      const created = await db.insert(sm2Horses).values(batch).returning();
      results.push(...created);
    }
    return results;
  }

  async getAvailableHorses(): Promise<any[]> {
    const allHorses = await db.select().from(sm2Horses).where(eq(sm2Horses.status, "active"));
    const activeMovements = await db.select().from(sm2HorseMovements).where(sql`${sm2HorseMovements.checkOut} IS NULL`);
    const checkedInHorseIds = new Set(activeMovements.map(m => m.horseId));
    return allHorses.filter(h => !checkedInHorseIds.has(h.id));
  }

  async getHorsesWithActiveAgreements(): Promise<any[]> {
    const allAgreements = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, "active"));
    const today = new Date().toISOString().split("T")[0];
    const activeAgreements = allAgreements.filter(a => !a.endDate || a.endDate >= today);
    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allMovements = await db.select().from(sm2HorseMovements);

    return activeAgreements.map(agreement => {
      const activeMovement = allMovements.find(m => m.agreementId === agreement.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const box = allBoxes.find(b => b.id === agreement.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      return {
        horseId: horse?.id || null,
        horseName: horse?.horseName || "Unknown",
        customerId: customer?.id,
        customerName: customer ? customer.fullname : "Unknown",
        boxId: box?.id,
        boxName: box?.name || "Unknown",
        stableId: stable?.id,
        stableName: stable?.name || "Unknown",
        agreementId: agreement.id,
      };
    });
  }

  async getHorsesWithOwners(): Promise<any[]> {
    const allHorses = await db.select().from(sm2Horses).where(eq(sm2Horses.status, "active"));
    const allOwnership = await db.select().from(sm2HorseOwnership);
    const allCustomers = await db.select().from(sm2Customers);
    const allMovements = await db.select().from(sm2HorseMovements);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);

    return allHorses.map(horse => {
      const ownershipRecords = allOwnership.filter(o => o.horseId === horse.id);
      const ownership = ownershipRecords.length > 0
        ? ownershipRecords.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0]
        : null;
      const owner = ownership ? allCustomers.find(c => c.id === ownership.customerId) : null;
      const activeMovement = allMovements.find(m => m.horseId === horse.id && !m.checkOut);
      const box = activeMovement ? allBoxes.find(b => b.id === activeMovement.stableboxId) : null;
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      return {
        horseId: horse.id,
        horseName: horse.horseName,
        ownerId: owner?.id || null,
        ownerName: owner?.fullname || "—",
        boxId: box?.id || null,
        boxName: box?.name || null,
        stableName: stable?.name || null,
      };
    });
  }

  // ─── Stables ─────────────────────────────────────────────────────────────
  async getStables(): Promise<Sm2Stable[]> {
    return await db.select().from(sm2Stables);
  }

  async getStable(id: string): Promise<Sm2Stable | undefined> {
    const [stable] = await db.select().from(sm2Stables).where(eq(sm2Stables.id, id));
    return stable;
  }

  async createStable(stable: InsertSm2Stable): Promise<Sm2Stable> {
    const [created] = await db.insert(sm2Stables).values(stable).returning();
    return created;
  }

  async updateStable(id: string, stable: Partial<InsertSm2Stable>): Promise<Sm2Stable | undefined> {
    const [updated] = await db.update(sm2Stables).set(stable).where(eq(sm2Stables.id, id)).returning();
    return updated;
  }

  async deleteStable(id: string): Promise<boolean> {
    await db.delete(sm2Stables).where(eq(sm2Stables.id, id));
    return true;
  }

  // ─── Boxes ───────────────────────────────────────────────────────────────
  async getBoxes(stableSearch?: string, boxSearch?: string): Promise<any[]> {
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);

    let result = allBoxes.map(box => {
      const stable = allStables.find(s => s.id === box.stableId);
      return { ...box, stableName: stable?.name || "Unknown" };
    });

    if (stableSearch) result = result.filter(b => b.stableName.toLowerCase().includes(stableSearch.toLowerCase()));
    if (boxSearch) result = result.filter(b => b.name.toLowerCase().includes(boxSearch.toLowerCase()));
    return result;
  }

  async getBox(id: string): Promise<Sm2Box | undefined> {
    const [box] = await db.select().from(sm2Boxes).where(eq(sm2Boxes.id, id));
    return box;
  }

  async createBox(box: InsertSm2Box): Promise<Sm2Box> {
    const [created] = await db.insert(sm2Boxes).values(box).returning();
    return created;
  }

  async updateBox(id: string, box: Partial<InsertSm2Box>): Promise<Sm2Box | undefined> {
    const [updated] = await db.update(sm2Boxes).set(box).where(eq(sm2Boxes.id, id)).returning();
    return updated;
  }

  async deleteBox(id: string): Promise<boolean> {
    await db.delete(sm2Boxes).where(eq(sm2Boxes.id, id));
    return true;
  }

  async getBoxesWithAgreementStatus(): Promise<any[]> {
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const activeAgreements = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, "active"));
    const allMovements = await db.select().from(sm2HorseMovements);
    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const today = new Date().toISOString().split("T")[0];

    return allBoxes.map(box => {
      const stable = allStables.find(s => s.id === box.stableId);
      const agreement = activeAgreements.find(a => a.boxId === box.id && (!a.endDate || a.endDate >= today));
      const activeMovement = allMovements.find(m => m.stableboxId === box.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const customer = agreement ? allCustomers.find(c => c.id === agreement.customerId) : null;
      return {
        ...box,
        stableName: stable?.name || "Unknown",
        isAvailable: !agreement,
        agreementId: agreement?.id || null,
        horseName: horse?.horseName || null,
        customerName: customer?.fullname || null,
      };
    });
  }

  async getBoxGridWithOccupants(): Promise<any[]> {
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allMovements = await db.select().from(sm2HorseMovements);
    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const allAgreements = await db.select().from(sm2LiveryAgreements);
    const allItems = await db.select().from(sm2Items);
    const today = new Date().toISOString().split("T")[0];

    return allBoxes.map(box => {
      const stable = allStables.find(s => s.id === box.stableId);
      const activeMovement = allMovements.find(m => m.stableboxId === box.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      let agreement = activeMovement?.agreementId ? allAgreements.find(a => a.id === activeMovement.agreementId) : null;
      if (!agreement) {
        agreement = allAgreements.find(a => a.boxId === box.id && a.status === "active" && (!a.endDate || a.endDate >= today)) || null;
      }
      const customer = agreement ? allCustomers.find(c => c.id === agreement!.customerId) : null;
      const item = agreement ? allItems.find(i => i.id === agreement!.itemId) : null;
      return {
        ...box,
        stableName: stable?.name || "Unknown",
        isOccupied: !!activeMovement,
        hasAgreement: !!agreement,
        movementId: activeMovement?.id || null,
        horseId: horse?.id || null,
        horseName: horse?.horseName || null,
        customerId: customer?.id || null,
        customerName: customer?.fullname || null,
        agreementId: agreement?.id || null,
        itemName: item?.name || null,
        monthlyAmount: agreement?.monthlyAmount || null,
        checkIn: activeMovement?.checkIn || null,
      };
    });
  }

  // ─── Items ───────────────────────────────────────────────────────────────
  async getItems(search?: string): Promise<Sm2Item[]> {
    if (search) return await db.select().from(sm2Items).where(ilike(sm2Items.name, `%${search}%`));
    return await db.select().from(sm2Items);
  }

  async getItem(id: string): Promise<Sm2Item | undefined> {
    const [item] = await db.select().from(sm2Items).where(eq(sm2Items.id, id));
    return item;
  }

  async createItem(item: InsertSm2Item): Promise<Sm2Item> {
    const [created] = await db.insert(sm2Items).values(item).returning();
    return created;
  }

  async createItemsBulk(itemsList: InsertSm2Item[]): Promise<Sm2Item[]> {
    if (itemsList.length === 0) return [];
    const batchSize = 100;
    const results: Sm2Item[] = [];
    for (let i = 0; i < itemsList.length; i += batchSize) {
      const batch = itemsList.slice(i, i + batchSize);
      const created = await db.insert(sm2Items).values(batch).returning();
      results.push(...created);
    }
    return results;
  }

  async updateItem(id: string, item: Partial<InsertSm2Item>): Promise<Sm2Item | undefined> {
    const [updated] = await db.update(sm2Items).set(item).where(eq(sm2Items.id, id)).returning();
    return updated;
  }

  async getLiveryPackageItems(): Promise<Sm2Item[]> {
    return await db.select().from(sm2Items).where(eq(sm2Items.isLiveryPackage, true));
  }

  async getNonLiveryPackageItems(): Promise<Sm2Item[]> {
    return await db.select().from(sm2Items).where(eq(sm2Items.isLiveryPackage, false));
  }

  async getItemPriceHistory(itemId: string): Promise<Sm2ItemPrice[]> {
    return await db.select().from(sm2ItemPrices).where(eq(sm2ItemPrices.itemId, itemId)).orderBy(desc(sm2ItemPrices.createdAt));
  }

  async changeItemPrice(itemId: string, newPrice: string, createdBy?: string): Promise<Sm2ItemPrice> {
    return await db.transaction(async (tx) => {
      await tx.update(sm2ItemPrices).set({ isActive: false }).where(and(eq(sm2ItemPrices.itemId, itemId), eq(sm2ItemPrices.isActive, true)));
      const [newRecord] = await tx.insert(sm2ItemPrices).values({ itemId, price: newPrice, isActive: true, createdBy: createdBy || null }).returning();
      await tx.update(sm2Items).set({ price: newPrice }).where(eq(sm2Items.id, itemId));
      return newRecord;
    });
  }

  // ─── Livery Agreements ───────────────────────────────────────────────────
  async getLiveryAgreements(status?: string): Promise<any[]> {
    const allAgreements = status
      ? await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, status))
      : await db.select().from(sm2LiveryAgreements);
    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allItems = await db.select().from(sm2Items);
    const allMovements = await db.select().from(sm2HorseMovements);

    return allAgreements.map(agreement => {
      const activeMovement = allMovements.find(m => m.agreementId === agreement.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const box = allBoxes.find(b => b.id === agreement.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const item = allItems.find(i => i.id === agreement.itemId);
      return {
        ...agreement,
        horseName: horse?.horseName || null,
        horseId: horse?.id || null,
        customerName: customer ? customer.fullname : "Unknown",
        boxName: box?.name || "Unknown",
        stableName: stable?.name || "Unknown",
        itemName: item?.name || "Unknown",
      };
    });
  }

  async getLiveryAgreement(id: string): Promise<Sm2LiveryAgreement | undefined> {
    const [agreement] = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.id, id));
    return agreement;
  }

  async createLiveryAgreement(agreement: InsertSm2LiveryAgreement): Promise<Sm2LiveryAgreement> {
    const [created] = await db.insert(sm2LiveryAgreements).values(agreement).returning();
    return created;
  }

  async updateLiveryAgreement(id: string, agreement: Partial<InsertSm2LiveryAgreement>): Promise<Sm2LiveryAgreement | undefined> {
    const [updated] = await db.update(sm2LiveryAgreements).set(agreement).where(eq(sm2LiveryAgreements.id, id)).returning();
    return updated;
  }

  // ─── Billing Elements ────────────────────────────────────────────────────
  async getBillingElements(billed?: boolean): Promise<any[]> {
    const query = billed !== undefined
      ? await db.select().from(sm2BillingElements).where(eq(sm2BillingElements.billed, billed))
      : await db.select().from(sm2BillingElements);

    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allItems = await db.select().from(sm2Items);

    return query.map(element => {
      const horse = element.horseId ? allHorses.find(h => h.id === element.horseId) : null;
      const customer = allCustomers.find(c => c.id === element.customerId);
      const box = allBoxes.find(b => b.id === element.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const item = allItems.find(i => i.id === element.itemId);
      return {
        ...element,
        horseName: horse?.horseName || null,
        customerName: customer ? customer.fullname : "Unknown",
        boxName: box?.name || "Unknown",
        stableName: stable?.name || "Unknown",
        itemName: item?.name || "Unknown",
      };
    });
  }

  async getBillingElement(id: string): Promise<Sm2BillingElement | undefined> {
    const [element] = await db.select().from(sm2BillingElements).where(eq(sm2BillingElements.id, id));
    return element;
  }

  async createBillingElement(element: InsertSm2BillingElement): Promise<Sm2BillingElement> {
    const [created] = await db.insert(sm2BillingElements).values(element).returning();
    return created;
  }

  async updateBillingElement(id: string, data: Partial<InsertSm2BillingElement>): Promise<Sm2BillingElement | undefined> {
    const [updated] = await db.update(sm2BillingElements).set(data).where(eq(sm2BillingElements.id, id)).returning();
    return updated;
  }

  async deleteBillingElement(id: string): Promise<boolean> {
    const result = await db.delete(sm2BillingElements).where(eq(sm2BillingElements.id, id)).returning();
    return result.length > 0;
  }

  async markBillingElementsByIds(elementIds: string[], invoiceId: string): Promise<void> {
    for (const id of elementIds) {
      await db.update(sm2BillingElements).set({ billed: true, invoiceId }).where(eq(sm2BillingElements.id, id));
    }
  }

  async getBilledMonthsForAgreements(agreementIds: string[]): Promise<Record<string, string[]>> {
    if (agreementIds.length === 0) return {};
    const allBilled = await db.select().from(sm2BillingElements)
      .where(and(eq(sm2BillingElements.billed, true), sql`${sm2BillingElements.agreementId} IS NOT NULL`));
    const result: Record<string, string[]> = {};
    for (const el of allBilled) {
      if (el.agreementId && el.billingMonth) {
        if (!result[el.agreementId]) result[el.agreementId] = [];
        result[el.agreementId].push(el.billingMonth);
      }
    }
    return result;
  }

  // ─── Invoices ────────────────────────────────────────────────────────────
  async getInvoices(): Promise<any[]> {
    const allInvoices = await db.select().from(sm2Invoices).orderBy(desc(sm2Invoices.invoiceDate));
    const allCustomers = await db.select().from(sm2Customers);
    return allInvoices.map(invoice => {
      const customer = allCustomers.find(c => c.id === invoice.customerId);
      return { ...invoice, customerName: customer ? customer.fullname : "Unknown" };
    });
  }

  async getInvoice(id: string): Promise<Sm2Invoice | undefined> {
    const [invoice] = await db.select().from(sm2Invoices).where(eq(sm2Invoices.id, id));
    return invoice;
  }

  async getInvoiceDetails(id: string): Promise<any> {
    const [invoice] = await db.select().from(sm2Invoices).where(eq(sm2Invoices.id, id));
    if (!invoice) return null;

    const customer = await this.getCustomer(invoice.customerId);
    const linkedElements = await db.select().from(sm2BillingElements).where(eq(sm2BillingElements.invoiceId, id));
    const allHorses = await db.select().from(sm2Horses);
    const allItems = await db.select().from(sm2Items);

    const lineItems = linkedElements.map(el => {
      const horse = el.horseId ? allHorses.find(h => h.id === el.horseId) : null;
      const item = allItems.find(i => i.id === el.itemId);
      return {
        description: item?.name || "Unknown",
        horseName: horse?.horseName || "—",
        billDate: el.transactionDate,
        quantity: el.quantity,
        unit: item?.unitFactor ? `${item.unitFactor}` : "Each",
        unitPrice: (el.quantity || 1) > 0 ? parseFloat(el.price || "0") / (el.quantity || 1) : parseFloat(el.price || "0"),
        amount: parseFloat(el.price || "0"),
        isLivery: !!el.agreementId,
        billingMonth: el.billingMonth,
      };
    });

    return {
      ...invoice,
      customerName: customer ? customer.fullname : "Unknown",
      customerNumber: customer?.netsuiteId || "",
      lineItems,
    };
  }

  async createInvoice(invoice: InsertSm2Invoice): Promise<Sm2Invoice> {
    const [created] = await db.insert(sm2Invoices).values(invoice).returning();
    return created;
  }

  async updateInvoice(id: string, data: Partial<Sm2Invoice>): Promise<Sm2Invoice | undefined> {
    const [updated] = await db.update(sm2Invoices).set(data).where(eq(sm2Invoices.id, id)).returning();
    return updated;
  }

  async unbillByInvoiceId(invoiceId: string): Promise<void> {
    await db.update(sm2BillingElements)
      .set({ billed: false, invoiceId: null })
      .where(eq(sm2BillingElements.invoiceId, invoiceId));
  }

  async deleteInvoice(id: string): Promise<boolean> {
    await db.delete(sm2BillingElements)
      .where(and(eq(sm2BillingElements.invoiceId, id), sql`${sm2BillingElements.agreementId} IS NOT NULL`));
    await db.update(sm2BillingElements)
      .set({ billed: false, invoiceId: null })
      .where(eq(sm2BillingElements.invoiceId, id));
    await db.delete(sm2Invoices).where(eq(sm2Invoices.id, id));
    return true;
  }

  async getInvoiceDetailsForSO(id: string): Promise<any> {
    const [invoice] = await db.select().from(sm2Invoices).where(eq(sm2Invoices.id, id));
    if (!invoice) return null;

    const customer = await this.getCustomer(invoice.customerId);
    const linkedElements = await db.select().from(sm2BillingElements).where(eq(sm2BillingElements.invoiceId, id));
    const allHorses = await db.select().from(sm2Horses);
    const allItems = await db.select().from(sm2Items);
    const allBoxes = await db.select().from(sm2Boxes);

    const itemsList = linkedElements.map(el => {
      const horse = el.horseId ? allHorses.find(h => h.id === el.horseId) : null;
      const item = allItems.find(i => i.id === el.itemId);
      const box = allBoxes.find(b => b.id === el.boxId);
      return {
        itemId: item?.netsuiteId || "",
        horseId: el.horseId,
        horse: horse ? String(horse.netsuiteId || "") : "",
        quantity: el.quantity,
        rate: (el.quantity || 1) > 0 ? parseFloat(el.price || "0") / (el.quantity || 1) : parseFloat(el.price || "0"),
        description: item?.name || "Unknown",
        department: item?.department || "",
        class: item?.class || "",
        subclass: box?.netsuiteId || "",
        location: item?.location || "",
      };
    });

    return { invoice, customer, items: itemsList };
  }

  async getNextPoNumber(): Promise<string> {
    const [setting] = await db.select().from(sm2AppSettings).where(eq(sm2AppSettings.key, "last_po_number"));
    const current = setting ? parseInt(setting.value) : 2026002999;
    const next = current + 1;
    await db.insert(sm2AppSettings)
      .values({ key: "last_po_number", value: String(next) })
      .onConflictDoUpdate({ target: sm2AppSettings.key, set: { value: String(next) } });
    return String(next);
  }

  // ─── App Settings ────────────────────────────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(sm2AppSettings).where(eq(sm2AppSettings.key, key));
    return setting ? setting.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(sm2AppSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: sm2AppSettings.key, set: { value } });
  }

  // ─── Agreement Documents ─────────────────────────────────────────────────
  async getAgreementDocuments(agreementId: string): Promise<Sm2AgreementDocument[]> {
    return await db.select().from(sm2AgreementDocuments).where(eq(sm2AgreementDocuments.agreementId, agreementId));
  }

  async getAgreementDocument(id: string): Promise<Sm2AgreementDocument | undefined> {
    const [doc] = await db.select().from(sm2AgreementDocuments).where(eq(sm2AgreementDocuments.id, id));
    return doc;
  }

  async createAgreementDocument(doc: InsertSm2AgreementDocument): Promise<Sm2AgreementDocument> {
    const [created] = await db.insert(sm2AgreementDocuments).values(doc).returning();
    return created;
  }

  async deleteAgreementDocument(id: string): Promise<boolean> {
    const result = await db.delete(sm2AgreementDocuments).where(eq(sm2AgreementDocuments.id, id)).returning();
    return result.length > 0;
  }

  // ─── Audit Logs ──────────────────────────────────────────────────────────
  async createAuditLog(log: InsertSm2AuditLog): Promise<Sm2AuditLog> {
    const [created] = await db.insert(sm2AuditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(limit = 50, offset = 0): Promise<{ logs: Sm2AuditLog[]; total: number }> {
    const logs = await db.select().from(sm2AuditLogs).orderBy(desc(sm2AuditLogs.createdAt)).limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(sm2AuditLogs);
    return { logs, total: Number(countResult.count) };
  }

  // ─── Invoice Validations ─────────────────────────────────────────────────
  async createInvoiceValidation(validation: InsertSm2InvoiceValidation): Promise<Sm2InvoiceValidation> {
    const [created] = await db.insert(sm2InvoiceValidations).values(validation).returning();
    return created;
  }

  async getInvoiceValidations(invoiceId: string): Promise<Sm2InvoiceValidation[]> {
    return await db.select().from(sm2InvoiceValidations)
      .where(eq(sm2InvoiceValidations.invoiceId, invoiceId))
      .orderBy(desc(sm2InvoiceValidations.createdAt));
  }

  // ─── Horse Ownership ─────────────────────────────────────────────────────
  async createHorseOwnership(ownership: InsertSm2HorseOwnership): Promise<Sm2HorseOwnership> {
    const [created] = await db.insert(sm2HorseOwnership).values(ownership).returning();
    return created;
  }

  async getHorseOwnershipByHorseId(horseId: string): Promise<Sm2HorseOwnership | undefined> {
    const [ownership] = await db.select().from(sm2HorseOwnership).where(eq(sm2HorseOwnership.horseId, horseId));
    return ownership;
  }

  async getHorseOwnership(horseId: string): Promise<Sm2HorseOwnership[]> {
    return await db.select().from(sm2HorseOwnership).where(eq(sm2HorseOwnership.horseId, horseId));
  }

  async getHorseOwnershipByCustomerId(customerId: string): Promise<Sm2HorseOwnership[]> {
    return await db.select().from(sm2HorseOwnership).where(eq(sm2HorseOwnership.customerId, customerId));
  }

  // ─── Horse Movements ─────────────────────────────────────────────────────
  async createHorseMovement(movement: InsertSm2HorseMovement): Promise<Sm2HorseMovement> {
    const [created] = await db.insert(sm2HorseMovements).values(movement).returning();
    return created;
  }

  async updateHorseMovement(id: string, data: Partial<InsertSm2HorseMovement>): Promise<Sm2HorseMovement | undefined> {
    const [updated] = await db.update(sm2HorseMovements).set(data).where(eq(sm2HorseMovements.id, id)).returning();
    return updated;
  }

  async getHorseMovementsByAgreementId(agreementId: string): Promise<Sm2HorseMovement[]> {
    return await db.select().from(sm2HorseMovements).where(eq(sm2HorseMovements.agreementId, agreementId));
  }

  async getActiveMovementByBoxId(boxId: string): Promise<Sm2HorseMovement | undefined> {
    const [movement] = await db.select().from(sm2HorseMovements)
      .where(and(eq(sm2HorseMovements.stableboxId, boxId), sql`${sm2HorseMovements.checkOut} IS NULL`));
    return movement;
  }

  async getHorseMovements(): Promise<Sm2HorseMovement[]> {
    return await db.select().from(sm2HorseMovements).orderBy(desc(sm2HorseMovements.createdAt));
  }

  async getEnrichedHorseMovements(): Promise<any[]> {
    const allMovements = await db.select().from(sm2HorseMovements).orderBy(desc(sm2HorseMovements.createdAt));
    const allHorses = await db.select().from(sm2Horses);
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allAgreements = await db.select().from(sm2LiveryAgreements);

    return allMovements.map(m => {
      const horse = allHorses.find(h => h.id === m.horseId);
      const box = allBoxes.find(b => b.id === m.stableboxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const agreement = m.agreementId ? allAgreements.find(a => a.id === m.agreementId) : null;
      const customer = agreement ? allCustomers.find(c => c.id === agreement.customerId) : null;
      return {
        ...m,
        horseName: horse?.horseName || "Unknown",
        customerName: customer?.fullname || "Unknown",
        boxName: box?.name || "Unknown",
        stableName: stable?.name || "Unknown",
      };
    });
  }

  async moveHorseToBox(movementId: string, newBoxId: string): Promise<any> {
    return await db.transaction(async (tx) => {
      const [currentMovement] = await tx.select().from(sm2HorseMovements).where(eq(sm2HorseMovements.id, movementId));
      if (!currentMovement || currentMovement.checkOut) {
        throw { status: 400, message: "No active movement found with that ID" };
      }
      const [existingOccupant] = await tx.select().from(sm2HorseMovements)
        .where(and(eq(sm2HorseMovements.stableboxId, newBoxId), sql`${sm2HorseMovements.checkOut} IS NULL`));
      if (existingOccupant) throw { status: 400, message: "Target box already has a horse checked in" };
      const [targetBox] = await tx.select().from(sm2Boxes).where(eq(sm2Boxes.id, newBoxId));
      if (!targetBox) throw { status: 400, message: "Target box does not exist" };

      const today = new Date().toISOString().split("T")[0];
      const existingAgreements = await tx.select().from(sm2LiveryAgreements)
        .where(and(eq(sm2LiveryAgreements.boxId, newBoxId), eq(sm2LiveryAgreements.status, "active")));
      const activeAgreementOnTarget = existingAgreements.find(a => !a.endDate || a.endDate >= today);
      if (activeAgreementOnTarget) {
        const sourceAgreement = currentMovement.agreementId
          ? (await tx.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.id, currentMovement.agreementId)))[0]
          : null;
        if (!sourceAgreement || sourceAgreement.customerId !== activeAgreementOnTarget.customerId) {
          throw { status: 400, message: "Target box has an active agreement for a different customer" };
        }
      }

      await tx.update(sm2HorseMovements).set({ checkOut: today }).where(eq(sm2HorseMovements.id, movementId));
      const targetAgreementId = activeAgreementOnTarget ? activeAgreementOnTarget.id : currentMovement.agreementId;
      const [newMovement] = await tx.insert(sm2HorseMovements).values({
        agreementId: targetAgreementId,
        horseId: currentMovement.horseId,
        stableboxId: newBoxId,
        checkIn: today,
      }).returning();
      if (currentMovement.agreementId && !activeAgreementOnTarget) {
        await tx.update(sm2LiveryAgreements).set({ boxId: newBoxId }).where(eq(sm2LiveryAgreements.id, currentMovement.agreementId));
      }
      return newMovement;
    });
  }

  async swapHorseInBox(movementId: string, newHorseId: string): Promise<any> {
    return await db.transaction(async (tx) => {
      const [currentMovement] = await tx.select().from(sm2HorseMovements).where(eq(sm2HorseMovements.id, movementId));
      if (!currentMovement || currentMovement.checkOut) {
        throw { status: 400, message: "No active movement found with that ID" };
      }
      const [newHorse] = await tx.select().from(sm2Horses).where(eq(sm2Horses.id, newHorseId));
      if (!newHorse) throw { status: 400, message: "Horse not found" };

      if (currentMovement.agreementId) {
        const [agreement] = await tx.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.id, currentMovement.agreementId));
        if (agreement) {
          const [ownership] = await tx.select().from(sm2HorseOwnership).where(eq(sm2HorseOwnership.horseId, newHorseId));
          if (!ownership || ownership.customerId !== agreement.customerId) {
            throw { status: 400, message: "Replacement horse must belong to the same customer as the agreement" };
          }
        }
      }

      const [existingActiveMovement] = await tx.select().from(sm2HorseMovements)
        .where(and(eq(sm2HorseMovements.horseId, newHorseId), sql`${sm2HorseMovements.checkOut} IS NULL`));
      if (existingActiveMovement) throw { status: 400, message: "This horse is already checked in to another box" };

      const today = new Date().toISOString().split("T")[0];
      await tx.update(sm2HorseMovements).set({ checkOut: today }).where(eq(sm2HorseMovements.id, movementId));
      const [newMovement] = await tx.insert(sm2HorseMovements).values({
        agreementId: currentMovement.agreementId,
        horseId: newHorseId,
        stableboxId: currentMovement.stableboxId,
        checkIn: today,
      }).returning();
      return newMovement;
    });
  }

  async checkAgreementsHorseAssignment(billingMonth: string, customerId?: string): Promise<any[]> {
    const [bmYear, bmMonth] = billingMonth.split("-").map(Number);
    const periodStart = `${bmYear}-${String(bmMonth).padStart(2, "0")}-01`;
    const daysInMonth = new Date(bmYear, bmMonth, 0).getDate();
    const periodEnd = `${bmYear}-${String(bmMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const allAgreements = customerId
      ? await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.customerId, customerId))
      : await db.select().from(sm2LiveryAgreements);
    const activeAgreements = allAgreements.filter(a => {
      if (a.status !== "active" && a.status !== "ended") return false;
      if (a.startDate && a.startDate > periodEnd) return false;
      if (a.endDate && a.endDate < periodStart) return false;
      return true;
    });

    const allMovements = await db.select().from(sm2HorseMovements);
    const allCustomers = await db.select().from(sm2Customers);
    const allBoxes = await db.select().from(sm2Boxes);
    const allItems = await db.select().from(sm2Items);

    const unassigned: any[] = [];
    for (const agreement of activeAgreements) {
      const hasOverlapping = allMovements.some(m => {
        if (m.agreementId !== agreement.id) return false;
        if (m.checkIn > periodEnd) return false;
        if (m.checkOut && m.checkOut < periodStart) return false;
        return true;
      });
      if (!hasOverlapping) {
        const customer = allCustomers.find(c => c.id === agreement.customerId);
        const box = allBoxes.find(b => b.id === agreement.boxId);
        const item = allItems.find(i => i.id === agreement.itemId);
        unassigned.push({
          agreementId: agreement.id,
          referenceNumber: agreement.referenceNumber,
          customerName: customer?.fullname || "Unknown",
          boxName: box?.name || "Unknown",
          itemName: item?.name || "Unknown",
        });
      }
    }
    return unassigned;
  }

  // ─── Reports ─────────────────────────────────────────────────────────────
  async getReportKpis(month: string): Promise<any> {
    const allAgreements = await db.select().from(sm2LiveryAgreements);
    const allBillingElements = await db.select().from(sm2BillingElements);
    const allItems = await db.select().from(sm2Items);

    const [year, mon] = month.split("-").map(Number);
    const monthEnd = new Date(year, mon, 0);
    const monthEndStr = monthEnd.toISOString().split("T")[0];
    const monthStartStr = `${month}-01`;

    const activeAtEnd = allAgreements.filter(a => {
      if (a.status !== "active") return false;
      if (!a.startDate || a.startDate > monthEndStr) return false;
      if (a.endDate && a.endDate < monthStartStr) return false;
      return true;
    });

    const allMovements = await db.select().from(sm2HorseMovements);
    const activeAtEndIds = new Set(activeAtEnd.map(a => a.id));
    const uniqueHorseIds = new Set(
      allMovements.filter(m => m.agreementId && activeAtEndIds.has(m.agreementId) && !m.checkOut).map(m => m.horseId)
    );
    const uniqueCustomerIds = new Set(activeAtEnd.map(a => a.customerId));

    const monthBillingElements = allBillingElements.filter(
      el => el.billingMonth === month || el.transactionDate?.substring(0, 7) === month
    );

    let liveryRevenue = 0;
    let adhocRevenue = 0;
    for (const el of monthBillingElements) {
      const item = allItems.find(i => i.id === el.itemId);
      const amount = parseFloat(el.price || "0");
      if (el.agreementId && item?.isLiveryPackage) {
        liveryRevenue += amount;
      } else {
        adhocRevenue += amount;
      }
    }

    return {
      totalRevenue: liveryRevenue + adhocRevenue,
      liveryRevenue,
      adhocRevenue,
      liveryHorses: uniqueHorseIds.size,
      liveryCustomers: uniqueCustomerIds.size,
    };
  }

  async getReportData(groupBy: string, month?: string): Promise<any[]> {
    const allBillingElements = await db.select().from(sm2BillingElements);
    const allCustomers = await db.select().from(sm2Customers);
    const allItems = await db.select().from(sm2Items);

    let filtered = allBillingElements;
    if (month && groupBy === "customer") {
      filtered = allBillingElements.filter(el => el.billingMonth === month || el.transactionDate?.substring(0, 7) === month);
    }

    const grouped: Record<string, any> = {};
    for (const el of filtered) {
      const item = allItems.find(i => i.id === el.itemId);
      const amount = parseFloat(el.price || "0");
      const isLivery = !!(el.agreementId && item?.isLiveryPackage);

      let key: string;
      if (groupBy === "customer") {
        const customer = allCustomers.find(c => c.id === el.customerId);
        key = customer ? customer.fullname : "Unknown";
      } else {
        key = el.billingMonth || el.transactionDate?.substring(0, 7) || "Unknown";
      }

      if (!grouped[key]) grouped[key] = { label: key, liveryRevenue: 0, adhocRevenue: 0, totalRevenue: 0 };
      if (isLivery) { grouped[key].liveryRevenue += amount; } else { grouped[key].adhocRevenue += amount; }
      grouped[key].totalRevenue += amount;
    }

    const result = Object.values(grouped);
    if (groupBy === "customer") result.sort((a, b) => b.totalRevenue - a.totalRevenue);
    else result.sort((a, b) => a.label.localeCompare(b.label));
    return result;
  }

  async getNewLiveryHorses(month: string): Promise<any[]> {
    const allAgreements = await db.select().from(sm2LiveryAgreements);
    const allCustomers = await db.select().from(sm2Customers);
    const allHorses = await db.select().from(sm2Horses);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allMovements = await db.select().from(sm2HorseMovements);
    const filtered = allAgreements.filter(a => a.startDate?.substring(0, 7) === month);

    const result: any[] = [];
    for (const agreement of filtered) {
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const box = allBoxes.find(b => b.id === agreement.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const boxName = stable && box ? `${stable.name} - ${box.name}` : box?.name || "-";
      const activeMovement = allMovements.find(m => m.agreementId === agreement.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const monthlyAmount = agreement.monthlyAmount ? `AED ${parseFloat(agreement.monthlyAmount).toLocaleString()}` : "-";
      result.push({ customerName: customer ? customer.fullname : "Unknown", boxName, horseName: horse?.horseName || "-", arrivalDate: agreement.startDate || "", departureDate: agreement.endDate || "", monthlyAmount });
    }
    return result;
  }

  async getDepartedLiveryHorses(month: string): Promise<any[]> {
    const allAgreements = await db.select().from(sm2LiveryAgreements);
    const allCustomers = await db.select().from(sm2Customers);
    const allHorses = await db.select().from(sm2Horses);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allMovements = await db.select().from(sm2HorseMovements);
    const filtered = allAgreements.filter(a => a.endDate && a.endDate.substring(0, 7) === month);

    const result: any[] = [];
    for (const agreement of filtered) {
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const box = allBoxes.find(b => b.id === agreement.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const boxName = stable && box ? `${stable.name} - ${box.name}` : box?.name || "-";
      const movements = allMovements.filter(m => m.agreementId === agreement.id);
      const lastMovement = movements.sort((a, b) => (b.checkIn || "").localeCompare(a.checkIn || ""))[0];
      const horse = lastMovement ? allHorses.find(h => h.id === lastMovement.horseId) : null;
      const monthlyAmount = agreement.monthlyAmount ? `AED ${parseFloat(agreement.monthlyAmount).toLocaleString()}` : "-";
      result.push({ customerName: customer ? customer.fullname : "Unknown", boxName, horseName: horse?.horseName || "-", arrivalDate: agreement.startDate || "", departureDate: agreement.endDate, monthlyAmount });
    }
    return result;
  }

  async getLiveryCustomersInfo(): Promise<any[]> {
    const activeAgreements = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, "active"));
    const today = new Date().toISOString().split("T")[0];
    const current = activeAgreements.filter(a => !a.endDate || a.endDate >= today);
    const allCustomers = await db.select().from(sm2Customers);
    const allHorses = await db.select().from(sm2Horses);
    const allMovements = await db.select().from(sm2HorseMovements);

    const grouped: Record<string, any> = {};
    for (const agreement of current) {
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const activeMovement = allMovements.find(m => m.agreementId === agreement.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const customerName = customer ? customer.fullname : "Unknown";

      if (!grouped[agreement.customerId]) {
        grouped[agreement.customerId] = { customerName, horses: [], horseCount: 0, totalMonthlyPrice: 0 };
      }
      const price = parseFloat(agreement.monthlyAmount || "0");
      grouped[agreement.customerId].horses.push({ horseName: horse?.horseName || "Unknown", monthlyPrice: price });
      grouped[agreement.customerId].horseCount++;
      grouped[agreement.customerId].totalMonthlyPrice += price;
    }
    return Object.values(grouped);
  }

  async getAllCustomersReport(): Promise<any[]> {
    const activeAgreements = await db.select().from(sm2LiveryAgreements).where(eq(sm2LiveryAgreements.status, "active"));
    const today = new Date().toISOString().split("T")[0];
    const current = activeAgreements.filter(a => !a.endDate || a.endDate >= today);
    const allCustomers = await db.select().from(sm2Customers);
    const allHorses = await db.select().from(sm2Horses);
    const allBoxes = await db.select().from(sm2Boxes);
    const allStables = await db.select().from(sm2Stables);
    const allMovements = await db.select().from(sm2HorseMovements);

    const result: any[] = [];
    for (const agreement of current) {
      const customer = allCustomers.find(c => c.id === agreement.customerId);
      const box = allBoxes.find(b => b.id === agreement.boxId);
      const stable = box ? allStables.find(s => s.id === box.stableId) : null;
      const boxName = stable && box ? `${stable.name} - ${box.name}` : box?.name || "-";
      const activeMovement = allMovements.find(m => m.agreementId === agreement.id && !m.checkOut);
      const horse = activeMovement ? allHorses.find(h => h.id === activeMovement.horseId) : null;
      const monthlyAmount = agreement.monthlyAmount ? `AED ${parseFloat(agreement.monthlyAmount).toLocaleString()}` : "-";
      result.push({ customerName: customer ? customer.fullname : "Unknown", boxName, horseName: horse?.horseName || "-", arrivalDate: agreement.startDate || "", departureDate: agreement.endDate || "", monthlyAmount });
    }
    return result;
  }
}

export const sm2Storage = new Sm2Storage();
