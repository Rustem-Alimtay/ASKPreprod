import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated } from "../portal-auth";
import multer from "multer";
import { parse } from "csv-parse/sync";
import type { InsertDepartment } from "@workspace/db";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/httpError";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function registerDepartmentRoutes(app: Express, _httpServer: Server) {
  app.get("/api/departments", isAuthenticated, asyncHandler(async (req, res) => {
    const activeOnly = req.query.active === "true";
    const depts = activeOnly
      ? await storage.getActiveDepartments()
      : await storage.getAllDepartments();
    res.json(depts);
  }));

  app.get("/api/departments/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw HttpError.badRequest("Invalid department ID");
    }
    const dept = await storage.getDepartment(id);
    if (!dept) {
      throw HttpError.notFound("Department not found");
    }
    res.json(dept);
  }));

  app.post("/api/departments/import", isAuthenticated, upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) {
      throw HttpError.badRequest("No file uploaded");
    }

    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
    if (!mapping) {
      throw HttpError.badRequest("Column mapping is required");
    }

    const content = req.file.buffer.toString("utf-8");
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });

    if (!records.length) {
      throw HttpError.badRequest("CSV file is empty or has no data rows");
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
  }));
}
