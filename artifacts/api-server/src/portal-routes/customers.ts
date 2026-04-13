import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin, isSuperAdmin, parseCsvBuffer, parseExcelFile, validateFileExtension, isDateColumn, isExcelSerialDate, excelSerialToDate, allowedSpreadsheetMimes } from "./helpers";
import { type ManagedUser, type InsertCustomer, insertCustomerSchema, insertCustomerProfileSchema, importLogs, customers } from "@workspace/db";
import { z } from "zod";
import multer from "multer";

export async function registerCustomerRoutes(app: Express, _httpServer: Server) {
  // Customer DB API Routes
  
  // Get all customers with optional search, type, unit filter, and sorting
  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const { search, type, unit, limit, offset, sortBy, sortOrder } = req.query;
      const result = await storage.getAllCustomers({
        search: search as string,
        type: type as string,
        unit: unit as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as string,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Get single customer with profile
  app.get("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomerWithProfile(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  // Create new customer with profile
  app.post("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      
      const customerSchema = insertCustomerSchema.extend({
        dateOfBirth: z.string().optional(),
        gender: z.string().optional(),
        nationality: z.string().optional(),
        occupation: z.string().optional(),
      });
      
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { dateOfBirth, gender, nationality, occupation, ...customerData } = parsed.data;

      // Check for duplicate email
      const existingCustomers = await storage.getAllCustomers({ search: customerData.email });
      const emailExists = existingCustomers.customers.some(c => c.email === customerData.email);
      if (emailExists) {
        return res.status(400).json({ message: "A customer with this email already exists" });
      }

      // Create the customer
      const customer = await storage.createCustomer(customerData);

      // Create the profile
      if (dateOfBirth || gender || nationality || occupation) {
        await storage.upsertCustomerProfile({
          customerId: customer.id,
          dateOfBirth,
          gender,
          nationality,
          occupation,
        });
      }

      // Log the action
      await storage.createAuditLog({
        action: "customer_created",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { customerId: customer.id, customerName: `${customer.firstName} ${customer.lastName}` },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      const result = await storage.getCustomerWithProfile(customer.id);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const existing = await storage.getCustomer(req.params.id);
      
      if (!existing) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const customerSchema = insertCustomerSchema.partial().extend({
        dateOfBirth: z.string().optional(),
        gender: z.string().optional(),
        nationality: z.string().optional(),
        occupation: z.string().optional(),
      });

      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { dateOfBirth, gender, nationality, occupation, ...customerData } = parsed.data;

      // Update customer if there are changes
      if (Object.keys(customerData).length > 0) {
        await storage.updateCustomer(req.params.id, customerData);
      }

      // Update profile
      if (dateOfBirth !== undefined || gender !== undefined || nationality !== undefined || occupation !== undefined) {
        await storage.upsertCustomerProfile({
          customerId: req.params.id,
          dateOfBirth,
          gender,
          nationality,
          occupation,
        });
      }

      await storage.createAuditLog({
        action: "customer_updated",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { customerId: req.params.id },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      const result = await storage.getCustomerWithProfile(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const existing = await storage.getCustomer(req.params.id);
      
      if (!existing) {
        return res.status(404).json({ message: "Customer not found" });
      }

      await storage.deleteCustomer(req.params.id);

      await storage.createAuditLog({
        action: "customer_deleted",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { customerId: req.params.id, customerName: `${existing.firstName} ${existing.lastName}` },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Import customers from Excel file - two-step flow
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


  // Step 1: Upload file and get column headers + preview rows
  app.post("/api/customers/import/preview", isAuthenticated, isSuperAdmin, upload.single("file"), async (req, res) => {
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
      console.error("Error previewing import:", error);
      res.status(400).json({ message: error.message || "Failed to parse file" });
    }
  });

  // Step 2: Import with user-defined column mapping
  app.post("/api/customers/import", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const { fileData, mapping } = req.body;

      if (!fileData || !mapping) {
        return res.status(400).json({ message: "File data and column mapping are required" });
      }

      if (!mapping.firstName && !mapping.lastName && !mapping.email && !mapping.contact) {
        return res.status(400).json({ message: "At least one field mapping is required" });
      }

      const buffer = Buffer.from(fileData, "base64");
      const rows = await parseExcelFile(buffer);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const skipReasons: Record<string, number> = {
        empty_row: 0,
        duplicate_email: 0,
        duplicate_phone: 0,
        error: 0,
      };

      const allExisting = await storage.getAllCustomers({ limit: 100000, offset: 0 });
      const existingEmails = new Set(
        allExisting.customers.map(c => (c.email || "").toLowerCase().trim()).filter(Boolean)
      );
      const existingPhones = new Set(
        allExisting.customers.map(c => (c.contact || "").replace(/\D/g, "")).filter(Boolean)
      );

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const firstName = mapping.firstName ? String(row[mapping.firstName] ?? "").trim() : "";
        const lastName = mapping.lastName ? String(row[mapping.lastName] ?? "").trim() : "";
        const contact = mapping.contact ? String(row[mapping.contact] ?? "").trim() : "";
        const email = mapping.email ? String(row[mapping.email] ?? "").trim() : "";
        const source = mapping.source ? String(row[mapping.source] ?? "").trim() : "";

        if (!firstName && !lastName && !email && !contact) {
          skipped++;
          skipReasons.empty_row++;
          errors.push(`Row ${i + 2}: skipped - row is completely empty`);
          continue;
        }

        try {
          if (email) {
            const emailLower = email.toLowerCase().trim();
            if (existingEmails.has(emailLower)) {
              skipped++;
              skipReasons.duplicate_email++;
              errors.push(`Row ${i + 2}: "${firstName} ${lastName}" skipped - email "${email}" already exists`);
              continue;
            }
          }

          if (contact) {
            const phoneDigits = contact.replace(/\D/g, "");
            if (phoneDigits && existingPhones.has(phoneDigits)) {
              skipped++;
              skipReasons.duplicate_phone++;
              errors.push(`Row ${i + 2}: "${firstName} ${lastName}" skipped - phone "${contact}" already exists`);
              continue;
            }
          }

          const code = `IMP${String(Date.now()).slice(-4)}${String(i).padStart(3, "0")}`;
          await storage.createCustomer({
            externalCode: code,
            firstName,
            lastName,
            type: "Individual",
            primaryUnit: "Corporate",
            email,
            contact,
            source: source || "Excel Import",
            status: "active",
          });
          imported++;

          if (email) existingEmails.add(email.toLowerCase().trim());
          if (contact) existingPhones.add(contact.replace(/\D/g, ""));
        } catch (err: any) {
          skipped++;
          skipReasons.error++;
          errors.push(`Row ${i + 2}: "${firstName} ${lastName}" failed - ${err.message || "unknown error"}`);
        }
      }

      await storage.createAuditLog({
        action: "customers_imported",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { imported, skipped, totalRows: rows.length },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      await db.insert(importLogs).values({
        fileName: req.body.fileName || "import.xlsx",
        totalRows: rows.length,
        imported,
        skipped,
        skipReasons,
        importedBy: user.id,
        importedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      });

      res.json({ imported, skipped, totalRows: rows.length, errors: errors.slice(0, 50), skipReasons });
    } catch (error: any) {
      console.error("Error importing customers:", error);
      res.status(500).json({ message: "Failed to import customers: " + (error.message || "Unknown error") });
    }
  });

  // Import log CRUD endpoints
  app.post("/api/customers/import-log", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const { fileName, totalRows, imported, skipped, skipReasons } = req.body;

      if (!fileName) {
        return res.status(400).json({ message: "fileName is required" });
      }

      const [log] = await db.insert(importLogs).values({
        fileName,
        totalRows: totalRows || 0,
        imported: imported || 0,
        skipped: skipped || 0,
        skipReasons: skipReasons || null,
        importedBy: user.id,
        importedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      }).returning();

      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating import log:", error);
      res.status(500).json({ message: "Failed to create import log" });
    }
  });

  app.get("/api/customers/import-logs", isAuthenticated, async (req, res) => {
    try {
      const logs = await db.select().from(importLogs).orderBy(desc(importLogs.createdAt));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching import logs:", error);
      res.status(500).json({ message: "Failed to fetch import logs" });
    }
  });

  // ==================== Customer Duplicate Detection & Merge Routes ====================

  const duplicateScanSchema = z.object({
    criteria: z.object({
      email: z.boolean().optional(),
      name: z.boolean().optional(),
      phone: z.boolean().optional(),
    }).refine(c => c.email || c.name || c.phone, { message: "At least one matching criteria is required" }),
  });

  app.post("/api/customers/duplicates/scan", isAuthenticated, async (req, res) => {
    try {
      const parsed = duplicateScanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "At least one matching criteria is required" });
      }
      const { criteria } = parsed.data;

      const allData = await storage.getAllCustomers({ limit: 10000, offset: 0 });
      const allCustomers = allData.customers;
      const groups: { matchType: string; records: typeof allCustomers }[] = [];
      const usedIds = new Set<string>();

      if (criteria.email) {
        const emailMap = new Map<string, typeof allCustomers>();
        for (const c of allCustomers) {
          const email = (c.email || "").toLowerCase().trim();
          if (!email) continue;
          if (!emailMap.has(email)) emailMap.set(email, []);
          emailMap.get(email)!.push(c);
        }
        Array.from(emailMap.entries()).forEach(([, records]) => {
          if (records.length > 1) {
            groups.push({ matchType: "email", records });
            records.forEach((r: { id: string }) => usedIds.add(r.id));
          }
        });
      }

      if (criteria.name) {
        const nameMap = new Map<string, typeof allCustomers>();
        for (const c of allCustomers) {
          if (usedIds.has(c.id)) continue;
          const fn = (c.firstName || "").toLowerCase().trim();
          const ln = (c.lastName || "").toLowerCase().trim();
          if (!fn || !ln) continue;
          const key = `${fn}|${ln}`;
          if (!nameMap.has(key)) nameMap.set(key, []);
          nameMap.get(key)!.push(c);
        }
        Array.from(nameMap.entries()).forEach(([, records]) => {
          if (records.length > 1) {
            groups.push({ matchType: "name", records });
            records.forEach((r: { id: string }) => usedIds.add(r.id));
          }
        });
      }

      if (criteria.phone) {
        const phoneMap = new Map<string, typeof allCustomers>();
        for (const c of allCustomers) {
          if (usedIds.has(c.id)) continue;
          const phone = (c.contact || "").replace(/\D/g, "");
          if (!phone) continue;
          if (!phoneMap.has(phone)) phoneMap.set(phone, []);
          phoneMap.get(phone)!.push(c);
        }
        Array.from(phoneMap.entries()).forEach(([, records]) => {
          if (records.length > 1) {
            groups.push({ matchType: "phone", records });
            records.forEach((r: { id: string }) => usedIds.add(r.id));
          }
        });
      }

      res.json({ groups, totalDuplicates: groups.reduce((sum, g) => sum + g.records.length, 0) });
    } catch (error: any) {
      console.error("Error scanning duplicates:", error);
      res.status(500).json({ message: "Failed to scan for duplicates" });
    }
  });

  const customerMergeSchema = z.object({
    primaryId: z.string().min(1),
    secondaryIds: z.array(z.string()).min(1),
  });

  app.post("/api/customers/merge", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const parsed = customerMergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Primary ID and at least one secondary ID required" });
      }
      const { primaryId, secondaryIds } = parsed.data;

      const primary = await storage.getCustomer(primaryId);
      if (!primary) {
        return res.status(404).json({ message: "Primary record not found" });
      }

      const mergedData: Partial<InsertCustomer> = {};
      for (const secId of secondaryIds) {
        const secondary = await storage.getCustomer(secId);
        if (!secondary) continue;

        if (!primary.firstName && secondary.firstName) mergedData.firstName = secondary.firstName;
        if (!primary.lastName && secondary.lastName) mergedData.lastName = secondary.lastName;
        if (!primary.contact && secondary.contact) mergedData.contact = secondary.contact;
        if (!primary.email && secondary.email) mergedData.email = secondary.email;
        if (!primary.source && secondary.source) mergedData.source = secondary.source;

        await storage.deleteCustomer(secId);
      }

      if (Object.keys(mergedData).length > 0) {
        await storage.updateCustomer(primaryId, mergedData);
      }

      const updated = await storage.getCustomer(primaryId);

      await storage.createAuditLog({
        action: "customers_merged",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { primaryId, mergedIds: secondaryIds, fieldsUpdated: Object.keys(mergedData) },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      res.json({ merged: updated, deletedCount: secondaryIds.length });
    } catch (error: any) {
      console.error("Error merging customers:", error);
      res.status(500).json({ message: "Failed to merge customers: " + (error.message || "Unknown error") });
    }
  });

  app.delete("/api/customers/duplicates/bulk", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).managedUser as ManagedUser;
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "At least one ID is required" });
      }

      let deleted = 0;
      for (const id of ids) {
        const success = await storage.deleteCustomer(id);
        if (success) deleted++;
      }

      await storage.createAuditLog({
        action: "customers_bulk_deleted",
        category: "customer_db",
        userId: user.id,
        userEmail: user.email,
        details: { deletedIds: ids, deletedCount: deleted },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        status: "success",
      });

      res.json({ deleted });
    } catch (error: any) {
      console.error("Error bulk deleting customers:", error);
      res.status(500).json({ message: "Failed to delete customers" });
    }
  });
}
