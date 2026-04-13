import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { viewInvoicePDF, downloadInvoicePDF } from "../lib/invoice-pdf";
import {
  Trash2, Eye, Download, FileJson, Send, CheckCircle,
  ShieldCheck, XCircle, ArrowRight, Clock, MessageSquare,
  MoreVertical, RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function formatBillingMonth(billingMonth: string | null | undefined): string {
  if (!billingMonth) return "-";
  const [y, m] = billingMonth.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  VET_VALIDATION: { label: "Vet Validation", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  STORES_VALIDATION: { label: "Stores Validation", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300" },
  FINANCE_VALIDATION: { label: "Finance Validation", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  PUSHED_TO_ERP: { label: "Pushed to ERP", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-800" };
  return (
    <Badge variant="outline" className={`${config.color} border-0 font-medium`} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

function canSendForValidation(userRole: string, invoiceStatus: string) {
  return (userRole === "ADMIN" || userRole === "LIVERY_ADMIN") && invoiceStatus === "DRAFT";
}

function canApproveReject(userRole: string, invoiceStatus: string) {
  if (userRole === "ADMIN" && ["VET_VALIDATION", "STORES_VALIDATION", "FINANCE_VALIDATION"].includes(invoiceStatus)) return true;
  if (userRole === "VETERINARY" && invoiceStatus === "VET_VALIDATION") return true;
  if (userRole === "STORES" && invoiceStatus === "STORES_VALIDATION") return true;
  if (userRole === "FINANCE" && invoiceStatus === "FINANCE_VALIDATION") return true;
  return false;
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [generatingSo, setGeneratingSo] = useState<string | null>(null);
  const [sendingToNetsuite, setSendingToNetsuite] = useState<string | null>(null);
  const [validationDialog, setValidationDialog] = useState<{ invoice: any; action: "APPROVED" | "REJECTED" } | null>(null);
  const [validationComment, setValidationComment] = useState("");
  const [historyDialog, setHistoryDialog] = useState<any | null>(null);

  const { data: me } = useQuery<{ id: string; username: string; role: string }>({
    queryKey: ["/api/sm2/me"],
  });
  const userRole = me?.role || "LIVERY_ADMIN";

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/invoices"],
  });

  const { data: validationHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/invoices", historyDialog?.id, "validations"],
    queryFn: async () => {
      if (!historyDialog?.id) return [];
      const res = await fetch(`/api/sm2/invoices/${historyDialog.id}/validations`);
      return res.json();
    },
    enabled: !!historyDialog?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sm2/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billing-elements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billed-months"] });
      toast({ title: "Invoice deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const sendForValidationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/sm2/invoices/${id}/send-for-validation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      toast({ title: "Invoice sent for validation" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to send for validation", variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment: string }) =>
      apiRequest("POST", `/api/sm2/invoices/${id}/validate`, { action, comment }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      setValidationDialog(null);
      setValidationComment("");
      const label = data.erpPushed ? "Approved and pushed to ERP" : data.status === "DRAFT" ? "Invoice rejected" : "Invoice approved";
      toast({ title: label });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Validation failed", variant: "destructive" });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/sm2/invoices/${id}/rollback`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billing-elements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billed-months"] });
      toast({ title: "Invoice rolled back to edit" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to rollback invoice", variant: "destructive" });
    },
  });

  const handlePdfAction = async (invoiceId: string, action: "view" | "download") => {
    setLoadingPdf(invoiceId);
    try {
      const res = await fetch(`/api/sm2/invoices/${invoiceId}/details`);
      if (!res.ok) throw new Error("Failed to load invoice details");
      const details = await res.json();
      if (action === "view") {
        viewInvoicePDF(details);
      } else {
        downloadInvoicePDF(details);
      }
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setLoadingPdf(null);
    }
  };

  const handleGenerateSO = async (invoiceId: string) => {
    setGeneratingSo(invoiceId);
    try {
      const res = await apiRequest("POST", `/api/sm2/invoices/${invoiceId}/generate-so`);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      toast({ title: `NetSuite SO generated (PO: ${data.poNumber})` });
    } catch {
      toast({ title: "Failed to generate SO", variant: "destructive" });
    } finally {
      setGeneratingSo(null);
    }
  };

  const handleSendToNetsuite = async (invoiceId: string) => {
    setSendingToNetsuite(invoiceId);
    try {
      const res = await apiRequest("POST", `/api/sm2/invoices/${invoiceId}/send-to-netsuite`);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      toast({ title: data.netsuiteId ? `Sent to NetSuite (ID: ${data.netsuiteId})` : "Successfully sent to NetSuite" });
    } catch (e: any) {
      let msg = "Failed to send to NetSuite";
      try {
        const errData = e?.message || "";
        if (errData) msg = errData;
      } catch {}
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSendingToNetsuite(null);
    }
  };

  const handleDownloadJson = (invoice: any) => {
    if (!invoice.netsuiteJson) return;
    const blob = new Blob([invoice.netsuiteJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const invoiceNo = invoice.poNumber || invoice.id.substring(0, 8);
    a.href = url;
    a.download = `Invoice_${invoiceNo}_NetSuiteSO.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: "id", label: "Invoice No", render: (item: any) => item.poNumber || item.id.substring(0, 8) + "..." },
    { key: "customerName", label: "Customer" },
    {
      key: "billingMonth",
      label: "Invoice Month",
      render: (item: any) => formatBillingMonth(item.billingMonth),
    },
    {
      key: "totalAmount",
      label: "Amount",
      render: (item: any) => `AED ${parseFloat(item.totalAmount).toFixed(2)}`,
    },
    {
      key: "status",
      label: "Status",
      render: (item: any) => <InvoiceStatusBadge status={item.status} />,
    },
    {
      key: "netsuiteId",
      label: "NetSuite SO",
      render: (item: any) => item.netsuiteId ? (
        <span className="font-mono text-sm" data-testid={`text-netsuite-so-${item.id}`}>{item.netsuiteId}</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Invoices"
        description="View and manage invoices through the validation workflow"
      />

      {userRole === "ADMIN" && (
        <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 text-sm text-orange-800 dark:text-orange-300" data-testid="text-temp-delete-notice">
          Temporary feature: Invoice deletion is enabled for testing purposes and will be removed in a future release.
        </div>
      )}

      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        emptyMessage="No invoices yet"
        actions={(item) => (
          <div className="flex items-center gap-1">
            {canApproveReject(userRole, item.status) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950"
                  onClick={() => setValidationDialog({ invoice: item, action: "APPROVED" })}
                  data-testid={`button-approve-${item.id}`}
                >
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
                  onClick={() => setValidationDialog({ invoice: item, action: "REJECTED" })}
                  data-testid={`button-reject-${item.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  data-testid={`button-actions-${item.id}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handlePdfAction(item.id, "view")}
                  disabled={loadingPdf === item.id}
                  data-testid={`button-view-pdf-${item.id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handlePdfAction(item.id, "download")}
                  disabled={loadingPdf === item.id}
                  data-testid={`button-download-pdf-${item.id}`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => setHistoryDialog(item)}
                  data-testid={`button-history-${item.id}`}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Validation History
                </DropdownMenuItem>

                {item.soGenerated && item.netsuiteJson && (
                  <DropdownMenuItem
                    onClick={() => handleDownloadJson(item)}
                    data-testid={`button-download-json-${item.id}`}
                  >
                    <FileJson className="w-4 h-4 mr-2" />
                    JSON
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {canSendForValidation(userRole, item.status) && (
                  <DropdownMenuItem
                    onClick={() => sendForValidationMutation.mutate(item.id)}
                    disabled={sendForValidationMutation.isPending}
                    data-testid={`button-send-validation-${item.id}`}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Send for Validation
                  </DropdownMenuItem>
                )}

                {(item.status === "APPROVED" || item.status === "PUSHED_TO_ERP") && (userRole === "ADMIN" || userRole === "FINANCE") && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleGenerateSO(item.id)}
                      disabled={generatingSo === item.id}
                      data-testid={`button-generate-so-${item.id}`}
                    >
                      <FileJson className="w-4 h-4 mr-2" />
                      {item.soGenerated ? "Regenerate SO" : "Generate SO"}
                    </DropdownMenuItem>

                    {item.soGenerated && (
                      <DropdownMenuItem
                        onClick={() => handleSendToNetsuite(item.id)}
                        disabled={sendingToNetsuite === item.id}
                        data-testid={`button-send-netsuite-${item.id}`}
                      >
                        {item.sentToNetsuite ? <CheckCircle className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        {sendingToNetsuite === item.id ? "Sending..." : item.sentToNetsuite ? "Resend to NetSuite" : "Send to NetSuite"}
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                {item.status !== "PUSHED_TO_ERP" && (userRole === "ADMIN" || userRole === "LIVERY_ADMIN") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        if (window.confirm("Rollback this invoice? It will be unbilled and returned to the 'To Invoice' page for editing.")) {
                          rollbackMutation.mutate(item.id);
                        }
                      }}
                      disabled={rollbackMutation.isPending}
                      className="text-orange-600 focus:text-orange-600"
                      data-testid={`button-rollback-${item.id}`}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Rollback to Edit
                    </DropdownMenuItem>
                  </>
                )}

                {userRole === "ADMIN" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        if (window.confirm("Delete this invoice? This will unbill associated billing elements.")) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 focus:text-red-600"
                      data-testid={`button-delete-invoice-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Invoice
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      />

      <Dialog open={!!validationDialog} onOpenChange={() => { setValidationDialog(null); setValidationComment(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {validationDialog?.action === "APPROVED" ? "Approve Invoice" : "Reject Invoice"}
            </DialogTitle>
            <DialogDescription>
              Invoice: {validationDialog?.invoice?.poNumber || validationDialog?.invoice?.id?.substring(0, 8)}
              {" - "}
              {validationDialog?.invoice?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comment (optional)</Label>
              <Textarea
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
                placeholder="Add a comment..."
                data-testid="input-validation-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidationDialog(null); setValidationComment(""); }}>
              Cancel
            </Button>
            <Button
              variant={validationDialog?.action === "APPROVED" ? "default" : "destructive"}
              onClick={() => {
                if (validationDialog) {
                  validateMutation.mutate({
                    id: validationDialog.invoice.id,
                    action: validationDialog.action,
                    comment: validationComment,
                  });
                }
              }}
              disabled={validateMutation.isPending}
              data-testid="button-confirm-validation"
            >
              {validateMutation.isPending ? "Processing..." : validationDialog?.action === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDialog} onOpenChange={() => setHistoryDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Validation History</DialogTitle>
            <DialogDescription>
              Invoice: {historyDialog?.poNumber || historyDialog?.id?.substring(0, 8)}
              {" - "}{historyDialog?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Current Status:</span>
              {historyDialog && <InvoiceStatusBadge status={historyDialog.status} />}
            </div>
            {validationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-history">No validation history yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {validationHistory.map((v: any) => (
                  <div key={v.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/30" data-testid={`validation-entry-${v.id}`}>
                    <div className="mt-0.5">
                      {v.action === "APPROVED" ? (
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{v.username}</span>
                        <Badge variant="outline" className="text-xs">
                          {v.step}
                        </Badge>
                        <Badge variant={v.action === "APPROVED" ? "default" : "destructive"} className="text-xs">
                          {v.action}
                        </Badge>
                      </div>
                      {v.comment && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                          {v.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
