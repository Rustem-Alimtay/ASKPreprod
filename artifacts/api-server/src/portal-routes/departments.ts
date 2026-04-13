import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated } from "../portal-auth";
import multer from "multer";
import { parse } from "csv-parse/sync";
import type { InsertDepartment } from "@workspace/db";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function registerDepartmentRoutes(app: Express, _httpServer: Server) {
  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const depts = activeOnly
        ? await storage.getActiveDepartments()
        : await storage.getAllDepartments();
      res.json(depts);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
      const dept = await storage.getDepartment(id);
      if (!dept) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(dept);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({ message: "Failed to fetch department" });
    }
  });

  app.post("/api/departments/import", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
      if (!mapping) {
        return res.status(400).json({ message: "Column mapping is required" });
      }

      const content = req.file.buffer.toString("utf-8");
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });

      if (!records.length) {
        return res.status(400).json({ message: "CSV file is empty or has no data rows" });
      }

      const rows: InsertDepartment[] = [];
      const skipped: { row: number; reason: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const internalIdRaw = mapping.internalId ? rec[mapping.internalId] : null;
        const externalIdRaw = mapping.externalId ? rec[mapping.externalId] : null;
        const nameRaw = mapping.name ? rec[mapping.name] : null;

        if (!internalIdRaw || !nameRaw) {
          skipped.push({ row: i + 2, reason: "Missing required field (Internal ID or Name)" });
          continue;
        }

        const internalId = parseInt(String(internalIdRaw).trim(), 10);
        if (isNaN(internalId)) {
          skipped.push({ row: i + 2, reason: `Invalid Internal ID: ${internalIdRaw}` });
          continue;
        }

        const inactiveRaw = mapping.inactive ? rec[mapping.inactive] : null;
        const inactive = inactiveRaw ? ["true", "yes", "1", "t", "y"].includes(String(inactiveRaw).trim().toLowerCase()) : false;

        rows.push({
          internalId,
          externalId: externalIdRaw ? String(externalIdRaw).trim() : String(internalId),
          name: String(nameRaw).trim(),
          inactive,
        });
      }

      if (rows.length === 0) {
        return res.status(400).json({ message: "No valid rows found", skipped });
      }

      const result = await storage.upsertDepartments(rows);

      res.json({
        imported: result.imported,
        updated: result.updated,
        skipped: skipped.length,
        totalRows: records.length,
        skipDetails: skipped.slice(0, 20),
      });
    } catch (error: any) {
      console.error("Error importing departments:", error);
      res.status(500).json({ message: error.message || "Failed to import departments" });
    }
  });
}
