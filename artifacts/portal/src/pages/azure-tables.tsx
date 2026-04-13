import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Database, ArrowLeft, ChevronLeft, ChevronRight, Search,
  FileSpreadsheet, Landmark, FolderTree, Users, Trash2,
  Building2, UserCheck, Contact, CircleDot, Package,
  MapPin, GitBranch, Network, ArrowLeftRight, FlaskConical,
  Truck, List,
} from "lucide-react";
import { azureTableRegistry } from "@shared";

const iconMap: Record<string, any> = {
  FileSpreadsheet, Landmark, FolderTree, Users, Trash2,
  Building2, UserCheck, Contact, CircleDot, Package,
  MapPin, GitBranch, Network, ArrowLeftRight, FlaskConical,
  Truck, List,
};

export default function AzureTablesPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: summary, isLoading: summaryLoading } = useQuery<Record<string, number>>({
    queryKey: ["/api/azure-tables/summary"],
  });

  const { data: tableData, isLoading: tableLoading } = useQuery<{
    columns: string[];
    rows: Record<string, any>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/azure-tables", selectedTable, page],
    queryFn: async () => {
      const res = await fetch(`/api/azure-tables/${selectedTable}?page=${page}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const selectedMeta = azureTableRegistry.find((t) => t.key === selectedTable);

  if (selectedTable && selectedMeta) {
    const columns = tableData?.columns ?? [];
    const filteredRows = tableData?.rows?.filter((row) => {
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return Object.values(row).some(
        (v) => v != null && String(v).toLowerCase().includes(lower)
      );
    }) ?? [];

    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedTable(null); setPage(1); setSearchTerm(""); }}
            data-testid="button-back-to-tables"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white">
            {(() => { const Icon = iconMap[selectedMeta.icon]; return Icon ? <Icon className="h-4 w-4" /> : <Database className="h-4 w-4" />; })()}
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-table-title">{selectedMeta.label}</h1>
            <p className="text-xs text-muted-foreground">
              {tableData?.total ?? 0} records · Page {tableData?.page ?? 1} of {tableData?.totalPages ?? 1}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter visible rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-table-search"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm text-muted-foreground">
              {page} / {tableData?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (tableData?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {tableLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[calc(100vh-240px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap text-xs font-semibold uppercase">
                      {col.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length || 1} className="text-center py-10 text-muted-foreground">
                      {tableData?.total === 0 ? "No records in this table" : "No matching rows"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap text-sm max-w-[300px] truncate">
                          {row[col] == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : typeof row[col] === "boolean" ? (
                            <Badge variant={row[col] ? "default" : "secondary"}>
                              {row[col] ? "Yes" : "No"}
                            </Badge>
                          ) : (
                            String(row[col])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-azure-tables-title">Azure Tables</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-azure-tables-description">
            NetSuite data tables synced from Azure. Select a table to browse records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryLoading
          ? Array.from({ length: 17 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          : azureTableRegistry.map((t) => {
              const Icon = iconMap[t.icon] || Database;
              const count = summary?.[t.key] ?? 0;
              return (
                <Card
                  key={t.key}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700"
                  onClick={() => { setSelectedTable(t.key); setPage(1); setSearchTerm(""); }}
                  data-testid={`card-table-${t.key}`}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" data-testid={`text-table-name-${t.key}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {count.toLocaleString()} records
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {count.toLocaleString()}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
