import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Loader2, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import type { Requisition } from "@shared";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Rejected") return "destructive";
  if (status === "PO Created" || status === "Ready for Purchase") return "default";
  return "secondary";
}

function exportRequisitionPdf(r: Requisition) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Acquisition Request Form (ARF)", 14, 20);
  doc.setFontSize(10);
  let y = 35;
  const line = (label: string, value: string | number | null | undefined) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const str = value == null || value === "" ? "—" : String(value);
    const split = doc.splitTextToSize(str, 130);
    doc.text(split, 60, y);
    y += split.length * 6 + 2;
  };
  line("ID", r.id.slice(0, 8).toUpperCase());
  line("Title", r.requestTitle);
  line("Status", r.status);
  line("Department", r.department);
  line("Requested By", r.requestedBy);
  line("Date of Request", r.dateOfRequest);
  line("Required By", r.requiredByDate);
  line("Estimated Cost", `AED ${Number(r.estimatedCostAed).toLocaleString()}`);
  line("Budget Owner", r.budgetOwnerName);
  line("Vendor", r.vendorName);
  line("Description", r.description);
  line("Justification", r.justification);
  doc.save(`ARF_${r.id.slice(0, 8)}.pdf`);
}

export default function RequisitionsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const basePath = "/intranet/requisitions";

  const { data = [], isLoading } = useQuery<Requisition[]>({
    queryKey: ["/api/requisitions", search, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/requisitions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requisitions");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-requisitions-title">Requisitions</h1>
          <p className="text-muted-foreground">
            Acquisition Request Forms (ARF) — create, track, approve
          </p>
        </div>
        <Button asChild data-testid="button-new-requisition">
          <Link href={`${basePath}/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Requisition
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search title, department, requester..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending Line Manager">Pending Line Manager</SelectItem>
            <SelectItem value="Pending Purchasing Review">Pending Purchasing Review</SelectItem>
            <SelectItem value="Pending Budget Owner">Pending Budget Owner</SelectItem>
            <SelectItem value="Pending Final Approval">Pending Final Approval</SelectItem>
            <SelectItem value="Ready for Purchase">Ready for Purchase</SelectItem>
            <SelectItem value="PO Created">PO Created</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">No requisitions yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first requisition to get started.
            </p>
            <Button asChild>
              <Link href={`${basePath}/new`}>
                <Plus className="h-4 w-4 mr-2" />
                New Requisition
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-40">Department</TableHead>
                <TableHead className="w-40">Requested By</TableHead>
                <TableHead className="w-36 text-right">Cost (AED)</TableHead>
                <TableHead className="w-44">Status</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id} data-testid={`row-requisition-${r.id}`}>
                  <TableCell>
                    <Link href={`${basePath}/${r.id}`}>
                      <span className="font-mono text-xs text-primary hover:underline">
                        {r.id.slice(0, 8).toUpperCase()}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`${basePath}/${r.id}`}>
                      <span className="font-medium text-sm hover:underline">{r.requestTitle}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.department}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.requestedBy}</TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {Number(r.estimatedCostAed).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.dateOfRequest}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => exportRequisitionPdf(r)}
                      data-testid={`button-export-${r.id}`}
                      title="Export ARF to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
