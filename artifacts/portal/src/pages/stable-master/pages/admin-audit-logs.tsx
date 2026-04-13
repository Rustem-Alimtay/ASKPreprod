import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";

interface AuditLog {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/sm2/audit-logs", page],
    queryFn: async () => {
      const res = await fetch(`/api/sm2/audit-logs?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-audit-logs-title">Audit Logs</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-loading">Loading...</p>
          ) : !data || data.logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-logs">No audit logs found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                      <TableCell className="whitespace-nowrap text-sm" data-testid={`text-log-date-${log.id}`}>
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell data-testid={`text-log-user-${log.id}`}>
                        {log.username || "System"}
                      </TableCell>
                      <TableCell data-testid={`text-log-action-${log.id}`}>
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {formatAction(log.action)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-log-entity-type-${log.id}`}>
                        {log.entityType || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground" data-testid={`text-log-entity-id-${log.id}`}>
                        {log.entityId ? log.entityId.substring(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" data-testid={`text-log-details-${log.id}`}>
                        {log.details || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground" data-testid="text-log-count">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm" data-testid="text-page-info">Page {page} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
