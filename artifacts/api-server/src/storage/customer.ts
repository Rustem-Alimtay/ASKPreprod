import {
  customers, type Customer, type InsertCustomer,
  customerProfiles, type CustomerProfile, type InsertCustomerProfile,
  type CustomerWithProfile,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, desc, and, ilike, or, asc } from "drizzle-orm";

// ── Customers ────────────────────────────────────────────────────────────────

export async function getAllCustomers(options?: {
  search?: string;
  type?: string;
  unit?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ customers: Customer[]; total: number }> {
  const { search, type, unit, limit = 50, offset = 0, sortBy, sortOrder } =
    options || {};

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(customers.firstName, `%${search}%`),
        ilike(customers.lastName, `%${search}%`),
        ilike(customers.email, `%${search}%`),
        ilike(customers.contact, `%${search}%`)
      )
    );
  }
  if (type) conditions.push(eq(customers.type, type));
  if (unit) conditions.push(eq(customers.primaryUnit, unit));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(whereClause);

  const sortColumnMap: Record<string, any> = {
    firstName: customers.firstName,
    lastName: customers.lastName,
    email: customers.email,
    contact: customers.contact,
    primaryUnit: customers.primaryUnit,
    source: customers.source,
    createdAt: customers.createdAt,
  };
  const sortCol = sortColumnMap[sortBy || ""] || customers.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const result = await db
    .select()
    .from(customers)
    .where(whereClause)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  return { customers: result, total: countResult?.count || 0 };
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  return customer;
}

export async function getCustomerByExternalCode(
  code: string
): Promise<Customer | undefined> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.externalCode, code));
  return customer;
}

export async function createCustomer(
  customerData: InsertCustomer
): Promise<Customer> {
  const [customer] = await db.insert(customers).values(customerData).returning();
  return customer;
}

export async function updateCustomer(
  id: string,
  data: Partial<InsertCustomer>
): Promise<Customer | undefined> {
  const [customer] = await db
    .update(customers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();
  return customer;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  await db.delete(customerProfiles).where(eq(customerProfiles.customerId, id));
  const result = await db.delete(customers).where(eq(customers.id, id)).returning();
  return result.length > 0;
}

// ── Customer Profiles ────────────────────────────────────────────────────────

export async function getCustomerProfile(
  customerId: string
): Promise<CustomerProfile | undefined> {
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.customerId, customerId));
  return profile;
}

export async function upsertCustomerProfile(
  profile: InsertCustomerProfile
): Promise<CustomerProfile> {
  const existing = await getCustomerProfile(profile.customerId);
  if (existing) {
    const [updated] = await db
      .update(customerProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(customerProfiles.customerId, profile.customerId))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(customerProfiles).values(profile).returning();
    return created;
  }
}

export async function deleteCustomerProfile(
  customerId: string
): Promise<boolean> {
  const result = await db
    .delete(customerProfiles)
    .where(eq(customerProfiles.customerId, customerId))
    .returning();
  return result.length > 0;
}

export async function getCustomerWithProfile(
  id: string
): Promise<CustomerWithProfile | undefined> {
  const customer = await getCustomer(id);
  if (!customer) return undefined;
  const profile = await getCustomerProfile(id);
  return { ...customer, profile: profile || undefined };
}
