import { OtherModulesSection } from "@/components/other-modules-section";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Search, Filter, FileDown } from "lucide-react";
import type { Requisition } from "@shared";
import { useAuth } from "@/hooks/use-auth";
import { jsPDF } from "jspdf";

const statusOptions = [
  "Submitted",
  "Pending Line Manager",
  "Pending Purchasing Review",
  "Pending Budget Owner",
  "Pending Final Approval",
  "Ready for Purchase",
  "PO Created",
  "Rejected",
];

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Submitted": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0";
    case "Pending Line Manager": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0";
    case "Pending Purchasing Review": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0";
    case "Pending Budget Owner": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0";
    case "Pending Final Approval": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0";
    case "Ready for Purchase": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0";
    case "PO Created": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0";
    case "Rejected": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0";
    case "Awaiting Approval": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0";
    default: return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-0";
  }
}

export default function RequisitionsListPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isIntranet = location.startsWith("/intranet");
  const basePath = isIntranet ? "/intranet/requisitions" : "/erp/procurement/requisitions";
  const backPath = isIntranet ? "/intranet" : "/erp/procurement";

  const { data: requisitions = [], isLoading } = useQuery<Requisition[]>({
    queryKey: ["/api/requisitions", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/requisitions?${params.toString()}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-AE", { style: "decimal", minimumFractionDigits: 2 }).format(cost / 100);
  };

  const generatePdf = (req: Requisition) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Approval Request Form (ARF)", pageWidth / 2, y, { align: "center" });
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Request ID: ${req.id.slice(0, 8).toUpperCase()}`, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.text(`Status: ${req.status}`, pageWidth / 2, y, { align: "center" });
    y += 12;

    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    const addSection = (title: string, fields: [string, string][]) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      fields.forEach(([label, value]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, margin, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(value || "—", contentWidth - 50);
        doc.text(lines, margin + 50, y);
        y += lines.length * 5 + 3;
      });
      y += 5;
    };

    addSection("1. Request Information", [
      ["Title", req.requestTitle],
      ["Department", req.department],
      ["Requested By", req.requestedBy],
      ["Position", req.position || "—"],
      ["Date", req.date],
      ["Date of Request", req.dateOfRequest],
    ]);

    addSection("2. Description of Request", [
      ["Description", req.description],
    ]);

    addSection("3. Justification / Business Need", [
      ["Justification", req.justification],
    ]);

    addSection("4. Budget Details", [
      ["Estimated Cost (AED)", formatCost(req.estimatedCostAed)],
      ["Budget Line / Account Code", req.budgetLineAccountCode || "—"],
      ["Is this Budgeted?", req.isBudgeted ? "Yes" : "No"],
      ["Vendor Name", req.vendorName || "—"],
    ]);

    addSection("5. Timeline", [
      ["Required By Date", req.requiredByDate],
      ["Project Start Date", req.projectStartDate || "—"],
    ]);

    doc.save(`ARF-${req.id.slice(0, 8).toUpperCase()}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)} data-testid="button-back-finance">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-outfit" data-testid="text-page-title">Requisitions</h1>
            <p className="text-muted-foreground">Manage approval request forms</p>
          </div>
        </div>
        <Button onClick={() => navigate(`${basePath}/new?from=${backPath}`)} data-testid="button-new-requisition">
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, department, or requester..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-requisitions"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left font-medium text-muted-foreground">Request ID</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Request Title</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Department</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Requested By</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Est. Cost (AED)</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Date of Request</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Required By</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Workflow Stage</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">PDF</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">No requisitions found</td>
                  </tr>
                ) : (
                  requisitions.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("select, button")) return;
                        navigate(`${basePath}/${req.id}`);
                      }}
                      data-testid={`row-requisition-${req.id}`}
                    >
                      <td className="p-3 font-mono text-xs" data-testid={`text-req-id-${req.id}`}>
                        {req.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-3 font-medium" data-testid={`text-req-title-${req.id}`}>{req.requestTitle}</td>
                      <td className="p-3 text-muted-foreground">{req.department}</td>
                      <td className="p-3 text-muted-foreground">{req.requestedBy}</td>
                      <td className="p-3 text-right font-medium">{formatCost(req.estimatedCostAed)}</td>
                      <td className="p-3 text-muted-foreground">{req.dateOfRequest}</td>
                      <td className="p-3 text-muted-foreground">{req.requiredByDate}</td>
                      <td className="p-3">
                        <Badge className={`${getStatusBadgeClass(req.status)} text-[10px]`} data-testid={`badge-status-${req.id}`}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => generatePdf(req)}
                          data-testid={`button-pdf-${req.id}`}
                          title="Download PDF"
                        >
                          <FileDown className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <OtherModulesSection />
    </div>
  );
}
