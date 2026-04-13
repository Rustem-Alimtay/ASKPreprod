import type { RequestHandler } from "express";
import type { ManagedUser } from "@workspace/db";
import { passwordSchema } from "@workspace/db";
import { z } from "zod";
import ExcelJS from "exceljs";

export { passwordSchema };

export const allowedSpreadsheetMimes = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const isAdmin: RequestHandler = async (req, res, next) => {
  const managedUser = (req as any).managedUser as ManagedUser;
  if (!managedUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (managedUser.role !== "admin" && managedUser.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};

export const isSuperAdmin: RequestHandler = async (req, res, next) => {
  const managedUser = (req as any).managedUser as ManagedUser;
  if (!managedUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (managedUser.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden: Superadmin access required" });
  }
  next();
};

export const checkSubmoduleAccess = (serviceKey: string, submoduleKey: string): RequestHandler => {
  return (req, res, next) => {
    const managedUser = (req as any).managedUser as ManagedUser;
    if (!managedUser) return res.status(401).json({ message: "Unauthorized" });
    if (managedUser.role === "superadmin") return next();
    const allowed = managedUser.allowedSubmodules as Record<string, string[]> | null;
    if (!allowed || !allowed[serviceKey]) return next();
    if (allowed[serviceKey].includes(submoduleKey)) return next();
    return res.status(403).json({ message: "Access denied: submodule restricted" });
  };
};

export function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV file has no data rows");

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const val = values[idx] ?? "";
      obj[header] = val;
      if (val) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

export function isExcelSerialDate(value: number): boolean {
  return value >= 1 && value < 60000;
}

export function excelSerialToDate(serial: number): string {
  const utcDays = Math.floor(serial) - 25569;
  const utcValue = utcDays * 86400 * 1000;
  const date = new Date(utcValue);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateColumn(header: string): boolean {
  const lower = header.toLowerCase().replace(/[_\s]+/g, '');
  return /\bdate\b|_date$|^date_|\bдата\b/i.test(header.toLowerCase()) ||
    lower === 'calldate' || lower === 'dob' || lower === 'birthday' || lower === 'dateofbirth' ||
    lower === 'createdat' || lower === 'updatedat' || lower === 'expiresat' || lower === 'duedate' ||
    lower === 'startdate' || lower === 'enddate' || lower === 'deadline';
}

export async function parseExcelFile(buffer: Buffer, filename?: string) {
  const ext = (filename || "").toLowerCase();
  const isCsvByName = ext.endsWith(".csv");
  const isXlsxBySignature = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B;

  if (isCsvByName || (!isXlsxBySignature && !isCsvByName)) {
    try {
      const rows = parseCsvBuffer(buffer);
      if (rows.length > 0) {
        return rows.map(row => {
          const converted: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            if (isDateColumn(key) && value && !isNaN(Number(value))) {
              const num = Number(value);
              if (isExcelSerialDate(num)) {
                converted[key] = excelSerialToDate(num);
                continue;
              }
            }
            converted[key] = value;
          }
          return converted;
        });
      }
    } catch {
      if (isCsvByName) throw new Error("Failed to parse CSV file");
    }
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel file has no sheets");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "");
  });
  const rows: Record<string, string>[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const cell = row.getCell(colNumber);
      let val = "";
      if (cell.value instanceof Date) {
        val = cell.value.toISOString().split("T")[0];
      } else if (cell.value !== null && cell.value !== undefined) {
        const raw = cell.value;
        if (typeof raw === 'number' && isDateColumn(header) && isExcelSerialDate(raw)) {
          val = excelSerialToDate(raw);
        } else {
          val = String(raw);
        }
      }
      obj[header] = val;
      if (val) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  if (rows.length === 0) throw new Error("Excel file has no data rows");
  return rows;
}

export function validateFileExtension(filename: string) {
  const allowedExtensions = [".xlsx", ".csv"];
  const lower = filename?.toLowerCase() || "";
  return allowedExtensions.some(ext => lower.endsWith(ext));
}
