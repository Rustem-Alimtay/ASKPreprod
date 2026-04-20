import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Download, FileText, Users, Loader2, Upload, AlertCircle,
  ScanSearch, Merge, Trash2, ChevronLeft, ChevronRight, Clock,
  Tent, Phone, Home, GraduationCap, Heart, Database, Building2,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { DataSource, DsRecord, Department } from "@shared";

const iconMap: Record<string, any> = {
  Tent, Phone, Home, GraduationCap, Heart, FileText, Users, Database,
};

function isDateColumnKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_\s]+/g, '');
  return /\bdate\b|_date$|^date_|\bдата\b/i.test(key.toLowerCase()) ||
    ['calldate', 'dob', 'birthday', 'dateofbirth', 'createdat', 'updatedat',
     'expiresat', 'duedate', 'startdate', 'enddate', 'deadline'].includes(lower);
}

function formatCellValue(value: any, columnKey: string): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);
  if (isDateColumnKey(columnKey)) {
    const num = Number(str);
    if (!isNaN(num) && num >= 1 && num < 60000) {
      const utcDays = Math.floor(num) - 25569;
      const d = new Date(utcDays * 86400 * 1000);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }
  return str;
}

export default function CustomerDBPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const [activeSource, setActiveSource] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"records" | "cleanup" | "history">("records");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "result">("upload");
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [filePreview, setFilePreview] = useState<Record<string, string>[]>([]);
  const [fileTotalRows, setFileTotalRows] = useState(0);
  const [fileData, setFileData] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappingTargets, setMappingTargets] = useState<string[]>([]);
  const [mappingLabels, setMappingLabels] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; totalRows: number; skipReasons?: Record<string, number> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [scanFields, setScanFields] = useState<string[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<{ matchField: string; matchValue: string; records: DsRecord[] }[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<number, string>>({});
  const [scanDone, setScanDone] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [deptSearch, setDeptSearch] = useState("");
  const [deptPage, setDeptPage] = useState(1);
  const deptPageSize = 25;

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<DataSource[]>({
    queryKey: ["/api/data-sources"],
  });

  const { data: allDepartments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const currentSource = sources.find(s => s.slug === activeSource);

  const { data: recordsData, isLoading: recordsLoading } = useQuery<{ records: DsRecord[]; total: number }>({
    queryKey: ["/api/data-sources", activeSource, "records", searchQuery, currentPage, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", String(pageSize));
      params.set("offset", String((currentPage - 1) * pageSize));
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      const res = await fetch(`/api/data-sources/${activeSource}/records?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
    enabled: !!activeSource,
  });

  const { data: dsImportLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/data-sources", activeSource, "import-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/data-sources/${activeSource}/import-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeSource && activeTab === "history",
  });

  const toggleFieldMutation = useMutation({
    mutationFn: async ({ recordId, field, value }: { recordId: string; field: string; value: boolean }) => {
      const res = await apiRequest("PATCH", `/api/data-sources/${activeSource}/records/${recordId}`, { field, value });
      return res.json();
    },
    onMutate: async ({ recordId, field, value }) => {
      const qk = ["/api/data-sources", activeSource, "records", searchQuery, currentPage, sortBy, sortOrder];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<{ records: DsRecord[]; total: number }>(qk);
      if (previous) {
        queryClient.setQueryData(qk, {
          ...previous,
          records: previous.records.map((r) =>
            r.id === recordId ? { ...r, data: { ...(r.data as Record<string, any>), [field]: value } } : r
          ),
        });
      }
      return { previous, qk };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.qk, context.previous);
      }
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.qk) {
        queryClient.invalidateQueries({ queryKey: context.qk });
      }
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/data-sources/${activeSource}/import/preview`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to parse file"); }
      return res.json() as Promise<{ columns: string[]; preview: Record<string, string>[]; totalRows: number; fileData: string; savedMapping: Record<string, string> | null; savedColumns: { key: string; label: string; type: string }[] | null }>;
    },
    onSuccess: (data) => {
      setFileColumns(data.columns);
      setFilePreview(data.preview);
      setFileTotalRows(data.totalRows);
      setFileData(data.fileData);

      const hasExistingColumns = data.savedColumns && data.savedColumns.length > 0;

      if (hasExistingColumns) {
        const targets = data.savedColumns!.map(c => c.key);
        const labels: Record<string, string> = {};
        data.savedColumns!.forEach(c => { labels[c.key] = c.label; });
        setMappingTargets(targets);
        setMappingLabels(labels);
        if (data.savedMapping && Object.keys(data.savedMapping).length > 0) {
          setColumnMapping(data.savedMapping);
        } else {
          const autoMapping: Record<string, string> = {};
          for (const col of data.savedColumns!) {
            const match = data.columns.find(fc =>
              fc.toLowerCase() === col.key.toLowerCase() ||
              fc.toLowerCase() === col.label.toLowerCase()
            );
            if (match) autoMapping[col.key] = match;
          }
          setColumnMapping(autoMapping);
        }
      } else {
        const targets = data.columns.map(c => c.replace(/\s+/g, '_').replace(/[^\w]/g, '').toLowerCase());
        const labels: Record<string, string> = {};
        data.columns.forEach((col, i) => { labels[targets[i]] = col; });
        setMappingTargets(targets);
        setMappingLabels(labels);
        const autoMapping: Record<string, string> = {};
        data.columns.forEach((col, i) => { autoMapping[targets[i]] = col; });
        setColumnMapping(autoMapping);
      }
      setImportStep("mapping");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to read file", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { fileData: string; mapping: Record<string, string>; fileName?: string }) => {
      const res = await fetch(`/api/data-sources/${activeSource}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Import failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources", activeSource, "records"] });
      setImportResult(data);
      setImportStep("result");
      toast({ title: "Import completed", description: `${data.imported} records imported, ${data.skipped} skipped.` });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (fields: string[]) => {
      const res = await fetch(`/api/data-sources/${activeSource}/duplicates/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Scan failed");
      return res.json() as Promise<{ groups: { matchField: string; matchValue: string; records: DsRecord[] }[]; totalDuplicates: number }>;
    },
    onSuccess: (data) => {
      setDuplicateGroups(data.groups);
      setScanDone(true);
      const primaries: Record<number, string> = {};
      data.groups.forEach((g, i) => { primaries[i] = g.records[0].id; });
      setSelectedPrimary(primaries);
      if (data.groups.length === 0) {
        toast({ title: "No duplicates found", description: "Your data looks clean!" });
      } else {
        toast({ title: `${data.groups.length} duplicate groups found` });
      }
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (payload: { primaryId: string; secondaryIds: string[] }) => {
      const res = await fetch(`/api/data-sources/${activeSource}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Merge failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources", activeSource, "records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({ title: "Records merged successfully" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", `/api/data-sources/${activeSource}/records/delete-batch`, { ids });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources", activeSource, "records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({ title: "Records deleted successfully" });
    },
  });

  const handleMergeGroup = (groupIndex: number) => {
    const group = duplicateGroups[groupIndex];
    const primaryId = selectedPrimary[groupIndex];
    const secondaryIds = group.records.filter(r => r.id !== primaryId).map(r => r.id);
    mergeMutation.mutate({ primaryId, secondaryIds }, {
      onSuccess: () => { setDuplicateGroups(prev => prev.filter((_, i) => i !== groupIndex)); },
    });
  };

  const handleDeleteSecondaries = (groupIndex: number) => {
    const group = duplicateGroups[groupIndex];
    const primaryId = selectedPrimary[groupIndex];
    const secondaryIds = group.records.filter(r => r.id !== primaryId).map(r => r.id);
    bulkDeleteMutation.mutate(secondaryIds, {
      onSuccess: () => { setDuplicateGroups(prev => prev.filter((_, i) => i !== groupIndex)); },
    });
  };

  const handleDeleteAllDuplicates = () => {
    const allSecondaryIds: string[] = [];
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const primaryId = selectedPrimary[i] || group.records[0]?.id;
      allSecondaryIds.push(...group.records.filter(r => r.id !== primaryId).map(r => r.id));
    }
    if (allSecondaryIds.length === 0) return;
    bulkDeleteMutation.mutate(allSecondaryIds, {
      onSuccess: () => { setDuplicateGroups([]); setSelectedPrimary({}); setScanDone(false); },
    });
  };

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const url = `/api/data-sources/${activeSource}/records/clear-all`;
      console.log("[ClearAll] Sending POST to:", url);
      const res = await apiRequest("POST", url);
      const data = await res.json();
      console.log("[ClearAll] Response:", data);
      return data;
    },
    onSuccess: (data: { deleted: number }) => {
      toast({ title: `Cleared ${data.deleted} records from ${currentSource?.name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources", activeSource, "records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      setConfirmClearAll(false);
    },
    onError: (error) => {
      console.error("[ClearAll] Error:", error);
      toast({ title: "Failed to clear records: " + error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    previewMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [isDragging, setIsDragging] = useState(false);

  const isAcceptedImportFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  };

  const handleDropzoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isAcceptedImportFile(file)) {
      toast({ title: "Unsupported file", description: "Please drop a .xlsx, .xls, or .csv file.", variant: "destructive" });
      return;
    }
    previewMutation.mutate(file);
  };

  const handleImportSubmit = () => {
    const hasAnyMapping = Object.values(columnMapping).some(v => !!v);
    if (!hasAnyMapping) {
      toast({ title: "At least one field mapping is required", variant: "destructive" });
      return;
    }
    importMutation.mutate({ fileData, mapping: columnMapping });
  };

  const resetImportDialog = () => {
    setImportStep("upload");
    setFileColumns([]);
    setFilePreview([]);
    setFileTotalRows(0);
    setFileData("");
    setColumnMapping({});
    setMappingTargets([]);
    setMappingLabels({});
    setImportResult(null);
  };

  const records = recordsData?.records || [];
  const totalRecords = recordsData?.total || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const columns = currentSource?.columns as { key: string; label: string; type: string }[] || [];

  const exportToCSV = () => {
    if (columns.length === 0 || records.length === 0) return;
    const headers = columns.map(c => c.label);
    const csvContent = [
      headers.join(","),
      ...records.map(r => {
        const d = r.data as Record<string, any>;
        return columns.map(c => `"${formatCellValue(d[c.key], c.key).replace(/"/g, '""')}"`).join(",");
      }),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSource || "records"}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSourceSelect = (slug: string) => {
    setActiveSource(slug);
    setSearchQuery("");
    setCurrentPage(1);
    setSortBy("createdAt");
    setSortOrder("desc");
    setActiveTab("records");
    setScanDone(false);
    setDuplicateGroups([]);
    setConfirmClearAll(false);
    setScanFields([]);
    setDeptSearch("");
    setDeptPage(1);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Master Customer Database</h1>
          <p className="text-muted-foreground">Multi-source customer data management</p>
        </div>
        {activeSource && activeSource !== "__departments" && (
          <div className="flex items-center gap-3 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-export">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} data-testid="button-export-csv">
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-import-file"
            />
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => { resetImportDialog(); setImportDialogOpen(true); }}
                disabled={previewMutation.isPending}
                data-testid="button-import-file"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import Excel
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {sourcesLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            {sources.map((source) => {
              const isActive = activeSource === source.slug;
              const Icon = iconMap[source.icon] || Database;
              return (
                <Card
                  key={source.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary shadow-md' : 'hover:ring-1 hover:ring-muted-foreground/20'}`}
                  onClick={() => handleSourceSelect(source.slug)}
                  data-testid={`card-source-${source.slug}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                        style={{ backgroundColor: `${source.color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: source.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{source.name}</p>
                        <p className="text-xl font-bold" data-testid={`text-count-${source.slug}`}>
                          {(source as any).recordCount ?? source.recordCount ?? 0}
                        </p>
                      </div>
                    </div>
                    {source.lastImportAt && (
                      <p className="text-[10px] text-muted-foreground mt-2 truncate">
                        Last import: {format(new Date(source.lastImportAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${activeSource === "__departments" ? 'ring-2 ring-primary shadow-md' : 'hover:ring-1 hover:ring-muted-foreground/20'}`}
              onClick={() => handleSourceSelect("__departments")}
              data-testid="card-source-departments"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">Departments</p>
                    <p className="text-xl font-bold" data-testid="text-count-departments">
                      {deptsLoading ? "..." : allDepartments.length}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 truncate">NetSuite org structure</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {!activeSource && !sourcesLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Select a Data Source</h3>
            <p className="text-sm text-muted-foreground">Click on one of the source cards above to view and manage its records</p>
          </CardContent>
        </Card>
      )}

      {activeSource === "__departments" && (
        <DepartmentsTable
          departments={allDepartments}
          isLoading={deptsLoading}
          search={deptSearch}
          onSearchChange={(v) => { setDeptSearch(v); setDeptPage(1); }}
          page={deptPage}
          pageSize={deptPageSize}
          onPageChange={setDeptPage}
        />
      )}

      {activeSource && activeSource !== "__departments" && (
        <>
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setActiveTab("records")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "records" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-records"
            >
              Records
            </button>
            {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("cleanup")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "cleanup" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-cleanup"
            >
              <ScanSearch className="h-4 w-4" />
              Data Cleanup
            </button>
            )}
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-history"
            >
              <Clock className="h-4 w-4" />
              Import History
            </button>
          </div>

          {activeTab === "records" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {currentSource?.name} Records
                    <Badge variant="secondary">{totalRecords}</Badge>
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={
                        currentSource?.name?.toLowerCase().includes("employee")
                          ? "Search by employee code, name, or email..."
                          : `Search in ${currentSource?.name || "records"}...`
                      }
                      className="w-full sm:w-[300px] pl-9"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      data-testid="input-search-records"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {columns.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium mb-1">No data yet</p>
                    <p className="text-sm">Import an Excel file to populate this data source. Columns will be created automatically from the file.</p>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns.map((col) => (
                              <TableHead
                                key={col.key}
                                className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                                onClick={() => {
                                  if (sortBy === col.key) { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }
                                  else { setSortBy(col.key); setSortOrder("asc"); }
                                  setCurrentPage(1);
                                }}
                                data-testid={`sort-${col.key}`}
                              >
                                <div className="flex items-center gap-1">
                                  {col.label}
                                  {sortBy === col.key && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recordsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                {columns.map((col) => (
                                  <TableCell key={col.key}><Skeleton className="h-5 w-24" /></TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : records.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                                {searchQuery ? "No records found matching your search" : "No records yet."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            records.map((record) => {
                              const d = record.data as Record<string, any>;
                              return (
                                <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                                  {columns.map((col) => {
                                    const isBoolCol = col.type === "boolean";
                                    const rawVal = d[col.key];
                                    const boolVal = rawVal === true || rawVal === "TRUE" || rawVal === "true";

                                    if (isBoolCol) {
                                      return (
                                        <TableCell key={col.key} className="text-sm whitespace-nowrap">
                                          <Checkbox
                                            checked={boolVal}
                                            disabled
                                            className="opacity-50 cursor-not-allowed"
                                            data-testid={`checkbox-${col.key}-${record.id}`}
                                          />
                                        </TableCell>
                                      );
                                    }

                                    return (
                                      <TableCell key={col.key} className="text-sm whitespace-nowrap max-w-[200px] truncate">
                                        {d[col.key] != null ? formatCellValue(d[col.key], col.key) : <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t pt-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} data-testid="button-prev-page">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                              if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, idx) =>
                              p === "..." ? (
                                <span key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground">...</span>
                              ) : (
                                <Button key={p} variant={currentPage === p ? "default" : "outline"} size="sm" className="min-w-[36px]" onClick={() => setCurrentPage(p as number)} data-testid={`button-page-${p}`}>
                                  {p}
                                </Button>
                              )
                            )}
                          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} data-testid="button-next-page">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "cleanup" && isSuperAdmin && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Scan for Duplicates</CardTitle>
                  <p className="text-sm text-muted-foreground">Select which fields to check for duplicate values within {currentSource?.name}</p>
                </CardHeader>
                <CardContent>
                  {columns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Import data first to enable duplicate detection.</p>
                  ) : (
                    <div className="flex items-center gap-4 flex-wrap">
                      <Select
                        value={scanFields[0] || "__none__"}
                        onValueChange={(v) => setScanFields(v === "__none__" ? [] : [v])}
                      >
                        <SelectTrigger className="w-[200px]" data-testid="select-scan-field">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Select field --</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => scanMutation.mutate(scanFields)}
                        disabled={scanMutation.isPending || scanFields.length === 0}
                        data-testid="button-scan-duplicates"
                      >
                        {scanMutation.isPending ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning...</>
                        ) : (
                          <><ScanSearch className="mr-2 h-4 w-4" />Scan</>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Clear All Records</CardTitle>
                  <p className="text-sm text-muted-foreground">Remove all records from {currentSource?.name}. This cannot be undone.</p>
                </CardHeader>
                <CardContent>
                  {!confirmClearAll ? (
                    <Button variant="destructive" onClick={() => setConfirmClearAll(true)} disabled={totalRecords === 0} data-testid="button-clear-all-start">
                      <Trash2 className="mr-2 h-4 w-4" />Clear All Records ({totalRecords})
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      <p className="text-sm">Are you sure? This will permanently delete all {totalRecords} records from {currentSource?.name}.</p>
                      <div className="flex gap-2 ml-auto flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setConfirmClearAll(false)} data-testid="button-clear-all-cancel">Cancel</Button>
                        <Button size="sm" variant="destructive" onClick={() => clearAllMutation.mutate()} disabled={clearAllMutation.isPending} data-testid="button-clear-all-confirm">
                          {clearAllMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Yes, Clear All
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {scanDone && duplicateGroups.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No duplicates found. Your data is clean!
                  </CardContent>
                </Card>
              )}

              {duplicateGroups.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Found {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">Select the primary record to keep in each group.</p>
                      </div>
                      <Button variant="destructive" onClick={handleDeleteAllDuplicates} disabled={bulkDeleteMutation.isPending} data-testid="button-delete-all-duplicates">
                        {bulkDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete All Duplicates
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {duplicateGroups.map((group, groupIndex) => (
                <Card key={groupIndex} data-testid={`duplicate-group-${groupIndex}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Group #{groupIndex + 1}
                        <Badge variant="outline" className="ml-2 text-xs">{group.records.length} records</Badge>
                        <Badge variant="secondary" className="ml-2 text-xs">Match: {group.matchField} = "{group.matchValue}"</Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleMergeGroup(groupIndex)} disabled={mergeMutation.isPending} data-testid={`button-merge-group-${groupIndex}`}>
                          <Merge className="mr-1 h-3 w-3" />Merge
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteSecondaries(groupIndex)} disabled={bulkDeleteMutation.isPending} data-testid={`button-delete-group-${groupIndex}`}>
                          <Trash2 className="mr-1 h-3 w-3" />Delete duplicates
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Keep</TableHead>
                            {columns.slice(0, 5).map((col) => (
                              <TableHead key={col.key}>{col.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.records.map((record) => {
                            const isPrimary = selectedPrimary[groupIndex] === record.id;
                            const d = record.data as Record<string, any>;
                            return (
                              <TableRow
                                key={record.id}
                                className={`cursor-pointer ${isPrimary ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                                onClick={() => setSelectedPrimary({ ...selectedPrimary, [groupIndex]: record.id })}
                              >
                                <TableCell>
                                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isPrimary ? "border-blue-600 bg-blue-600" : "border-muted-foreground"}`}>
                                    {isPrimary && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                  </div>
                                </TableCell>
                                {columns.slice(0, 5).map((col) => (
                                  <TableCell key={col.key} className="text-sm">
                                    {d[col.key] ? formatCellValue(d[col.key], col.key) : <span className="text-muted-foreground italic">empty</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "history" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Import History — {currentSource?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : dsImportLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8" data-testid="history-empty">
                    No import history yet for {currentSource?.name}.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Total Rows</TableHead>
                        <TableHead>Imported</TableHead>
                        <TableHead>Skipped</TableHead>
                        <TableHead>Imported By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dsImportLogs.map((log: any) => (
                        <TableRow key={log.id} data-testid={`row-import-log-${log.id}`}>
                          <TableCell className="text-sm">{format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                          <TableCell className="text-sm font-medium">{log.fileName}</TableCell>
                          <TableCell className="text-sm">{log.totalRows}</TableCell>
                          <TableCell className="text-sm text-green-600 dark:text-green-400">{log.imported}</TableCell>
                          <TableCell className="text-sm text-yellow-600 dark:text-yellow-400">{log.skipped}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.importedByName || log.importedBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) resetImportDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {importStep === "upload" && `Import to ${currentSource?.name}`}
              {importStep === "mapping" && "Map Columns"}
              {importStep === "result" && "Import Results"}
            </DialogTitle>
            <DialogDescription>
              {importStep === "upload" && "Upload an Excel file (.xlsx, .xls, .csv)."}
              {importStep === "mapping" && `File loaded with ${fileTotalRows} rows. Map each target field to a column from your file.`}
              {importStep === "result" && "Import has been completed."}
            </DialogDescription>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4 py-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center space-y-3 transition-colors ${isDragging ? "border-primary bg-primary/5" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={handleDropzoneDrop}
                data-testid="dropzone-import-file"
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drag & drop a file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supported: .xlsx, .xls, .csv (max 10MB)</p>
                </div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={previewMutation.isPending} data-testid="button-select-file">
                  {previewMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading file...</> : <>Select File</>}
                </Button>
              </div>
            </div>
          )}

          {importStep === "mapping" && (
            <div className="space-y-4 py-4">
              <div className="grid gap-3">
                {mappingTargets.map((target) => (
                  <div key={target} className="flex items-center gap-3">
                    <Label className="text-sm font-medium shrink-0 w-[160px] truncate" title={target}>
                      {mappingLabels[target] || target.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Label>
                    <Select
                      value={columnMapping[target] || "__none__"}
                      onValueChange={(v) => setColumnMapping({ ...columnMapping, [target]: v === "__none__" ? "" : v })}
                    >
                      <SelectTrigger data-testid={`select-map-${target}`} className="w-[220px]">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-48 overflow-y-auto" position="popper" sideOffset={4}>
                        <SelectItem value="__none__">-- Skip --</SelectItem>
                        {fileColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {filePreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview (first {filePreview.length} rows):</p>
                  <div className="border rounded-lg overflow-auto max-h-48">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          {fileColumns.map((col) => (
                            <TableHead key={col} className="text-xs whitespace-nowrap bg-background">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filePreview.map((row, i) => (
                          <TableRow key={i}>
                            {fileColumns.map((col) => (
                              <TableCell key={col} className="text-xs py-1 whitespace-nowrap">{formatCellValue(row[col], col)}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {importStep === "result" && importResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{importResult.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
              </div>

              {importResult.skipped > 0 && importResult.skipReasons && (
                <div className="border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">Skip reasons:</p>
                  <div className="space-y-2">
                    {Object.entries(importResult.skipReasons).filter(([, v]) => v > 0).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {importStep === "mapping" && (
              <>
                <Button variant="outline" onClick={() => setImportStep("upload")} data-testid="button-back-upload">Back</Button>
                <Button
                  onClick={handleImportSubmit}
                  disabled={!Object.values(columnMapping).some(v => !!v) || importMutation.isPending}
                  data-testid="button-start-import"
                >
                  {importMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <>Import {fileTotalRows} rows</>}
                </Button>
              </>
            )}
            {importStep === "result" && (
              <Button onClick={() => { setImportDialogOpen(false); resetImportDialog(); }} data-testid="button-close-import">Close</Button>
            )}
            {importStep === "upload" && (
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-cancel-import">Cancel</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentsTable({
  departments,
  isLoading,
  search,
  onSearchChange,
  page,
  pageSize,
  onPageChange,
}: {
  departments: Department[];
  isLoading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "result">("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [colMapping, setColMapping] = useState<Record<string, string>>({
    internalId: "", externalId: "", name: "", inactive: "",
  });
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deptFields = [
    { key: "internalId", label: "Internal ID", required: true },
    { key: "externalId", label: "External ID", required: false },
    { key: "name", label: "Name", required: true },
    { key: "inactive", label: "Inactive", required: false },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "Empty file", description: "CSV must have a header row and at least one data row", variant: "destructive" });
        return;
      }
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
          else { current += char; }
        }
        result.push(current.trim());
        return result;
      };
      const headers = parseCSVLine(lines[0]);
      setCsvHeaders(headers);
      setCsvTotalRows(lines.length - 1);
      const preview: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(lines.length, 4); i++) {
        const vals = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
        preview.push(row);
      }
      setCsvPreview(preview);
      const autoMap: Record<string, string> = { internalId: "", externalId: "", name: "", inactive: "" };
      const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      headers.forEach((h, idx) => {
        const lh = lowerHeaders[idx];
        if (lh.includes("internalid") || lh === "id") autoMap.internalId = h;
        else if (lh.includes("externalid")) autoMap.externalId = h;
        else if (lh === "name" || lh === "departmentname" || lh === "deptname") autoMap.name = h;
        else if (lh.includes("inactive") || lh === "status") autoMap.inactive = h;
      });
      setColMapping(autoMap);
      setImportStep("mapping");
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("file", csvFile!);
      formData.append("mapping", JSON.stringify(colMapping));
      const res = await fetch("/api/departments/import", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setImportStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Import complete", description: `${data.imported} new, ${data.updated} updated, ${data.skipped} skipped` });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const resetImport = () => {
    setImportStep("upload");
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvPreview([]);
    setCsvTotalRows(0);
    setColMapping({ internalId: "", externalId: "", name: "", inactive: "" });
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = departments.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) ||
      d.externalId.toLowerCase().includes(q) ||
      String(d.internalId).includes(q);
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeCount = departments.filter(d => !d.inactive).length;
  const inactiveCount = departments.filter(d => d.inactive).length;

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Departments
            <Badge variant="secondary">{filtered.length}</Badge>
            <Badge variant="outline" className="text-green-600">{activeCount} active</Badge>
            {inactiveCount > 0 && <Badge variant="outline" className="text-red-500">{inactiveCount} inactive</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                className="w-[260px] pl-9"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                data-testid="input-search-departments"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }} data-testid="button-import-departments">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Internal ID</TableHead>
                    <TableHead className="whitespace-nowrap">External ID</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {search ? "No departments match your search" : "No departments found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((dept) => (
                      <TableRow key={dept.internalId} data-testid={`row-dept-${dept.internalId}`}>
                        <TableCell className="font-mono text-sm">{dept.internalId}</TableCell>
                        <TableCell className="font-mono text-sm">{dept.externalId}</TableCell>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>
                          <Badge variant={dept.inactive ? "destructive" : "default"} className={dept.inactive ? "" : "bg-green-600"}>
                            {dept.inactive ? "Inactive" : "Active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    data-testid="button-dept-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{page} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    data-testid="button-dept-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <Dialog open={importOpen} onOpenChange={(v) => { if (!v) { setImportOpen(false); resetImport(); } else setImportOpen(true); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Departments from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with department data. Required columns: Internal ID, Name.
          </DialogDescription>
        </DialogHeader>

        {importStep === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dept-csv-dropzone"
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">Max 5MB, .csv format</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-dept-csv-file"
            />
          </div>
        )}

        {importStep === "mapping" && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">File: {csvFile?.name}</p>
              <p className="text-xs text-muted-foreground">{csvTotalRows} data rows detected, {csvHeaders.length} columns</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Map CSV columns to department fields:</p>
              {deptFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="w-36 text-sm flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    value={colMapping[field.key] || "__none"}
                    onValueChange={(v) => setColMapping(prev => ({ ...prev, [field.key]: v === "__none" ? "" : v }))}
                  >
                    <SelectTrigger className="flex-1" data-testid={`select-map-${field.key}`}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">-- Skip --</SelectItem>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview (first {csvPreview.length} rows):</p>
                <div className="border rounded-lg overflow-auto max-h-40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, i) => (
                        <TableRow key={i}>
                          {csvHeaders.map(h => <TableCell key={h} className="text-xs py-1">{row[h]}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {importStep === "result" && importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.imported}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{importResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                <p className="text-2xl font-bold">{importResult.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
            </div>
            {importResult.skipDetails && importResult.skipDetails.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Skipped rows:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importResult.skipDetails.map((s: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">Row {s.row}: {s.reason}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {importStep === "mapping" && (
            <>
              <Button variant="outline" onClick={() => { resetImport(); }} data-testid="button-dept-import-back">Back</Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={!colMapping.internalId || !colMapping.name || importMutation.isPending}
                data-testid="button-dept-import-submit"
              >
                {importMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <>Import {csvTotalRows} rows</>}
              </Button>
            </>
          )}
          {importStep === "result" && (
            <Button onClick={() => { setImportOpen(false); resetImport(); }} data-testid="button-dept-import-close">Close</Button>
          )}
          {importStep === "upload" && (
            <Button variant="outline" onClick={() => setImportOpen(false)} data-testid="button-dept-import-cancel">Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
