import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Check,
  X,
  Send,
  Upload,
  Download,
  Star,
  Trash2,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type {
  Requisition,
  ApprovalStep,
  RequisitionQuotation,
  RequisitionAttachment,
  RequisitionComment,
} from "@shared";

const STAGE_ORDER = [
  "Pending Line Manager",
  "Pending Purchasing Review",
  "Pending Budget Owner",
  "Pending Final Approval",
  "Ready for Purchase",
  "PO Created",
] as const;

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Rejected") return "destructive";
  if (status === "PO Created" || status === "Ready for Purchase") return "default";
  return "secondary";
}

function stepIcon(decision: string) {
  if (decision === "approved") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (decision === "rejected") return <X className="h-4 w-4 text-red-600" />;
  return <Loader2 className="h-4 w-4 text-amber-500" />;
}

export default function RequisitionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const basePath = "/intranet/requisitions";

  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [newComment, setNewComment] = useState("");
  const [quotationForm, setQuotationForm] = useState({ vendorName: "", amountAed: "", comments: "", fileData: "", fileName: "", fileType: "", fileSize: 0 });
  const qFileRef = useRef<HTMLInputElement>(null);
  const aFileRef = useRef<HTMLInputElement>(null);

  const { data: req, isLoading: reqLoading } = useQuery<Requisition>({
    queryKey: [`/api/requisitions/${id}`],
  });
  const { data: steps = [] } = useQuery<ApprovalStep[]>({
    queryKey: [`/api/requisitions/${id}/approval-steps`],
  });
  const { data: mySt } = useQuery<ApprovalStep | null>({
    queryKey: [`/api/requisitions/${id}/my-pending-step`],
  });
  const { data: quotations = [] } = useQuery<RequisitionQuotation[]>({
    queryKey: [`/api/requisitions/${id}/quotations`],
  });
  const { data: attachments = [] } = useQuery<RequisitionAttachment[]>({
    queryKey: [`/api/requisitions/${id}/attachments`],
  });
  const { data: chat = [] } = useQuery<RequisitionComment[]>({
    queryKey: [`/api/requisitions/${id}/comments`],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/approval-steps`] });
    queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/my-pending-step`] });
    queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/comments`] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/requisitions"] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!mySt) throw new Error("No pending step");
      const res = await apiRequest("POST", `/api/approval-steps/${mySt.id}/approve`, { comments });
      return await res.json();
    },
    onSuccess: () => {
      setApproveOpen(false);
      setComments("");
      invalidate();
      toast({ title: "Approved" });
    },
    onError: (err: Error) => toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!mySt) throw new Error("No pending step");
      if (!comments.trim()) throw new Error("Rejection reason required");
      const res = await apiRequest("POST", `/api/approval-steps/${mySt.id}/reject`, { comments });
      return await res.json();
    },
    onSuccess: () => {
      setRejectOpen(false);
      setComments("");
      invalidate();
      toast({ title: "Rejected" });
    },
    onError: (err: Error) => toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!newComment.trim()) throw new Error("Empty comment");
      const res = await apiRequest("POST", `/api/requisitions/${id}/comments`, { body: newComment.trim() });
      return await res.json();
    },
    onSuccess: () => {
      setNewComment("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const addQuotationMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        vendorName: quotationForm.vendorName,
        amountAed: quotationForm.amountAed,
        comments: quotationForm.comments || undefined,
        fileName: quotationForm.fileName || undefined,
        fileType: quotationForm.fileType || undefined,
        fileSize: quotationForm.fileSize || undefined,
        fileData: quotationForm.fileData || undefined,
      };
      const res = await apiRequest("POST", `/api/requisitions/${id}/quotations`, payload);
      return await res.json();
    },
    onSuccess: () => {
      setQuotationForm({ vendorName: "", amountAed: "", comments: "", fileData: "", fileName: "", fileType: "", fileSize: 0 });
      queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/quotations`] });
      toast({ title: "Quotation added" });
    },
    onError: (err: Error) => toast({ title: "Add failed", description: err.message, variant: "destructive" }),
  });

  const recommendMutation = useMutation({
    mutationFn: async (qid: string) => {
      const res = await apiRequest("PATCH", `/api/quotations/${qid}/recommend`);
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/quotations`] }),
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: async (qid: string) => {
      await apiRequest("DELETE", `/api/quotations/${qid}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/quotations`] }),
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const b64 = await readAsBase64(file);
      const res = await apiRequest("POST", `/api/requisitions/${id}/attachments`, {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: b64,
      });
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/attachments`] }),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (aid: string) => {
      await apiRequest("DELETE", `/api/attachments/${aid}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/requisitions/${id}/attachments`] }),
  });

  const markPOMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/requisitions/${id}/mark-po-created`);
      return await res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "PO Created" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (reqLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="text-lg font-semibold mb-2">Requisition not found</h2>
            <Button asChild variant="outline">
              <Link href={basePath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showQuotationsEditor = req.status === "Pending Purchasing Review";

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <Button asChild variant="ghost" size="sm" data-testid="button-back">
          <Link href={basePath}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle data-testid="text-req-title">{req.requestTitle}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{req.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant(req.status)} data-testid="badge-status">{req.status}</Badge>
              {isAdmin && req.status === "Ready for Purchase" && (
                <Button
                  size="sm"
                  onClick={() => markPOMutation.mutate()}
                  disabled={markPOMutation.isPending}
                  data-testid="button-mark-po"
                >
                  {markPOMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Mark PO Created
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Department</div>
            <div>{req.department}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Requested By</div>
            <div>{req.requestedBy}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-medium">AED {Number(req.estimatedCostAed).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Date of Request</div>
            <div>{req.dateOfRequest}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Required By</div>
            <div>{req.requiredByDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Budget Owner</div>
            <div>{req.budgetOwnerName || "—"}</div>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground">Description</div>
            <div className="whitespace-pre-wrap">{req.description}</div>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground">Justification</div>
            <div className="whitespace-pre-wrap">{req.justification}</div>
          </div>
        </CardContent>
      </Card>

      {/* Approval stepper */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Approval Progress</CardTitle></CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          ) : (
            <ul className="space-y-3">
              {steps.map((s) => (
                <li key={s.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5">{stepIcon(s.decision)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.stage}</span>
                      <Badge variant="outline" className="text-[10px]">{s.decision}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.assignedToName || s.assignedToGroup || "Unassigned"}
                      {s.decidedAt ? ` · decided ${new Date(s.decidedAt).toLocaleString()}` : ""}
                    </div>
                    {s.comments && <div className="text-xs mt-1 italic">"{s.comments}"</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {mySt && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => setApproveOpen(true)}
                data-testid="button-approve"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                data-testid="button-reject"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotations */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Quotations ({quotations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">No quotations added yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {quotations.map((q) => (
                <li key={q.id} className="flex items-center justify-between border rounded-md p-3 text-sm" data-testid={`row-quotation-${q.id}`}>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {q.vendorName}
                      {q.isRecommended && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      AED {Number(q.amountAed).toLocaleString()} {q.comments ? `· ${q.comments}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {q.fileName && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title="Download"
                      >
                        <a href={`/api/quotations/${q.id}/download`}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {showQuotationsEditor && !q.isRecommended && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => recommendMutation.mutate(q.id)}
                        title="Mark recommended"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    {showQuotationsEditor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteQuotationMutation.mutate(q.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showQuotationsEditor && (
            <div className="space-y-2 border-t pt-3">
              <div className="font-medium text-sm">Add Quotation</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder="Vendor name"
                  value={quotationForm.vendorName}
                  onChange={(e) => setQuotationForm({ ...quotationForm, vendorName: e.target.value })}
                  data-testid="input-quote-vendor"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (AED)"
                  value={quotationForm.amountAed}
                  onChange={(e) => setQuotationForm({ ...quotationForm, amountAed: e.target.value })}
                  data-testid="input-quote-amount"
                />
              </div>
              <Textarea
                placeholder="Comments (optional)"
                rows={2}
                value={quotationForm.comments}
                onChange={(e) => setQuotationForm({ ...quotationForm, comments: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={qFileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const b64 = await readAsBase64(file);
                    setQuotationForm((prev) => ({
                      ...prev,
                      fileName: file.name,
                      fileType: file.type,
                      fileSize: file.size,
                      fileData: b64,
                    }));
                  }}
                />
                <Button type="button" variant="outline" onClick={() => qFileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  {quotationForm.fileName ? quotationForm.fileName : "Attach file (optional)"}
                </Button>
                <Button
                  onClick={() => addQuotationMutation.mutate()}
                  disabled={!quotationForm.vendorName || !quotationForm.amountAed || addQuotationMutation.isPending}
                  data-testid="button-add-quotation"
                >
                  {addQuotationMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Add
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Attachments ({attachments.length})</CardTitle></CardHeader>
        <CardContent>
          <input
            ref={aFileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadAttachmentMutation.mutate(file);
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => aFileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Add attachment
          </Button>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">No attachments.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {a.filename}
                    <span className="text-xs text-muted-foreground">
                      ({(a.fileSize / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="icon">
                      <a href={`/api/attachments/${a.id}/download`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {(isAdmin || req.userId === user?.id) && (
                      <Button variant="ghost" size="icon" onClick={() => deleteAttachmentMutation.mutate(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader><CardTitle className="text-base">Activity & Comments</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {chat.length === 0 ? (
              <li className="text-sm text-muted-foreground">No comments yet.</li>
            ) : (
              chat.map((c) => (
                <li key={c.id} className="border-l-2 border-muted pl-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.authorName}</span>
                    {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString()}` : ""}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </li>
              ))
            )}
          </ul>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              data-testid="input-comment"
            />
            <Button
              onClick={() => addCommentMutation.mutate()}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              data-testid="button-send-comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve step</DialogTitle>
            <DialogDescription>Add an optional comment before approving.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="ac">Comments (optional)</Label>
          <Textarea id="ac" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject requisition</DialogTitle>
            <DialogDescription>A reason is required. All other pending steps will be cancelled.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="rc">Reason *</Label>
          <Textarea id="rc" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={!comments.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
