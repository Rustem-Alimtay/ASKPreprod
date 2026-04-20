import {
  managedUsers, type ManagedUser, type InsertManagedUser,
  passwordResetTokens, type PasswordResetToken,
  ssoTokens, type SsoToken,
  ssoAuditLogs, type SsoAuditLog, type InsertSsoAuditLog,
  dsRecords,
} from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql, and, or, isNull } from "drizzle-orm";
import { getDataSourceBySlug } from "./dataSource";

// ── Managed Users ────────────────────────────────────────────────────────────

export async function getAllManagedUsers(): Promise<ManagedUser[]> {
  return await db.select().from(managedUsers).orderBy(managedUsers.createdAt);
}

export async function getManagedUser(id: string): Promise<ManagedUser | undefined> {
  const [user] = await db.select().from(managedUsers).where(eq(managedUsers.id, id));
  return user;
}

export async function getManagedUserByEmail(email: string): Promise<ManagedUser | undefined> {
  const [user] = await db.select().from(managedUsers).where(eq(managedUsers.email, email));
  return user;
}

export async function getManagedUserByUsername(username: string): Promise<ManagedUser | undefined> {
  const [user] = await db.select().from(managedUsers).where(eq(managedUsers.username, username));
  return user;
}

export async function getManagedUserByEmployeeCode(
  employeeCode: string
): Promise<ManagedUser | undefined> {
  const [user] = await db
    .select()
    .from(managedUsers)
    .where(eq(managedUsers.employeeCode, employeeCode));
  return user;
}

export async function createManagedUser(userData: InsertManagedUser): Promise<ManagedUser> {
  const [user] = await db.insert(managedUsers).values(userData as any).returning();
  return user;
}

export async function updateManagedUser(
  id: string,
  data: Partial<InsertManagedUser>
): Promise<ManagedUser | undefined> {
  const [user] = await db
    .update(managedUsers)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(managedUsers.id, id))
    .returning();
  return user;
}

export async function deleteManagedUser(id: string): Promise<boolean> {
  const result = await db.delete(managedUsers).where(eq(managedUsers.id, id)).returning();
  return result.length > 0;
}

// ── Password Reset Tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<PasswordResetToken> {
  const [record] = await db
    .insert(passwordResetTokens)
    .values({ userId, token, expiresAt })
    .returning();
  return record;
}

export async function getPasswordResetToken(
  token: string
): Promise<PasswordResetToken | undefined> {
  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
  return record;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}

export async function invalidateUserResetTokens(userId: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt))
    );
}

export async function destroyUserSessions(userId: string): Promise<number> {
  const result = await db.execute(
    sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`
  );
  return Number(result.rowCount ?? 0);
}

// ── SSO Tokens ───────────────────────────────────────────────────────────────

export async function createSsoToken(
  token: string,
  userId: string,
  expiresAt: Date
): Promise<SsoToken> {
  const [created] = await db
    .insert(ssoTokens)
    .values({ token, userId, expiresAt, used: false })
    .returning();
  return created;
}

export async function validateAndConsumeSsoToken(
  tokenValue: string
): Promise<{ userId: string } | null> {
  const now = new Date();
  const [consumed] = await db
    .update(ssoTokens)
    .set({ used: true })
    .where(
      and(
        eq(ssoTokens.token, tokenValue),
        eq(ssoTokens.used, false),
        sql`${ssoTokens.expiresAt} > ${now}`
      )
    )
    .returning();
  if (!consumed) return null;
  return { userId: consumed.userId };
}

export async function invalidateUserSsoTokens(userId: string): Promise<number> {
  const invalidated = await db
    .update(ssoTokens)
    .set({ used: true })
    .where(and(eq(ssoTokens.userId, userId), eq(ssoTokens.used, false)))
    .returning();
  return invalidated.length;
}

export async function cleanupExpiredTokens(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const deletedSso = await db
    .delete(ssoTokens)
    .where(
      or(
        sql`${ssoTokens.expiresAt} < NOW()`,
        and(eq(ssoTokens.used, true), sql`${ssoTokens.createdAt} < ${oneHourAgo}`)
      )
    )
    .returning();
  const deletedPrt = await db
    .delete(passwordResetTokens)
    .where(
      or(
        sql`${passwordResetTokens.expiresAt} < NOW()`,
        sql`${passwordResetTokens.usedAt} IS NOT NULL`
      )
    )
    .returning();
  return deletedSso.length + deletedPrt.length;
}

// ── SSO Audit Logs ───────────────────────────────────────────────────────────

export async function createSsoAuditLog(log: InsertSsoAuditLog): Promise<SsoAuditLog> {
  const [created] = await db.insert(ssoAuditLogs).values(log).returning();
  return created;
}

// ── User Stats ───────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  totalUsers: number;
  activeUsers: number;
  totalEmployees: number;
  roleDistribution: { role: string; count: number }[];
}> {
  const allUsers = await db.select().from(managedUsers);
  const totalUsers = allUsers.length;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeUsers = allUsers.filter(
    (u) => u.lastActiveAt && u.lastActiveAt > oneDayAgo
  ).length;

  const roleMap = new Map<string, number>();
  allUsers.forEach((u) => {
    const role = u.role || "viewer";
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  });
  const roleDistribution = Array.from(roleMap.entries()).map(([role, count]) => ({
    role,
    count,
  }));

  let totalEmployees = 0;
  try {
    const empSource = await getDataSourceBySlug("employee-directory");
    if (empSource) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(dsRecords)
        .where(eq(dsRecords.dataSourceId, empSource.id));
      totalEmployees = Number(countResult?.count || 0);
    }
  } catch {}

  return { totalUsers, activeUsers, totalEmployees, roleDistribution };
}
