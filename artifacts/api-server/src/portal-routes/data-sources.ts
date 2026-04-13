import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin, isSuperAdmin, parseExcelFile, validateFileExtension, allowedSpreadsheetMimes } from "./helpers";
import { type ManagedUser, importLogs, dataSources, dsRecords } from "@workspace/db";
import { z } from "zod";
import multer from "multer";

export async function registerDataSourceRoutes(app: Express, _httpServer: Server) {
  // ==================== Data Sources Routes (Multi-source Customer DB) ====================

  app.get("/api/data-sources", isAuthenticated, async (req, res) => {
    try {
      const sources = await storage.getAllDataSources();
      const sourcesWithCounts = await Promise.all(sources.map(async (s) => {
        const { total } = await storage.getDsRecords(s.id, { limit: 0 });
        return { ...s, recordCount: total };
      }));
      res.json(sourcesWithCounts);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  app.get("/api/data-sources/:slug", isAuthenticated, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });
      res.json(ds);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch data source" });
    }
  });

  app.get("/api/data-sources/:slug/records", isAuthenticated, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const { search, limit, offset, sortBy, sortOrder } = req.query;
      const result = await storage.getDsRecords(ds.id, {
        search: search as string,
        limit: limit ? parseInt(limit as string) : 25,
        offset: offset ? parseInt(offset as string) : 0,
        sortBy: sortBy as string,
        sortOrder: sortOrder as string,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch records" });
    }
  });

  const dsUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowedSpreadsheetMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only Excel (.xlsx) and CSV files are accepted"));
      }
    },
  });

  app.post("/api/data-sources/:slug/import/preview", isAuthenticated, isSuperAdmin, dsUpload.single("file"), async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ext = req.file.originalname?.toLowerCase() || "";
      if (![".xlsx", ".csv"].some(e => ext.endsWith(e))) {
        return res.status(400).json({ message: "Invalid file type. Please upload .xlsx or .csv" });
      }

      const rows = await parseExcelFile(req.file.buffer, req.file.originalname);

      const columns = Object.keys(rows[0]);
      const preview = rows.slice(0, 5).map(row => {
        const obj: Record<string, string> = {};
        for (const col of columns) obj[col] = String(row[col] ?? "");
        return obj;
      });

      const fileBase64 = req.file.buffer.toString("base64");
      res.json({
        columns,
        preview,
        totalRows: rows.length,
        fileData: fileBase64,
        savedMapping: ds.importMapping,
        savedColumns: ds.columns,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to parse file" });
    }
  });

  const dsImportSchema = z.object({
    fileData: z.string().min(1),
    mapping: z.record(z.string(), z.string()),
    fileName: z.string().optional(),
  });

  app.post("/api/data-sources/:slug/import", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const user = (req as any).managedUser as ManagedUser;
      const parsed = dsImportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Missing fileData or mapping", errors: parsed.error.flatten() });
      }
      const { fileData, mapping, fileName } = parsed.data;

      const buffer = Buffer.from(fileData, "base64");
      const rows = await parseExcelFile(buffer);

      const mappingEntries = Object.entries(mapping).filter(([_, v]) => v);
      const dedupeKey = ds.deduplicateKey;

      let imported = 0;
      let skipped = 0;
      const skipReasons: Record<string, number> = { empty_row: 0, duplicate: 0, error: 0 };
      const recordsToInsert: { dataSourceId: string; data: Record<string, string | number | boolean | null> }[] = [];

      const existingRecords = dedupeKey ? (await storage.getDsRecords(ds.id, { limit: 100000 })).records : [];

      for (const row of rows) {
        const data: Record<string, string | number | boolean | null> = {};
        let hasValue = false;

        for (const [targetKey, sourceCol] of mappingEntries) {
          const val = row[sourceCol as string];
          data[targetKey] = val !== undefined && val !== "" ? String(val) : null;
          if (data[targetKey]) hasValue = true;
        }

        if (!hasValue) {
          skipped++;
          skipReasons.empty_row++;
          continue;
        }

        if (dedupeKey && data[dedupeKey]) {
          const isDuplicate = existingRecords.some(r => {
            const existing = r.data as Record<string, any>;
            return existing[dedupeKey] && String(existing[dedupeKey]).toLowerCase() === String(data[dedupeKey]).toLowerCase();
          });
          if (isDuplicate) {
            skipped++;
            skipReasons.duplicate++;
            continue;
          }
        }

        recordsToInsert.push({ dataSourceId: ds.id, data });
        imported++;
      }

      if (recordsToInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < recordsToInsert.length; i += batchSize) {
          await storage.createDsRecordsBulk(recordsToInsert.slice(i, i + batchSize));
        }
      }

      const columnDefs = mappingEntries.map(([key]) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: "text",
      }));

      const existingColumnKeys = new Set((ds.columns || []).map(c => c.key));
      const newColumns = columnDefs.filter(c => !existingColumnKeys.has(c.key));
      const mergedColumns = [...(ds.columns || []), ...newColumns];

      await storage.updateDataSource(ds.id, {
        columns: mergedColumns,
        importMapping: mapping as Record<string, string>,
        recordCount: (ds.recordCount || 0) + imported,
        lastImportAt: new Date(),
      });

      await db.insert(importLogs).values({
        dataSourceId: ds.id,
        fileName: fileName || "import.xlsx",
        totalRows: rows.length,
        imported,
        skipped,
        skipReasons,
        importedBy: user.id,
        importedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      });

      res.json({ imported, skipped, totalRows: rows.length, skipReasons });
    } catch (error: any) {
      console.error("Data source import error:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  app.get("/api/data-sources/:slug/import-logs", isAuthenticated, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const logs = await db.select().from(importLogs)
        .where(eq(importLogs.dataSourceId, ds.id))
        .orderBy(desc(importLogs.createdAt));
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch import logs" });
    }
  });

  const dsDuplicateScanSchema = z.object({
    fields: z.array(z.string()).min(1, "Provide at least one field for duplicate detection"),
  });

  app.post("/api/data-sources/:slug/duplicates/scan", isAuthenticated, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const parsed = dsDuplicateScanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }
      const { fields } = parsed.data;

      const { records } = await storage.getDsRecords(ds.id, { limit: 100000 });

      const groups: { matchField: string; matchValue: string; records: typeof records }[] = [];
      
      for (const field of fields) {
        const valueMap = new Map<string, typeof records>();
        for (const record of records) {
          const val = (record.data as Record<string, any>)?.[field];
          if (!val) continue;
          const key = String(val).toLowerCase().trim();
          if (!key) continue;
          if (!valueMap.has(key)) valueMap.set(key, []);
          valueMap.get(key)!.push(record);
        }
        Array.from(valueMap.entries()).forEach(([val, recs]) => {
          if (recs.length > 1) {
            groups.push({ matchField: field, matchValue: val, records: recs });
          }
        });
      }

      res.json({ groups, totalDuplicates: groups.reduce((sum, g) => sum + g.records.length, 0) });
    } catch (error: any) {
      res.status(500).json({ message: "Duplicate scan failed" });
    }
  });

  const dsMergeSchema = z.object({
    primaryId: z.string().min(1),
    secondaryIds: z.array(z.string()).min(1),
  });

  app.post("/api/data-sources/:slug/merge", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const parsed = dsMergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "primaryId and secondaryIds required" });
      }
      const { primaryId, secondaryIds } = parsed.data;

      const primary = await storage.getDsRecord(primaryId);
      if (!primary) return res.status(404).json({ message: "Primary record not found" });

      for (const secId of secondaryIds) {
        const sec = await storage.getDsRecord(secId);
        if (!sec) continue;
        const mergedData = { ...(sec.data as Record<string, any>) };
        const primaryData = primary.data as Record<string, any>;
        for (const [k, v] of Object.entries(primaryData)) {
          if (v !== null && v !== "") mergedData[k] = v;
        }
        await storage.deleteDsRecord(secId);
      }

      res.json({ message: "Merged successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Merge failed" });
    }
  });

  app.delete("/api/data-sources/:slug/records", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "At least one ID is required" });
      }

      let deleted = 0;
      for (const id of ids) {
        if (await storage.deleteDsRecord(id)) deleted++;
      }
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete records" });
    }
  });

  const dsRecordUpdateSchema = z.object({
    field: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  });

  app.patch("/api/data-sources/:slug/records/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const parsed = dsRecordUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "field and value are required" });
      }
      const { field, value } = parsed.data;
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const record = await storage.getDsRecord(req.params.id);
      if (!record || record.dataSourceId !== ds.id) {
        return res.status(404).json({ message: "Record not found" });
      }

      const updated = await storage.updateDsRecord(req.params.id, { [field]: value });
      res.json(updated);
    } catch (error) {
      console.error("Error updating record:", error);
      res.status(500).json({ message: "Failed to update record" });
    }
  });

  app.post("/api/data-sources/:slug/records/delete-batch", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "At least one ID is required" });
      }

      let deleted = 0;
      for (const id of ids) {
        if (await storage.deleteDsRecord(id)) deleted++;
      }
      res.json({ deleted });
    } catch (error: any) {
      console.error("Failed to delete records:", error);
      res.status(500).json({ message: "Failed to delete records" });
    }
  });

  app.delete("/api/data-sources/:slug/records/all", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });
      const result = await db.delete(dsRecords).where(eq(dsRecords.dataSourceId, ds.id));
      await db.update(dataSources).set({ recordCount: 0 }).where(eq(dataSources.id, ds.id));
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (error: any) {
      console.error("Failed to clear records:", error);
      res.status(500).json({ message: "Failed to clear records" });
    }
  });

  app.post("/api/data-sources/:slug/records/clear-all", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });
      const result = await db.delete(dsRecords).where(eq(dsRecords.dataSourceId, ds.id));
      await db.update(dataSources).set({ recordCount: 0 }).where(eq(dataSources.id, ds.id));
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (error: any) {
      console.error("Failed to clear records:", error);
      res.status(500).json({ message: "Failed to clear records" });
    }
  });

  const dsSettingsSchema = z.object({
    deduplicateKey: z.string().nullable().optional(),
    columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.string().optional() })).optional(),
  });

  app.patch("/api/data-sources/:slug/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug(req.params.slug);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const parsed = dsSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings data", errors: parsed.error.flatten() });
      }
      const { deduplicateKey, columns } = parsed.data;
      const update: any = {};
      if (deduplicateKey !== undefined) update.deduplicateKey = deduplicateKey;
      if (columns !== undefined) update.columns = columns;

      const updated = await storage.updateDataSource(ds.id, update);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
}
