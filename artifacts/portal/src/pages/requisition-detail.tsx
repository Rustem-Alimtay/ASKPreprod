import { OtherModulesSection } from "@/components/other-modules-section";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Download, FileText, Image, Calendar, User, Building2, DollarSign, Pencil, X, Send, MessageSquare, CheckCircle2, XCircle, Clock, ArrowRight, Upload, Loader2, Star, Trash2, Plus, ShoppingCart } from "lucide-react";
import type { Requisition, RequisitionAttachment, RequisitionComment, ApprovalStep, RequisitionQuotation } from "@shared";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef } from "react";

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

function formatCost(cost: number) {
  return new Intl.NumberFormat("en-AE", { style: "decimal", minimumFractionDigits: 2 }).format(cost / 100);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RequisitionDetailPage() {
  const [location, navigate] = useLocation();
  const [, erpParams] = useRoute("/erp/procurement/requisitions/:id");
  const [, intranetParams] = useRoute("/intranet/requisitions/:id");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const params = erpParams || intranetParams;
  const id = params?.id;
  const isIntranet = location.startsWith("/intranet");
  const listPath = isIntranet ? "/intranet/requisitions" : "/erp/procurement/requisitions";

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    vendorName: "",
    estimatedCostAed: 0,
    budgetLineAccountCode: "",
    isBudgeted: false,
    requiredByDate: "",
    projectStartDate: "",
  });
  const [commentBody, setCommentBody] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quotationFileInputRef = useRef<HTMLInputElement>(null);
  const [quotationForm, setQuotationForm] = useState({
    vendorName: "",
    amountAed: "",
    isRecommended: false,
    comments: "",
  });
  const [amountTouched, setAmountTouched] = useState(false);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [showQuotationForm, setShowQuotationForm] = useState(false);

  const { data: requisition, isLoading } = useQuery<Requisition>({
    queryKey: ["/api/requisitions", id],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}`, { credentials: "include" });
      if (!r.ok) {
        throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      }
      return r.json();
    },
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery<RequisitionAttachment[]>({
    queryKey: ["/api/requisitions", id, "attachments"],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}/attachments`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      return r.json();
    },
    enabled: !!id,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<RequisitionComment[]>({
    queryKey: ["/api/requisitions", id, "comments"],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}/comments`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      return r.json();
    },
    enabled: !!id,
  });

  const { data: approvalSteps = [] } = useQuery<ApprovalStep[]>({
    queryKey: ["/api/requisitions", id, "approval-steps"],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}/approval-steps`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      return r.json();
    },
    enabled: !!id,
  });

  const { data: myPendingStep } = useQuery<ApprovalStep | null>({
    queryKey: ["/api/requisitions", id, "my-pending-step"],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}/my-pending-step`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      return r.json();
    },
    enabled: !!id,
  });

  const { data: quotations = [] } = useQuery<RequisitionQuotation[]>({
    queryKey: ["/api/requisitions", id, "quotations"],
    queryFn: async () => {
      const r = await fetch(`/api/requisitions/${id}/quotations`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
      return r.json();
    },
    enabled: !!id,
  });

  const currentUserPendingStep = myPendingStep || undefined;
  const currentStep = currentUserPendingStep;
  const isCurrentApprover = !!currentUserPendingStep;

  const updateDetailsMutation = useMutation({
    mutationFn: async (data: typeof editFields) => {
      await apiRequest("PATCH", `/api/requisitions/${id}`, {
        vendorName: data.vendorName || null,
        estimatedCostAed: data.estimatedCostAed,
        budgetLineAccountCode: data.budgetLineAccountCode || null,
        isBudgeted: data.isBudgeted,
        requiredByDate: data.requiredByDate,
        projectStartDate: data.projectStartDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id] });
      setIsEditing(false);
      toast({ title: "Details updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update details", variant: "destructive" });
    },
  });

  const postCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      await apiRequest("POST", `/api/requisitions/${id}/comments`, { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "comments"] });
      setCommentBody("");
      toast({ title: "Comment posted" });
    },
    onError: () => {
      toast({ title: "Failed to post comment", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (comments: string) => {
      if (!currentUserPendingStep) throw new Error("No pending step");
      await apiRequest("POST", `/api/approval-steps/${currentUserPendingStep.id}/approve`, { comments: comments || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "approval-steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "my-pending-step"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-approvals"] });
      setApprovalComment("");
      toast({ title: "Approved", description: "The requisition has been approved and moved to the next stage." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (comments: string) => {
      if (!currentUserPendingStep) throw new Error("No pending step");
      await apiRequest("POST", `/api/approval-steps/${currentUserPendingStep.id}/reject`, { comments: comments || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "approval-steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "my-pending-step"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-approvals"] });
      setApprovalComment("");
      toast({ title: "Rejected", description: "The requisition has been rejected." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reject", description: err.message, variant: "destructive" });
    },
  });

  const markPOMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/requisitions/${id}/mark-po-created`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "approval-steps"] });
      toast({ title: "PO Created", description: "The requisition has been marked as PO Created." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to mark PO created", description: err.message, variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const fileData = await toBase64(file);
        await apiRequest("POST", `/api/requisitions/${id}/attachments`, {
          requisitionId: id,
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "attachments"] });
      toast({ title: "Files uploaded" });
    },
    onError: () => {
      toast({ title: "Failed to upload files", variant: "destructive" });
    },
  });

  const addQuotationMutation = useMutation({
    mutationFn: async () => {
      let fileData = null;
      let fileName = null;
      let fileType = null;
      let fileSize = null;
      if (quotationFile) {
        fileData = await toBase64(quotationFile);
        fileName = quotationFile.name;
        fileType = quotationFile.type;
        fileSize = quotationFile.size;
      }
      await apiRequest("POST", `/api/requisitions/${id}/quotations`, {
        vendorName: quotationForm.vendorName,
        amountAed: quotationForm.amountAed,
        isRecommended: quotationForm.isRecommended,
        comments: quotationForm.comments || null,
        fileName,
        fileType,
        fileSize,
        fileData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "quotations"] });
      setQuotationForm({ vendorName: "", amountAed: "", isRecommended: false, comments: "" });
      setAmountTouched(false);
      setQuotationFile(null);
      setShowQuotationForm(false);
      toast({ title: "Quotation added" });
    },
    onError: () => {
      toast({ title: "Failed to add quotation", variant: "destructive" });
    },
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      await apiRequest("DELETE", `/api/quotations/${quotationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "quotations"] });
      toast({ title: "Quotation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete quotation", variant: "destructive" });
    },
  });

  const recommendQuotationMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      await apiRequest("PATCH", `/api/quotations/${quotationId}/recommend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions", id, "quotations"] });
      toast({ title: "Quotation marked as recommended" });
    },
    onError: () => {
      toast({ title: "Failed to update quotation", variant: "destructive" });
    },
  });

  function startEditing() {
    if (!requisition) return;
    setEditFields({
      vendorName: requisition.vendorName || "",
      estimatedCostAed: requisition.estimatedCostAed,
      budgetLineAccountCode: requisition.budgetLineAccountCode || "",
      isBudgeted: requisition.isBudgeted,
      requiredByDate: requisition.requiredByDate,
      projectStartDate: requisition.projectStartDate || "",
    });
    setIsEditing(true);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f =>
      ["image/jpeg", "image/png", "application/pdf"].includes(f.type)
    );
    if (valid.length > 0) {
      uploadAttachmentMutation.mutate(valid);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Requisition not found</p>
        <Button variant="outline" onClick={() => navigate(listPath)} className="mt-4">Back to List</Button>
      </div>
    );
  }

  const canEdit = isAdmin || isCurrentApprover;
  const isPurchasingStage = requisition.status === "Pending Purchasing Review";

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(listPath)} data-testid="button-back-list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-outfit" data-testid="text-detail-title">{requisition.requestTitle}</h1>
            <p className="text-sm text-muted-foreground font-mono">ID: {requisition.id?.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusBadgeClass(requisition.status)} data-testid="badge-detail-status">{requisition.status}</Badge>
          {isAdmin && requisition.status === "Ready for Purchase" && (
            <Button
              size="sm"
              onClick={() => markPOMutation.mutate()}
              disabled={markPOMutation.isPending}
              data-testid="button-mark-po-created"
            >
              {markPOMutation.isPending ? "Processing..." : "Mark PO Created"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-sm font-medium">{requisition.date}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="text-sm font-medium">{requisition.department}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Requested By</p>
              <p className="text-sm font-medium">{requisition.requestedBy}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Est. Cost (AED)</p>
              <p className="text-sm font-medium">{formatCost(requisition.estimatedCostAed)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isCurrentApprover && currentStep && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Action Required — {currentStep.stage}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isPurchasingStage
                ? "Review the requisition, contact vendors, attach quotations, and add your comments before forwarding to the Budget Owner."
                : "Review the requisition details below and approve or reject this request."}
            </p>
            <div className="space-y-2">
              <Label htmlFor="approval-comment">Comments <span className="text-destructive">*</span></Label>
              <Textarea
                id="approval-comment"
                placeholder="Add your comments (required)..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={3}
                data-testid="textarea-approval-comment"
              />
              {!approvalComment.trim() && (
                <p className="text-xs text-muted-foreground">A comment is required before you can approve or reject.</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => approveMutation.mutate(approvalComment)}
                disabled={approveMutation.isPending || rejectMutation.isPending || !approvalComment.trim()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-approve"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {isPurchasingStage ? "Forward to Budget Owner" : "Approve"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate(approvalComment)}
                disabled={approveMutation.isPending || rejectMutation.isPending || !approvalComment.trim()}
                data-testid="button-reject"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {((isPurchasingStage && isCurrentApprover) || quotations.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Vendor Quotations {quotations.length > 0 && `(${quotations.length})`}
              </CardTitle>
              {isPurchasingStage && isCurrentApprover && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuotationForm(!showQuotationForm)}
                  data-testid="button-add-quotation"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Quotation
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showQuotationForm && isPurchasingStage && isCurrentApprover && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20" data-testid="form-add-quotation">
                <div className="space-y-2">
                  <Label htmlFor="quotation-vendor">Vendor Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="quotation-vendor"
                    placeholder="Enter vendor name"
                    value={quotationForm.vendorName}
                    onChange={(e) => setQuotationForm({ ...quotationForm, vendorName: e.target.value })}
                    data-testid="input-quotation-vendor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotation-amount">Amount (AED) <span className="text-destructive">*</span></Label>
                  <Input
                    id="quotation-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount in AED"
                    value={quotationForm.amountAed}
                    onChange={(e) => setQuotationForm({ ...quotationForm, amountAed: e.target.value })}
                    onBlur={() => setAmountTouched(true)}
                    data-testid="input-quotation-amount"
                  />
                  {amountTouched && quotationForm.amountAed === "" && (
                    <p className="text-xs text-destructive" data-testid="error-quotation-amount">Amount (AED) is required</p>
                  )}
                  {quotationForm.amountAed !== "" && !(parseFloat(quotationForm.amountAed) > 0) && (
                    <p className="text-xs text-destructive" data-testid="error-quotation-amount">Amount must be a positive number</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Quotation File</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => quotationFileInputRef.current?.click()}
                      data-testid="button-upload-quotation-file"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {quotationFile ? quotationFile.name : "Choose File"}
                    </Button>
                    {quotationFile && (
                      <Button variant="ghost" size="sm" onClick={() => setQuotationFile(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <input
                      ref={quotationFileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setQuotationFile(file);
                        if (quotationFileInputRef.current) quotationFileInputRef.current.value = "";
                      }}
                      data-testid="input-quotation-file"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotation-comments">Comments</Label>
                  <Textarea
                    id="quotation-comments"
                    placeholder="Add comments about this quotation..."
                    value={quotationForm.comments}
                    onChange={(e) => setQuotationForm({ ...quotationForm, comments: e.target.value })}
                    rows={2}
                    data-testid="textarea-quotation-comments"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="quotation-recommended"
                    checked={quotationForm.isRecommended}
                    onCheckedChange={(checked) => setQuotationForm({ ...quotationForm, isRecommended: checked })}
                    data-testid="switch-quotation-recommended"
                  />
                  <Label htmlFor="quotation-recommended">Mark as Recommended</Label>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => addQuotationMutation.mutate()}
                    disabled={!quotationForm.vendorName.trim() || !quotationForm.amountAed || !(parseFloat(quotationForm.amountAed) > 0) || addQuotationMutation.isPending}
                    data-testid="button-submit-quotation"
                  >
                    {addQuotationMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {addQuotationMutation.isPending ? "Adding..." : "Add Quotation"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowQuotationForm(false)} data-testid="button-cancel-quotation">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {quotations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-quotations">No quotations added yet</p>
            ) : (
              <div className="space-y-2">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${q.isRecommended ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20" : "bg-muted/30"}`}
                    data-testid={`quotation-${q.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`quotation-vendor-${q.id}`}>{q.vendorName}</span>
                        {q.amountAed != null && (
                          <span className="text-sm font-semibold text-primary" data-testid={`quotation-amount-${q.id}`}>
                            AED {Number(q.amountAed).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {q.isRecommended && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" data-testid={`badge-recommended-${q.id}`}>
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      {q.comments && (
                        <p className="text-sm text-muted-foreground mt-1" data-testid={`quotation-comments-${q.id}`}>{q.comments}</p>
                      )}
                      {q.fileName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          File: {q.fileName} {q.fileSize ? `(${formatFileSize(q.fileSize)})` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {q.fileData && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/quotations/${q.id}/download`, "_blank")}
                          data-testid={`button-download-quotation-${q.id}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isPurchasingStage && isCurrentApprover && (
                        <>
                          {!q.isRecommended && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => recommendQuotationMutation.mutate(q.id)}
                              disabled={recommendQuotationMutation.isPending}
                              data-testid={`button-recommend-${q.id}`}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteQuotationMutation.mutate(q.id)}
                            disabled={deleteQuotationMutation.isPending}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-quotation-${q.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {approvalSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Approval Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {approvalSteps.map((step, idx) => {
                const isLast = idx === approvalSteps.length - 1;
                let icon;
                let iconColor;
                if (step.decision === "approved") {
                  icon = <CheckCircle2 className="h-5 w-5" />;
                  iconColor = "text-green-600";
                } else if (step.decision === "rejected") {
                  icon = <XCircle className="h-5 w-5" />;
                  iconColor = "text-red-600";
                } else {
                  icon = <Clock className="h-5 w-5" />;
                  iconColor = "text-amber-500";
                }

                return (
                  <div key={step.id} className="flex gap-4" data-testid={`approval-step-${step.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`${iconColor} flex-shrink-0`}>{icon}</div>
                      {!isLast && <div className="w-px flex-1 bg-border my-1" />}
                    </div>
                    <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{step.stage}</span>
                        <Badge
                          className={
                            step.decision === "approved"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                              : step.decision === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0"
                          }
                        >
                          {step.decision === "pending" ? "Pending" : step.decision === "approved" ? "Approved" : "Rejected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assigned to: {step.assignedToName || "Unassigned"}
                      </p>
                      {step.decidedAt && (
                        <p className="text-xs text-muted-foreground">
                          Decided: {formatDateTime(String(step.decidedAt))}
                        </p>
                      )}
                      {step.comments && (
                        <p className="text-sm mt-1 text-muted-foreground italic">"{step.comments}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Request Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="text-sm">{requisition.position || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date of Request</p>
              <p className="text-sm">{requisition.dateOfRequest}</p>
            </div>
          </div>
          {requisition.budgetOwnerName && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Budget Owner</p>
                <p className="text-sm" data-testid="text-budget-owner">{requisition.budgetOwnerName}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Description of Request</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{requisition.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Justification / Business Need</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{requisition.justification}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Budget Details</CardTitle>
            {canEdit && !isEditing && (
              <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-details">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Details
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-estimated-cost">Estimated Cost (AED) — in fils</Label>
                  <Input
                    id="edit-estimated-cost"
                    type="number"
                    value={editFields.estimatedCostAed}
                    onChange={(e) => setEditFields({ ...editFields, estimatedCostAed: parseInt(e.target.value) || 0 })}
                    data-testid="input-edit-estimated-cost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-budget-line">Budget Line / Account Code</Label>
                  <Input
                    id="edit-budget-line"
                    value={editFields.budgetLineAccountCode}
                    onChange={(e) => setEditFields({ ...editFields, budgetLineAccountCode: e.target.value })}
                    data-testid="input-edit-budget-line"
                  />
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Switch
                    id="edit-is-budgeted"
                    checked={editFields.isBudgeted}
                    onCheckedChange={(checked) => setEditFields({ ...editFields, isBudgeted: checked })}
                    data-testid="switch-edit-is-budgeted"
                  />
                  <Label htmlFor="edit-is-budgeted">Is this budgeted?</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor-name">Vendor Name</Label>
                  <Input
                    id="edit-vendor-name"
                    value={editFields.vendorName}
                    onChange={(e) => setEditFields({ ...editFields, vendorName: e.target.value })}
                    data-testid="input-edit-vendor-name"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-medium mb-3">Timeline</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-required-by">Required By Date</Label>
                    <Input
                      id="edit-required-by"
                      type="date"
                      value={editFields.requiredByDate}
                      onChange={(e) => setEditFields({ ...editFields, requiredByDate: e.target.value })}
                      data-testid="input-edit-required-by"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-project-start">Project / Activity Start Date</Label>
                    <Input
                      id="edit-project-start"
                      type="date"
                      value={editFields.projectStartDate}
                      onChange={(e) => setEditFields({ ...editFields, projectStartDate: e.target.value })}
                      data-testid="input-edit-project-start"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => updateDetailsMutation.mutate(editFields)}
                  disabled={updateDetailsMutation.isPending}
                  data-testid="button-save-details"
                >
                  {updateDetailsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  data-testid="button-cancel-edit"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Cost (AED)</p>
                <p className="text-sm font-medium">{formatCost(requisition.estimatedCostAed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Budget Line / Account Code</p>
                <p className="text-sm">{requisition.budgetLineAccountCode || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Is this budgeted?</p>
                <Badge className={requisition.isBudgeted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"}>
                  {requisition.isBudgeted ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendor Name</p>
                <p className="text-sm">{requisition.vendorName || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isEditing && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Required By Date</p>
                <p className="text-sm font-medium">{requisition.requiredByDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project / Activity Start Date</p>
                <p className="text-sm">{requisition.projectStartDate || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Supporting Documents ({attachments.length})</CardTitle>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAttachmentMutation.isPending}
                  data-testid="button-upload-attachment"
                >
                  {uploadAttachmentMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload-detail"
                />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents attached</p>
          ) : (
            attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30" data-testid={`attachment-${att.id}`}>
                {att.fileType === "application/pdf" ? (
                  <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                ) : (
                  <Image className="h-5 w-5 text-blue-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/requisition-attachments/${att.id}/download`, "_blank")}
                  data-testid={`button-download-${att.id}`}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments {comments.length > 0 && `(${comments.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-comments">No comments yet</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg border bg-muted/20" data-testid={`comment-${comment.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium" data-testid={`comment-author-${comment.id}`}>{comment.authorName}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`comment-time-${comment.id}`}>
                      {comment.createdAt ? formatRelativeTime(String(comment.createdAt)) : ""}
                    </p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" data-testid={`comment-body-${comment.id}`}>{comment.body}</p>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="border-t pt-4 space-y-2">
              <Textarea
                placeholder="Write a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                data-testid="textarea-comment"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    if (commentBody.trim()) {
                      postCommentMutation.mutate(commentBody.trim());
                    }
                  }}
                  disabled={!commentBody.trim() || postCommentMutation.isPending}
                  data-testid="button-post-comment"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {postCommentMutation.isPending ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OtherModulesSection />
    </div>
  );
}
