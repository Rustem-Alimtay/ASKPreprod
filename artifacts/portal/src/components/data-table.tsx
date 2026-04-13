import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useState, useMemo } from "react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  testIdPrefix?: string;
  sortable?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data available",
  testIdPrefix = "table",
  sortable = false,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSortToggle = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortable || !sortColumn) return data;
    return [...data].sort((a, b) => {
      const key = sortColumn as keyof T;
      const aVal = String(a[key] ?? "").toLowerCase();
      const bVal = String(b[key] ?? "").toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection, sortable]);

  const renderHeader = (column: Column<T>, i: number) => {
    const isSortable = sortable && column.sortable !== false;
    if (isSortable) {
      return (
        <TableHead key={i} className={column.className}>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => handleSortToggle(column.key as string)}
            data-testid={`button-sort-${String(column.key)}`}
          >
            {column.header}
            {sortColumn === column.key ? (
              sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        </TableHead>
      );
    }
    return (
      <TableHead key={i} className={column.className}>
        {column.header}
      </TableHead>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, i) => (
                <TableHead key={i} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, i) => renderHeader(column, i))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <span>{emptyMessage}</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-testid={`${testIdPrefix}-container`}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, i) => renderHeader(column, i))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item) => (
            <TableRow key={item.id} className="hover-elevate" data-testid={`${testIdPrefix}-row-${item.id}`}>
              {columns.map((column, cellIndex) => (
                <TableCell key={cellIndex} className={column.className}>
                  {column.render
                    ? column.render(item)
                    : String(item[column.key as keyof T] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
