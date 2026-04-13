import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { departments } from "@workspace/db";

interface DepartmentRow {
  internalId: number;
  externalId: string;
  name: string;
  inactive: boolean;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function parseXlsXml(filePath: string): DepartmentRow[] {
  const content = fs.readFileSync(filePath, "utf-8");

  const rowRegex = /<Row>([\s\S]*?)<\/Row>/g;

  const rows: string[][] = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    let cellMatch;
    const localCellRegex = /<Cell[^>]*><Data[^>]*>([\s\S]*?)<\/Data><\/Cell>/g;
    while ((cellMatch = localCellRegex.exec(rowContent)) !== null) {
      cells.push(decodeXmlEntities(cellMatch[1]));
    }
    rows.push(cells);
  }

  const headerRow = rows[0];
  if (!headerRow || headerRow[0] !== "Internal ID") {
    throw new Error("Unexpected header row: " + JSON.stringify(headerRow));
  }

  const dataRows = rows.slice(1);
  const deptRows: DepartmentRow[] = [];

  for (const cells of dataRows) {
    if (cells.length < 5) continue;

    const internalId = parseInt(cells[0], 10);
    const externalId = cells[1];
    const name = cells[3];
    const inactive = cells[4] === "Yes";

    deptRows.push({
      internalId,
      externalId,
      name,
      inactive,
    });
  }

  return deptRows;
}

export async function seedDepartments() {
  const filePath = path.resolve(
    process.cwd(),
    "attached_assets/DepartmentSearchnewResults641_1774853249333.xls"
  );

  if (!fs.existsSync(filePath)) {
    throw new Error("XLS file not found at: " + filePath);
  }

  const rows = parseXlsXml(filePath);
  console.log(`Parsed ${rows.length} department rows from XLS`);

  await db.delete(departments);

  const insertValues = rows.map((row) => ({
    internalId: row.internalId,
    externalId: row.externalId,
    name: row.name,
    inactive: row.inactive,
  }));

  if (insertValues.length > 0) {
    await db.insert(departments).values(insertValues);
  }

  console.log(`Seeded ${insertValues.length} departments`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedDepartments()
    .then(() => {
      console.log("Department seeding complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Department seeding failed:", err);
      process.exit(1);
    });
}
