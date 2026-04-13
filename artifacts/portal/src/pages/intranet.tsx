import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Headphones,
  Plus,
  Loader2,
  Monitor,
  Cpu,
  Zap,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Send,
  MessageSquare,
  Search,
  RefreshCw,
  ShieldAlert,
  HelpCircle,
  Filter,
  BarChart3,
  Settings,
  Wifi,
  Mail,
  Printer,
  Wrench,
  Globe,
  FileText,
  Database,
  TrendingUp,
  TrendingDown,
  Timer,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Paperclip,
  Download,
  Trash2,
  File,
  Image,
  CircleDot,
  Pencil,
  X,
  Save
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Ticket as TicketType, TicketComment, TicketAttachment, Requisition } from "@shared";
import { format, formatDistanceToNow } from "date-fns";
import { statusConfig, severityConfig, categoryConfig } from "@/lib/ticket-config";
import { useDebounce } from "@/hooks/use-debounce";

const itSubcategoryLabels: Record<string, { label: string; icon: any }> = {
  pc_setup: { label: "PC Setup & Configuration", icon: Monitor },
  software_install: { label: "Software Installation", icon: Settings },
  software_remove: { label: "Software Removal", icon: Settings },
  access_permissions: { label: "Access & Permissions", icon: ShieldAlert },
  equipment_request: { label: "Equipment Request", icon: Cpu },
  network_issue: { label: "Network Issue", icon: Wifi },
  email_issue: { label: "Email Issue", icon: Mail },
  printer_issue: { label: "Printer Issue", icon: Printer },
  hardware_repair: { label: "Hardware Repair", icon: Wrench },
  vpn_access: { label: "VPN Access", icon: Globe },
  general_it: { label: "General IT", icon: HelpCircle },
};

const dtSubcategoryLabels: Record<string, { label: string; icon: any }> = {
  process_automation: { label: "Process Automation", icon: Zap },
  new_system: { label: "New System Request", icon: Database },
  system_integration: { label: "System Integration", icon: Settings },
  reporting_analytics: { label: "Reporting & Analytics", icon: BarChart3 },
  ux_improvement: { label: "UX Improvement", icon: TrendingUp },
  workflow_optimization: { label: "Workflow Optimization", icon: RefreshCw },
  data_migration: { label: "Data Migration", icon: Database },
  api_development: { label: "API Development", icon: Globe },
  general_dt: { label: "General DT", icon: HelpCircle },
};

function getSubcategoryLabel(category: string, subcategory: string | null): string {
  if (!subcategory) return "";
  if (category === "it_support") return itSubcategoryLabels[subcategory]?.label || subcategory;
  if (category === "digital_transformation") return dtSubcategoryLabels[subcategory]?.label || subcategory;
  return subcategory;
}

type DepartmentLoad = {
  total: number;
  open: number;
  resolved: number;
};

type TicketStats = {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  itSupport: number;
  digitalTransformation: number;
  critical: number;
  byStatus: Record<string, number>;
  avgCloseTimeHours?: number;
  avgCloseTimeDays?: number;
  byDepartmentLoad?: {
    it_support: DepartmentLoad;
    digital_transformation: DepartmentLoad;
  };
  slaBreaches?: number;
  overdueTickets?: string[];
};

export default function IntranetPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [newComment, setNewComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("it_support");
  const [subcategory, setSubcategory] = useState("");
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<{ file: globalThis.File; preview?: string }[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newTicket = params.get("newTicket");
    if (newTicket === "it_support" || newTicket === "digital_transformation") {
      setCategory(newTicket);
      setSubcategory("");
      setDialogOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: stats } = useQuery<TicketStats>({
    queryKey: ["/api/tickets/stats"],
  });

  const effectiveCategory = activeTab === "all" ? (categoryFilter !== "all" ? categoryFilter : undefined) : activeTab;

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketType[]; total: number }>({
    queryKey: ["/api/admin/tickets", statusFilter, effectiveCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (effectiveCategory) params.set("category", effectiveCategory);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/tickets?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "comments"],
    enabled: !!selectedTicket,
  });

  const { data: ticketAttachments = [], isLoading: attachmentsLoading } = useQuery<Omit<TicketAttachment, "fileData">[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "attachments"],
    enabled: !!selectedTicket,
  });

  const { data: usersList = [] } = useQuery<{ id: string; username: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/users/list"],
  });

  const { data: requisitions = [], isLoading: requisitionsLoading } = useQuery<Requisition[]>({
    queryKey: ["/api/requisitions"],
    queryFn: async () => {
      const res = await fetch("/api/requisitions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requisitions");
      return res.json();
    },
  });

  type CreateTicketResult = { ticket: TicketType; attachmentsFailed: boolean };

  const createTicketMutation = useMutation<CreateTicketResult, Error, { subject: string; description: string; severity: string; category: string; subcategory?: string }>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/tickets", data);
      const ticket: TicketType = await res.json();
      let attachmentsFailed = false;
      if (pendingFiles.length > 0) {
        const fileDataPromises = pendingFiles.map(({ file }) => {
          return new Promise<{ filename: string; fileType: string; fileSize: number; fileData: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ filename: file.name, fileType: file.type, fileSize: file.size, fileData: reader.result as string });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });
        const attachments = await Promise.all(fileDataPromises);
        try {
          await apiRequest("POST", `/api/tickets/${ticket.id}/attachments`, { attachments });
        } catch {
          attachmentsFailed = true;
        }
      }
      return { ticket, attachmentsFailed };
    },
    onSuccess: ({ attachmentsFailed }) => {
      if (attachmentsFailed) {
        toast({ title: "Ticket Created", description: "Ticket submitted but some attachments failed to upload. You can try adding them later.", variant: "destructive" });
      } else {
        toast({ title: "Ticket Created", description: "Your support ticket has been submitted successfully." });
      }
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string; assignedTo?: string; assignedToName?: string; severity?: string; category?: string; subject?: string; description?: string } }) => {
      return apiRequest("PATCH", `/api/admin/tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
      if (selectedTicket) {
        queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicket.id] });
      }
      toast({ title: "Ticket updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/tickets/${selectedTicket?.id}/comments`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicket?.id, "comments"] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add comment", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCategory("it_support");
    setSubcategory("");
    setPendingFiles([]);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024;
    const newFiles: { file: globalThis.File; preview?: string }[] = [];
    for (const file of files) {
      if (file.size > maxSize) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit`, variant: "destructive" });
        continue;
      }
      const entry: { file: globalThis.File; preview?: string } = { file };
      if (file.type.startsWith("image/")) {
        entry.preview = URL.createObjectURL(file);
      }
      newFiles.push(entry);
    }
    setPendingFiles(prev => [...prev, ...newFiles].slice(0, 5));
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles(prev => {
      const updated = [...prev];
      if (updated[index]?.preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      return updated;
    });
  }

  function handleSubmitTicket() {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Missing information", description: "Please fill in subject and description", variant: "destructive" });
      return;
    }
    createTicketMutation.mutate({
      subject,
      description,
      severity: priority,
      category,
      subcategory: subcategory || undefined,
    });
  }

  function handleStatusChange(ticketId: string, newStatus: string) {
    updateTicketMutation.mutate({ id: ticketId, data: { status: newStatus } });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
  }

  function handleAssign(ticketId: string, userId: string) {
    const user = usersList.find(u => u.id === userId);
    const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : "";
    updateTicketMutation.mutate({ id: ticketId, data: { assignedTo: userId, assignedToName: name } });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, assignedTo: userId, assignedToName: name });
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  }

  const debouncedSearch = useDebounce(searchQuery, 300);
  const allTickets = ticketsData?.tickets || [];
  const filteredTickets = debouncedSearch
    ? allTickets.filter(t =>
        t.subject.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.trackingId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.userEmail.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : allTickets;

  const filteredRequisitions = activeTab === "all"
    ? (debouncedSearch
        ? requisitions.filter(r =>
            r.requestTitle.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            r.id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (r.requestedBy || "").toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : requisitions)
    : [];

  const allItems = [...filteredTickets, ...(activeTab === "all" ? filteredRequisitions : [])];
  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = allItems.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);
  const paginatedTickets = paginatedItems.filter(item => 'trackingId' in item) as typeof filteredTickets;
  const paginatedRequisitions = paginatedItems.filter(item => 'requestTitle' in item) as typeof filteredRequisitions;

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, categoryFilter, activeTab]);

  if (selectedTicket) {
    const status = statusConfig[selectedTicket.status] || statusConfig.new;
    const severity = severityConfig[selectedTicket.severity] || severityConfig.low;
    const catConfig = categoryConfig[selectedTicket.category] || categoryConfig.other;

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTicket(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold font-outfit">{selectedTicket.trackingId}</h1>
              <Badge className={`${status.bgColor} ${status.color} border-0`}>{status.label}</Badge>
              <Badge variant={severity.variant}>{severity.label}</Badge>
              <Badge className={`${catConfig.bgColor} ${catConfig.color} border-0`}>
                {catConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{selectedTicket.subject}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ticket Details</CardTitle>
                {!isAdmin && selectedTicket.userId === user?.id && selectedTicket.status === "new" && !isEditingTicket && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingTicket(true);
                      setEditSubject(selectedTicket.subject);
                      setEditDescription(selectedTicket.description);
                    }}
                    data-testid="button-edit-ticket"
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingTicket ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      data-testid="input-edit-subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      data-testid="input-edit-description"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateTicketMutation.mutate({
                          id: selectedTicket.id,
                          data: { subject: editSubject, description: editDescription },
                        });
                        setSelectedTicket({ ...selectedTicket, subject: editSubject, description: editDescription });
                        setIsEditingTicket(false);
                      }}
                      disabled={updateTicketMutation.isPending || !editSubject.trim() || !editDescription.trim()}
                      data-testid="button-save-edit"
                    >
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTicket(false)}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Subcategory</Label>
                  <p className="mt-1 text-sm">{getSubcategoryLabel(selectedTicket.category, selectedTicket.subcategory) || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Submitted By</Label>
                  <p className="mt-1 text-sm">{selectedTicket.userName || selectedTicket.userEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="mt-1 text-sm">
                    {selectedTicket.createdAt
                      ? format(new Date(selectedTicket.createdAt), "PPp")
                      : "Unknown"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Attachments ({ticketAttachments.length})</h3>
                </div>
                {attachmentsLoading ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : ticketAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No attachments</p>
                ) : (
                  <div className="space-y-2">
                    {ticketAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between rounded-lg border p-2" data-testid={`attachment-${att.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {att.fileType.startsWith("image/") ? (
                            <Image className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : (
                            <File className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{att.filename}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => window.open(`/api/ticket-attachments/${att.id}/download`, "_blank")}
                          data-testid={`button-download-attachment-${att.id}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Comments ({comments.length})</h3>
                </div>

                {commentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground text-sm">No comments yet</p>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`rounded-lg p-3 ${comment.isAdmin ? "bg-primary/10 border border-primary/20" : "bg-muted"}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {comment.userName || comment.userEmail}
                              {comment.isAdmin && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">Admin</Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ""}
                            </span>
                          </div>
                          <p className="text-sm">{comment.message}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {selectedTicket.status !== "closed" && (
                  <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      data-testid="input-ticket-comment"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={addCommentMutation.isPending || !newComment.trim()}
                      data-testid="button-send-comment"
                    >
                      {addCommentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(v) => handleStatusChange(selectedTicket.id, v)}
                    disabled={updateTicketMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-update-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Assigned To</Label>
                  <Select
                    value={selectedTicket.assignedTo || "unassigned"}
                    onValueChange={(v) => handleAssign(selectedTicket.id, v === "unassigned" ? "" : v)}
                    disabled={updateTicketMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">Created</p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedTicket.createdAt ? format(new Date(selectedTicket.createdAt), "PPp") : "Unknown"}
                      </p>
                    </div>
                  </div>
                  {selectedTicket.resolvedAt && (
                    <div className="flex gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">Resolved</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(selectedTicket.resolvedAt), "PPp")}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedTicket.closedAt && (
                    <div className="flex gap-3">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-gray-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">Closed</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(selectedTicket.closedAt), "PPp")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Headphones className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold font-outfit">AKS Request Center</h1>
                <p className="text-blue-100 text-sm">
                  IT Support & Digital Transformation requests
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Ticket className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-outfit">{stats?.open || 0}</p>
                <p className="text-xs text-muted-foreground">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-outfit">{stats?.resolved || 0}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-outfit">{stats?.critical || 0}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900/30">
                <BarChart3 className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-outfit">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-0 cursor-pointer hover-elevate"
          onClick={() => {
            setCategory("it_support");
            setSubcategory("");
            setDialogOpen(true);
          }}
          data-testid="card-it-support"
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">IT Support</h3>
                <p className="text-blue-100 text-xs">{stats?.itSupport || 0} tickets</p>
              </div>
            </div>
            <p className="text-blue-100 text-xs">
              PC setup, software, access, equipment, network, email, printers
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-purple-600 to-pink-600 text-white border-0 cursor-pointer hover-elevate"
          onClick={() => {
            setCategory("digital_transformation");
            setSubcategory("");
            setDialogOpen(true);
          }}
          data-testid="card-digital-transformation"
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Digital Transformation</h3>
                <p className="text-purple-100 text-xs">{stats?.digitalTransformation || 0} tickets</p>
              </div>
            </div>
            <p className="text-purple-100 text-xs">
              Automation, new systems, integrations, analytics, UX improvements
            </p>
          </CardContent>
        </Card>

        <Link href="/intranet/requisitions">
          <Card
            className="bg-gradient-to-br from-amber-600 to-orange-600 text-white border-0 cursor-pointer hover-elevate h-full"
            data-testid="card-requisition-arf"
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Requisition ARF</h3>
                  <p className="text-amber-100 text-xs">Approval Request Forms</p>
                </div>
              </div>
              <p className="text-amber-100 text-xs">
                Submit & track procurement requisitions, approvals, and purchase orders
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between px-4 pt-4 gap-3 flex-wrap">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All Requests</TabsTrigger>
                <TabsTrigger value="it_support" data-testid="tab-it">IT Support</TabsTrigger>
                <TabsTrigger value="digital_transformation" data-testid="tab-dt">Digital Transformation</TabsTrigger>
                <TabsTrigger value="requisition_arf" data-testid="tab-arf">Requisition ARF</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    className="pl-9 w-48 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-tickets"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9" data-testid="select-status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeTab === "requisition_arf" ? (
              <div className="p-4">
                {requisitionsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : requisitions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-1 text-lg font-semibold">No requisitions yet</h2>
                    <p className="text-sm text-muted-foreground mb-4">Create a new requisition to get started</p>
                    <Link href="/intranet/requisitions/new?from=/intranet">
                      <Button data-testid="button-new-arf-empty">
                        <Plus className="h-4 w-4 mr-2" />
                        New Requisition
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Link href="/intranet/requisitions/new?from=/intranet">
                        <Button size="sm" data-testid="button-new-arf">
                          <Plus className="h-4 w-4 mr-2" />
                          New Requisition
                        </Button>
                      </Link>
                    </div>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-32">Department</TableHead>
                            <TableHead className="w-32">Requested By</TableHead>
                            <TableHead className="w-28 text-right">Cost (AED)</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-28">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requisitions.map((req) => (
                            <TableRow
                              key={req.id}
                              className="cursor-pointer"
                              data-testid={`row-arf-${req.id}`}
                            >
                              <TableCell>
                                <Link href={`/intranet/requisitions/${req.id}`}>
                                  <span className="font-mono text-xs text-primary hover:underline">{req.id.slice(0, 8).toUpperCase()}</span>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Link href={`/intranet/requisitions/${req.id}`}>
                                  <span className="font-medium text-sm hover:underline">{req.requestTitle}</span>
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{req.department}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{req.requestedBy}</TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {req.estimatedCostAed ? Number(req.estimatedCostAed).toLocaleString() : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    req.status === "PO Created" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px]" :
                                    req.status === "Rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]" :
                                    req.status === "Awaiting Approval" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-[10px]" :
                                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-[10px]"
                                  }
                                >
                                  {req.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{req.dateOfRequest}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "analytics" ? (
              <div className="p-4 space-y-4">
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <Card data-testid="card-avg-resolution">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Timer className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-outfit" data-testid="text-avg-resolution-value">
                            {stats?.avgCloseTimeHours != null
                              ? stats.avgCloseTimeHours < 48
                                ? `${Math.round(stats.avgCloseTimeHours)}h`
                                : `${Math.round(stats.avgCloseTimeDays || stats.avgCloseTimeHours / 24)}d`
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-sla-breaches" className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("all")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${(stats?.slaBreaches || 0) > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                          <AlertTriangle className={`h-5 w-5 ${(stats?.slaBreaches || 0) > 0 ? "text-red-600" : "text-green-600"}`} />
                        </div>
                        <div>
                          <p className={`text-2xl font-bold font-outfit ${(stats?.slaBreaches || 0) > 0 ? "text-red-600" : ""}`} data-testid="text-sla-breaches-value">
                            {stats?.slaBreaches ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">SLA Breaches</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-it-load" className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("it_support")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                          <Monitor className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-outfit" data-testid="text-it-load-value">
                            {stats?.byDepartmentLoad?.it_support
                              ? `${stats.byDepartmentLoad.it_support.open}/${stats.byDepartmentLoad.it_support.total}`
                              : "0/0"}
                          </p>
                          <p className="text-xs text-muted-foreground">IT Support Load</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-dt-load" className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("digital_transformation")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <Zap className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-outfit" data-testid="text-dt-load-value">
                            {stats?.byDepartmentLoad?.digital_transformation
                              ? `${stats.byDepartmentLoad.digital_transformation.open}/${stats.byDepartmentLoad.digital_transformation.total}`
                              : "0/0"}
                          </p>
                          <p className="text-xs text-muted-foreground">DT Load</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card data-testid="card-department-breakdown">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Department Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const itTotal = stats?.byDepartmentLoad?.it_support?.total || 0;
                        const dtTotal = stats?.byDepartmentLoad?.digital_transformation?.total || 0;
                        const maxVal = Math.max(itTotal, dtTotal, 1);
                        return (
                          <>
                            <div className="space-y-2 cursor-pointer rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors" onClick={() => setActiveTab("it_support")} data-testid="link-it-breakdown">
                              <div className="flex items-center justify-between">
                                <span className="text-sm flex items-center gap-2">
                                  <Monitor className="h-3.5 w-3.5 text-blue-600" />
                                  IT Support
                                </span>
                                <span className="text-sm font-semibold" data-testid="text-it-breakdown-count">{itTotal}</span>
                              </div>
                              <div className="h-3 rounded-md bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-md bg-blue-500 transition-all"
                                  style={{ width: `${(itTotal / maxVal) * 100}%` }}
                                  data-testid="bar-it-breakdown"
                                />
                              </div>
                            </div>
                            <div className="space-y-2 cursor-pointer rounded-lg p-2 -m-2 mt-2 hover:bg-muted/50 transition-colors" onClick={() => setActiveTab("digital_transformation")} data-testid="link-dt-breakdown">
                              <div className="flex items-center justify-between">
                                <span className="text-sm flex items-center gap-2">
                                  <Zap className="h-3.5 w-3.5 text-purple-600" />
                                  Digital Transformation
                                </span>
                                <span className="text-sm font-semibold" data-testid="text-dt-breakdown-count">{dtTotal}</span>
                              </div>
                              <div className="h-3 rounded-md bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-md bg-purple-500 transition-all"
                                  style={{ width: `${(dtTotal / maxVal) * 100}%` }}
                                  data-testid="bar-dt-breakdown"
                                />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-resolution-performance">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Resolution Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const itLoad = stats?.byDepartmentLoad?.it_support;
                        const dtLoad = stats?.byDepartmentLoad?.digital_transformation;
                        const itPct = itLoad && itLoad.total > 0 ? Math.round((itLoad.resolved / itLoad.total) * 100) : 0;
                        const dtPct = dtLoad && dtLoad.total > 0 ? Math.round((dtLoad.resolved / dtLoad.total) * 100) : 0;
                        return (
                          <>
                            <div className="space-y-2 cursor-pointer rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors" onClick={() => setActiveTab("it_support")} data-testid="link-it-resolution">
                              <div className="flex items-center justify-between">
                                <span className="text-sm flex items-center gap-2">
                                  <Monitor className="h-3.5 w-3.5 text-blue-600" />
                                  IT Support
                                </span>
                                <span className="text-xs text-muted-foreground" data-testid="text-it-resolution-ratio">
                                  {itLoad ? `${itLoad.resolved}/${itLoad.total}` : "0/0"} ({itPct}%)
                                </span>
                              </div>
                              <Progress value={itPct} className="h-2" data-testid="progress-it-resolution" />
                            </div>
                            <div className="space-y-2 cursor-pointer rounded-lg p-2 -m-2 mt-2 hover:bg-muted/50 transition-colors" onClick={() => setActiveTab("digital_transformation")} data-testid="link-dt-resolution">
                              <div className="flex items-center justify-between">
                                <span className="text-sm flex items-center gap-2">
                                  <Zap className="h-3.5 w-3.5 text-purple-600" />
                                  Digital Transformation
                                </span>
                                <span className="text-xs text-muted-foreground" data-testid="text-dt-resolution-ratio">
                                  {dtLoad ? `${dtLoad.resolved}/${dtLoad.total}` : "0/0"} ({dtPct}%)
                                </span>
                              </div>
                              <Progress value={dtPct} className="h-2" data-testid="progress-dt-resolution" />
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
            <div className="p-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTickets.length === 0 && (activeTab !== "all" || filteredRequisitions.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Ticket className="mb-3 h-12 w-12 text-muted-foreground" />
                  <h2 className="mb-1 text-lg font-semibold">No requests found</h2>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Try adjusting your search" : "Create a new request to get started"}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="w-36">Category</TableHead>
                        <TableHead className="w-24">Priority</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        {isAdmin && <TableHead className="w-28">Assigned</TableHead>}
                        <TableHead className="w-28">Created</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTickets.map((ticket) => {
                        const st = statusConfig[ticket.status] || statusConfig.new;
                        const sev = severityConfig[ticket.severity] || severityConfig.low;
                        const cat = categoryConfig[ticket.category] || categoryConfig.other;
                        const StatusIcon = st.icon;
                        const isOverdue = stats?.overdueTickets?.includes(ticket.id);

                        return (
                          <TableRow
                            key={ticket.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedTicket(ticket)}
                            data-testid={`row-ticket-${ticket.id}`}
                          >
                            <TableCell className="font-mono text-xs">{ticket.trackingId}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{ticket.subject}</p>
                                {ticket.subcategory && (
                                  <p className="text-xs text-muted-foreground">
                                    {getSubcategoryLabel(ticket.category, ticket.subcategory)}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${cat.bgColor} ${cat.color} border-0 text-[10px]`}>
                                {cat.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={sev.variant} className="text-[10px]">{sev.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon className={`h-3.5 w-3.5 ${st.color}`} />
                                <span className={`text-xs ${st.color}`}>{st.label}</span>
                                {isOverdue && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1" data-testid={`badge-sla-${ticket.id}`}>
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    SLA
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {ticket.assignedToName || "Unassigned"}
                              </span>
                            </TableCell>
                            )}
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {ticket.createdAt
                                  ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {activeTab === "all" && paginatedRequisitions.map((req) => (
                        <TableRow
                          key={`arf-${req.id}`}
                          className="cursor-pointer"
                          data-testid={`row-arf-all-${req.id}`}
                        >
                          <TableCell>
                            <Link href={`/intranet/requisitions/${req.id}`}>
                              <span className="font-mono text-xs text-primary hover:underline">{req.id.slice(0, 8).toUpperCase()}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/intranet/requisitions/${req.id}`}>
                              <span className="font-medium text-sm hover:underline">{req.requestTitle}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px]">
                              Requisition ARF
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                req.status === "PO Created" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px]" :
                                req.status === "Rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]" :
                                req.status === "Awaiting Approval" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-[10px]" :
                                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-[10px]"
                              }
                            >
                              {req.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{req.requestedBy || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{req.dateOfRequest || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <Link href={`/intranet/requisitions/${req.id}`}>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-sm text-muted-foreground">
                        Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safeCurrentPage * ITEMS_PER_PAGE, allItems.length)} of {allItems.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="button-prev-page">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">Page {safeCurrentPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="button-next-page">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-outfit">
              <Ticket className="h-5 w-5" />
              Create New Ticket
            </DialogTitle>
            <DialogDescription>
              Submit a support request to {category === "it_support" ? "IT Support" : category === "digital_transformation" ? "Digital Transformation" : "the team"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs">Department</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(""); }}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it_support">IT Support</SelectItem>
                    <SelectItem value="digital_transformation">Digital Transformation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory" className="text-xs">Type</Label>
                <Select value={subcategory} onValueChange={setSubcategory}>
                  <SelectTrigger id="subcategory" data-testid="select-subcategory">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {category === "it_support" && Object.entries(itSubcategoryLabels).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                    {category === "digital_transformation" && Object.entries(dtSubcategoryLabels).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                    {category === "other" && (
                      <SelectItem value="general">General</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" data-testid="select-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of the issue or request"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide details about your request..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Attachments</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("ticket-file-input")?.click()}
                  disabled={pendingFiles.length >= 5}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                  Attach Files
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {pendingFiles.length}/5 files (max 10MB each)
                </span>
              </div>
              <input
                id="ticket-file-input"
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileSelect}
              />
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {pendingFiles.map((pf, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded border p-1.5 text-xs" data-testid={`pending-file-${idx}`}>
                      {pf.preview ? (
                        <img src={pf.preview} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate flex-1">{pf.file.name}</span>
                      <span className="text-muted-foreground shrink-0">{formatFileSize(pf.file.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removePendingFile(idx)}
                        data-testid={`button-remove-file-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitTicket}
              disabled={createTicketMutation.isPending}
              data-testid="button-submit-ticket"
            >
              {createTicketMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Ticket className="mr-2 h-4 w-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
