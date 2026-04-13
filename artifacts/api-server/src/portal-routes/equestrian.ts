import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { isAuthenticated } from "../portal-auth";
import { isSuperAdmin, checkSubmoduleAccess, parseExcelFile, validateFileExtension, allowedSpreadsheetMimes } from "./helpers";
import { insertSmStableSchema, insertSmBoxSchema, insertSmHorseSchema, insertSmCustomerSchema, insertSmItemServiceSchema, insertSmBillingElementSchema, insertSmLiveryPackageSchema, insertSmLiveryAgreementSchema, insertSmInvoiceSchema } from "@workspace/db";
import multer from "multer";

export async function registerEquestrianRoutes(app: Express, _httpServer: Server) {
  const upload = multer({
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

  // ========== StableMaster API Routes ==========

  // Facilities
  // Stables
  app.get("/api/sm/stables", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmStables()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/stables", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmStableSchema.parse(req.body);
      res.json(await storage.createSmStable(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/stables/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmStableSchema.partial().parse(req.body);
      const r = await storage.updateSmStable(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/stables/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmStable(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Boxes
  app.get("/api/sm/boxes", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try { res.json(await storage.getSmBoxes(req.query.stableId as string | undefined)); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/boxes", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmBoxSchema.parse(req.body);
      res.json(await storage.createSmBox(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/boxes/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmBoxSchema.partial().parse(req.body);
      const r = await storage.updateSmBox(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/boxes/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmBox(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/sm/boxes/generate", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const { stableId, prefix, count, boxType } = req.body;
      if (!stableId || !prefix || !count) return res.status(400).json({ message: "stableId, prefix, and count are required" });
      const c = parseInt(count, 10);
      if (isNaN(c) || c < 1 || c > 100) return res.status(400).json({ message: "count must be between 1 and 100" });
      const boxes = await storage.generateSmBoxes({ stableId, prefix, count: c, boxType: boxType || "STALL" });
      res.json(boxes);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Horses
  app.get("/api/sm/horses", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmHorses()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/horses", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmHorseSchema.parse(req.body);
      res.json(await storage.createSmHorse(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/horses/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmHorseSchema.partial().parse(req.body);
      const r = await storage.updateSmHorse(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/horses/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmHorse(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/sm/horses/import/preview", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), isSuperAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!validateFileExtension(req.file.originalname)) {
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
      res.json({ columns, preview, totalRows: rows.length, fileData: fileBase64 });
    } catch (error: any) {
      console.error("Error previewing horse import:", error);
      res.status(400).json({ message: error.message || "Failed to parse file" });
    }
  });

  app.post("/api/sm/horses/import", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), isSuperAdmin, async (req, res) => {
    try {
      const { fileData, mapping } = req.body;
      if (!fileData || typeof fileData !== "string") {
        return res.status(400).json({ message: "File data is required" });
      }
      if (!mapping || typeof mapping !== "object") {
        return res.status(400).json({ message: "Column mapping is required" });
      }
      if (!mapping.name) {
        return res.status(400).json({ message: "Horse name mapping is required" });
      }
      const buffer = Buffer.from(fileData, "base64");
      const rows = await parseExcelFile(buffer);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const skipReasons: Record<string, number> = { empty_row: 0, duplicate_name: 0, error: 0 };

      const existingHorses = await storage.getSmHorses();
      const existingNames = new Set(existingHorses.map(h => h.name.toLowerCase().trim()));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = mapping.name ? String(row[mapping.name] ?? "").trim() : "";
        const color = mapping.color ? String(row[mapping.color] ?? "").trim() : "";
        const sex = mapping.sex ? String(row[mapping.sex] ?? "").trim().toUpperCase() : "";
        const dob = mapping.dob ? String(row[mapping.dob] ?? "").trim() : "";
        const remarks = mapping.remarks ? String(row[mapping.remarks] ?? "").trim() : "";
        const status = mapping.status ? String(row[mapping.status] ?? "").trim().toUpperCase() : "ACTIVE";

        if (!name) {
          skipped++;
          skipReasons.empty_row++;
          errors.push(`Row ${i + 2}: skipped - no horse name`);
          continue;
        }

        if (existingNames.has(name.toLowerCase().trim())) {
          skipped++;
          skipReasons.duplicate_name++;
          errors.push(`Row ${i + 2}: "${name}" skipped - horse name already exists`);
          continue;
        }

        try {
          const validSex = ["STALLION", "MARE", "GELDING", "COLT", "FILLY"].includes(sex) ? sex : null;
          const validStatus = ["ACTIVE", "INACTIVE", "RETIRED"].includes(status) ? status : "ACTIVE";

          let parsedDob: string | null = null;
          if (dob) {
            const d = new Date(dob);
            if (!isNaN(d.getTime())) {
              parsedDob = d.toISOString().split("T")[0];
            }
          }

          await storage.createSmHorse({
            name,
            color: color || null,
            sex: validSex,
            dob: parsedDob,
            remarks: remarks || null,
            status: validStatus,
          });
          imported++;
          existingNames.add(name.toLowerCase().trim());
        } catch (err: any) {
          skipped++;
          skipReasons.error++;
          errors.push(`Row ${i + 2}: "${name}" failed - ${err.message || "unknown error"}`);
        }
      }

      res.json({ imported, skipped, totalRows: rows.length, errors: errors.slice(0, 50), skipReasons });
    } catch (error: any) {
      console.error("Error importing horses:", error);
      res.status(500).json({ message: "Failed to import horses: " + (error.message || "Unknown error") });
    }
  });

  // SM Customers
  app.get("/api/sm/customers", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmCustomers()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/customers", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmCustomerSchema.parse(req.body);
      res.json(await storage.createSmCustomer(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/customers/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmCustomerSchema.partial().parse(req.body);
      const r = await storage.updateSmCustomer(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/customers/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmCustomer(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Items & Services
  app.get("/api/sm/item-services", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmItemServices()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/item-services", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmItemServiceSchema.parse(req.body);
      res.json(await storage.createSmItemService(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/item-services/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmItemServiceSchema.partial().parse(req.body);
      const r = await storage.updateSmItemService(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/item-services/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmItemService(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/sm/item-services/import/preview", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), isSuperAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      if (!validateFileExtension(req.file.originalname)) {
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
      res.json({ columns, preview, totalRows: rows.length, fileData: fileBase64 });
    } catch (error: any) {
      console.error("Error previewing item import:", error);
      res.status(400).json({ message: error.message || "Failed to parse file" });
    }
  });

  app.post("/api/sm/item-services/import", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), isSuperAdmin, async (req, res) => {
    try {
      const { fileData, mapping } = req.body;
      if (!fileData || typeof fileData !== "string") {
        return res.status(400).json({ message: "File data is required" });
      }
      if (!mapping || typeof mapping !== "object") {
        return res.status(400).json({ message: "Column mapping is required" });
      }
      if (!mapping.name) {
        return res.status(400).json({ message: "Item name mapping is required" });
      }
      const buffer = Buffer.from(fileData, "base64");
      const rows = await parseExcelFile(buffer);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const skipReasons: Record<string, number> = { empty_row: 0, duplicate_name: 0, error: 0 };

      const existingItems = await storage.getSmItemServices();
      const existingNames = new Set(existingItems.map(i => i.name.toLowerCase().trim()));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = mapping.name ? String(row[mapping.name] ?? "").trim() : "";
        const category = mapping.category ? String(row[mapping.category] ?? "").trim().toUpperCase() : "SERVICE";
        const defaultUnit = mapping.defaultUnit ? String(row[mapping.defaultUnit] ?? "").trim() : "EA";
        const unitPriceRaw = mapping.unitPrice ? String(row[mapping.unitPrice] ?? "").trim() : "0";
        const isActiveRaw = mapping.isActive ? String(row[mapping.isActive] ?? "").trim().toLowerCase() : "true";

        if (!name) {
          skipped++;
          skipReasons.empty_row++;
          errors.push(`Row ${i + 2}: skipped - no item name`);
          continue;
        }

        if (existingNames.has(name.toLowerCase().trim())) {
          skipped++;
          skipReasons.duplicate_name++;
          errors.push(`Row ${i + 2}: "${name}" skipped - item name already exists`);
          continue;
        }

        try {
          const validCategory = ["SERVICE", "ITEM"].includes(category) ? category : "SERVICE";
          const priceNum = parseFloat(unitPriceRaw.replace(/[^0-9.]/g, ""));
          const unitPrice = !isNaN(priceNum) ? Math.round(priceNum * 100) : 0;
          const isActive = !["false", "no", "0", "inactive"].includes(isActiveRaw);

          await storage.createSmItemService({
            name,
            category: validCategory,
            unitOptions: [defaultUnit || "EA"],
            defaultUnit: defaultUnit || "EA",
            unitPrice,
            isActive,
          });
          imported++;
          existingNames.add(name.toLowerCase().trim());
        } catch (err: any) {
          skipped++;
          skipReasons.error++;
          errors.push(`Row ${i + 2}: "${name}" failed - ${err.message || "unknown error"}`);
        }
      }

      res.json({ imported, skipped, totalRows: rows.length, errors: errors.slice(0, 50), skipReasons });
    } catch (error: any) {
      console.error("Error importing items:", error);
      res.status(500).json({ message: "Failed to import items: " + (error.message || "Unknown error") });
    }
  });

  // Billing Elements
  app.get("/api/sm/billing-elements", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const unbilledOnly = req.query.unbilledOnly === "true";
      res.json(await storage.getSmBillingElements({ unbilledOnly, limit }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/sm/billing-elements/enriched", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const billed = req.query.billed !== undefined ? req.query.billed === "true" : undefined;
      res.json(await storage.getSmBillingElementsEnriched(billed));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/sm/horses-with-agreements", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmHorsesWithActiveAgreements()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/billing-elements", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.transactionDate && !body.billingMonth) {
        body.billingMonth = body.transactionDate.substring(0, 7);
      }
      const parsed = insertSmBillingElementSchema.parse(body);
      res.json(await storage.createSmBillingElement(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/billing-elements/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmBillingElementSchema.partial().parse(req.body);
      const r = await storage.updateSmBillingElement(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/billing-elements/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmBillingElement(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/sm/reports/livery", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const groupBy = (req.query.groupBy as string) || "month";
      const data = await storage.getSmReportData(groupBy);
      res.json(data);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/sm/billing-elements/mark-billed", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });
      await storage.markSmBillingElementsBilled(ids);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Livery Packages
  app.get("/api/sm/livery-packages", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmLiveryPackages()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/livery-packages", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmLiveryPackageSchema.parse(req.body);
      res.json(await storage.createSmLiveryPackage(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/livery-packages/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmLiveryPackageSchema.partial().parse(req.body);
      const r = await storage.updateSmLiveryPackage(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/livery-packages/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmLiveryPackage(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Livery Agreements
  app.get("/api/sm/livery-agreements", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmLiveryAgreements()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/livery-agreements", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmLiveryAgreementSchema.parse(req.body);
      res.json(await storage.createSmLiveryAgreement(parsed));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.patch("/api/sm/livery-agreements/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const parsed = insertSmLiveryAgreementSchema.partial().parse(req.body);
      const r = await storage.updateSmLiveryAgreement(req.params.id, parsed);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/livery-agreements/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmLiveryAgreement(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Invoices
  app.get("/api/sm/invoices", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try { res.json(await storage.getSmInvoices()); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/sm/invoices", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const { invoice, lines, billingElementIds } = req.body;
      const parsedInvoice = insertSmInvoiceSchema.parse(invoice);
      const created = await storage.createSmInvoice(parsedInvoice);
      for (const line of lines) {
        await storage.createSmInvoiceLine({ ...line, invoiceId: created.id });
      }
      if (Array.isArray(billingElementIds)) {
        for (const beId of billingElementIds) {
          await storage.updateSmBillingElement(beId, { billed: true, invoiceId: created.id });
        }
      }
      res.json(created);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });
  app.delete("/api/sm/invoices/:id", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try {
      const ok = await storage.deleteSmInvoice(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/sm/invoices/:id/lines", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (req, res) => {
    try { res.json(await storage.getSmInvoiceLines(req.params.id)); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Reset StableMaster data
  app.post("/api/sm/reset-demo-data", isAuthenticated, checkSubmoduleAccess("equestrian", "stable-assets"), async (_req, res) => {
    try {
      const { db } = await import("../db");
      const { smBillingElements, smLiveryAgreements, smInvoiceLines, smInvoices, smBoxes, smStables, smHorses, smCustomers, smItemServices, smLiveryPackages } = await import("@shared/schema");
      await db.delete(smInvoiceLines);
      await db.delete(smInvoices);
      await db.delete(smBillingElements);
      await db.delete(smLiveryAgreements);
      await db.delete(smBoxes);
      await db.delete(smStables);
      await db.delete(smHorses);
      await db.delete(smCustomers);
      await db.delete(smLiveryPackages);
      await db.delete(smItemServices);
      const { seedStableMasterData } = await import("../seedServices");
      await seedStableMasterData();
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
}
