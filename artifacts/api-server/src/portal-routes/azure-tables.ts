import type { Express } from "express";
import type { Server } from "http";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import {
  nsAccountLines, nsAccounts, nsClasses, nsCustomers,
  nsDeletedTransactions, nsDepartments, nsEmployee, nsEntities,
  nsHorses, nsItems, nsLocations, nsSubclasses, nsSubsidiaries,
  nsTransactions, nsTransactionsTest, nsVendors, nsTransactionLines,
} from "@workspace/db";
import { isAuthenticated } from "../portal-auth";

const tableMap: Record<string, any> = {
  ns_account_lines: nsAccountLines,
  ns_accounts: nsAccounts,
  ns_classes: nsClasses,
  ns_customers: nsCustomers,
  ns_deleted_transactions: nsDeletedTransactions,
  ns_departments: nsDepartments,
  ns_employee: nsEmployee,
  ns_entities: nsEntities,
  ns_horses: nsHorses,
  ns_items: nsItems,
  ns_locations: nsLocations,
  ns_subclasses: nsSubclasses,
  ns_subsidiaries: nsSubsidiaries,
  ns_transactions: nsTransactions,
  ns_transactions_test: nsTransactionsTest,
  ns_vendors: nsVendors,
  ns_transaction_lines: nsTransactionLines,
};

function getColumnNames(table: any): string[] {
  const cols = getTableColumns(table);
  return Object.keys(cols);
}

export async function registerAzureTableRoutes(app: Express, _httpServer: Server): Promise<void> {
  app.get("/api/azure-tables/summary", isAuthenticated, async (_req, res) => {
    try {
      const counts: Record<string, number> = {};
      for (const [key, table] of Object.entries(tableMap)) {
        const result = await db.select({ count: sql<number>`count(*)::int` }).from(table);
        counts[key] = result[0]?.count ?? 0;
      }
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/azure-tables/:tableName", isAuthenticated, async (req, res) => {
    try {
      const { tableName } = req.params;
      const table = tableMap[tableName];
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const columns = getColumnNames(table);

      const [countResult, rows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(table),
        db.select().from(table).limit(limit).offset(offset),
      ]);

      const total = countResult[0]?.count ?? 0;

      res.json({
        columns,
        rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
