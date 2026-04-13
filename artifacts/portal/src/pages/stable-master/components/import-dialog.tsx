import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowRight, ArrowLeft, Check, AlertCircle } from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";

interface FieldMapping {
  targetField: string;
  label: string;
  required?: boolean;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldMapping[];
  onImport: (data: Record<string, string>[]) => void;
  isPending?: boolean;
  extraSelectors?: React.ReactNode;
}

type Step = "upload" | "mapping" | "preview";

async function parseFile(buffer: ArrayBuffer, fileName: string): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "txt") {
    const text = new TextDecoder().decode(buffer);
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const data = result.data;
    if (data.length === 0) return { headers: [], rows: [] };
    const headers = data[0].map((h: string) => String(h).trim());
    const rows = data.slice(1)
      .filter((row: string[]) => row.some((cell: string) => String(cell).trim()))
      .map((row: string[]) => row.map((cell: string) => String(cell).trim()));
    return { headers, rows };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const data: string[][] = [];
  worksheet.eachRow((row) => {
    const values = (row.values as (ExcelJS.CellValue | undefined)[]).slice(1);
    data.push(values.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "object" && "text" in cell) return String((cell as ExcelJS.CellHyperlinkValue).text).trim();
      if (typeof cell === "object" && "result" in cell) return String((cell as ExcelJS.CellFormulaValue).result ?? "").trim();
      return String(cell).trim();
    }));
  });

  if (data.length === 0) return { headers: [], rows: [] };
  const headers = data[0];
  const rows = data.slice(1).filter((row) => row.some((cell) => cell));
  return { headers, rows };
}

export function ImportDialog({
  open,
  onOpenChange,
  title,
  fields,
  onImport,
  isPending,
  extraSelectors,
}: ImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");

  const reset = useCallback(() => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName("");
    setParseError("");
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const autoMap = (parsedHeaders: string[]) => {
    const autoMapping: Record<string, string> = {};
    for (const field of fields) {
      const normalize = (s: string) => s.toLowerCase().replace(/[_\s\-().]/g, "");
      const fieldKey = normalize(field.targetField);
      const fieldLabel = normalize(field.label);

      const match = parsedHeaders.find(h => {
        const nh = normalize(h);
        return nh === fieldKey || nh === fieldLabel ||
          nh.includes(fieldKey) || fieldKey.includes(nh) ||
          nh.includes(fieldLabel) || fieldLabel.includes(nh);
      });
      if (match) {
        autoMapping[field.targetField] = match;
      }
    }
    return autoMapping;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = await parseFile(buffer, file.name);

        if (parsed.headers.length === 0) {
          setParseError("No data found in the file. Make sure the first row contains column headers.");
          return;
        }

        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(autoMap(parsed.headers));
        setStep("mapping");
      } catch (err) {
        setParseError(`Failed to read file: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getMappedData = (): Record<string, string>[] => {
    return rows.map(row => {
      const obj: Record<string, string> = {};
      for (const field of fields) {
        const sourceHeader = mapping[field.targetField];
        if (sourceHeader) {
          const colIndex = headers.indexOf(sourceHeader);
          if (colIndex >= 0) {
            obj[field.targetField] = row[colIndex] || "";
          }
        }
      }
      return obj;
    }).filter(obj => Object.values(obj).some(v => v));
  };

  const missingRequired = fields
    .filter(f => f.required && !mapping[f.targetField])
    .map(f => f.label);

  const previewData = step === "preview" ? getMappedData() : [];

  const handleImport = () => {
    const data = getMappedData();
    onImport(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {(["upload", "mapping", "preview"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <Badge
                variant={step === s ? "default" : "outline"}
                className={step === s ? "" : "opacity-50"}
              >
                {i + 1}. {s === "upload" ? "Upload" : s === "mapping" ? "Map Fields" : "Preview & Import"}
              </Badge>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="space-y-4">
              {extraSelectors}
              <div className="border-2 border-dashed rounded-md p-8 text-center">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Select an Excel (.xlsx, .xls) or CSV file to import
                </p>
                <Input
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="max-w-xs mx-auto"
                  data-testid="input-import-file"
                />
                {fileName && !parseError && (
                  <p className="text-sm mt-2 text-primary font-medium">{fileName}</p>
                )}
                {parseError && (
                  <div className="flex items-start gap-2 p-3 mt-3 rounded-md bg-destructive/10 text-sm text-left">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: Excel (.xlsx, .xls) and CSV (comma or semicolon separated). First row must contain column headers.
              </p>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                File loaded: <strong>{fileName}</strong> ({rows.length} rows, {headers.length} columns)
              </p>
              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.targetField} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <Label className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[field.targetField] || "__none__"}
                      onValueChange={(val) =>
                        setMapping(prev => ({
                          ...prev,
                          [field.targetField]: val === "__none__" ? "" : val,
                        }))
                      }
                    >
                      <SelectTrigger className="flex-1" data-testid={`select-map-${field.targetField}`}>
                        <SelectValue placeholder="Select source column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Not mapped --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[field.targetField] && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <span>Required fields not mapped: {missingRequired.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Preview of {previewData.length} rows to import:
              </p>
              <div className="rounded-md border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {fields.filter(f => mapping[f.targetField]).map(f => (
                        <TableHead key={f.targetField}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {fields.filter(f => mapping[f.targetField]).map(f => (
                          <TableCell key={f.targetField}>{row[f.targetField] || "-"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {previewData.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 10 of {previewData.length} rows
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between gap-2 mt-4">
          <div>
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={() => setStep(step === "preview" ? "mapping" : "upload")}
                data-testid="button-import-back"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} data-testid="button-import-cancel">
              Cancel
            </Button>
            {step === "mapping" && (
              <Button
                onClick={() => setStep("preview")}
                disabled={missingRequired.length > 0}
                data-testid="button-import-next"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleImport}
                disabled={isPending || previewData.length === 0}
                data-testid="button-import-confirm"
              >
                <Upload className="w-4 h-4 mr-1" />
                Import {previewData.length} rows
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
