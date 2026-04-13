import { OtherModulesSection } from "@/components/other-modules-section";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Ticket, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Send,
  MessageSquare,
  Search,
  RefreshCw,
  Bug,
  ShieldAlert,
  Database,
  Zap,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Bell,
  Download
} from "lucide-react";
import type { Ticket as TicketType, TicketComment } from "@shared";
import { format, formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  new: { label: "New", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Clock },
  in_progress: { label: "In Progress", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", icon: RefreshCw },
  under_review: { label: "Under Review", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: Clock },
  resolved: { label: "Resolved", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  closed: { label: "Closed", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30", icon: CheckCircle },
};

const severityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "secondary" },
  medium: { label: "Medium", variant: "default" },
  high: { label: "High", variant: "destructive" },
  critical: { label: "Critical", variant: "destructive" },
};

const categoryConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  it_support: { label: "IT Support", icon: ShieldAlert, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  digital_transformation: { label: "Digital Transformation", icon: Zap, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
};


export default function MyTicketsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [newComment, setNewComment] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "",
    subcategory: "",
    severity: "",
  });

  const { data: tickets = [], isLoading } = useQuery<TicketType[]>({
    queryKey: ["/api/tickets/my"],
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "comments"],
    enabled: !!selectedTicket,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: typeof newTicket) => {
      const res = await apiRequest("POST", "/api/tickets", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/my"] });
      setCreateDialogOpen(false);
      setNewTicket({ subject: "", description: "", category: "", subcategory: "", severity: "" });
      toast({ 
        title: "Ticket created", 
        description: `Your ticket ${data.trackingId} has been submitted successfully.` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
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

  function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description || !newTicket.category || !newTicket.severity) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    createTicketMutation.mutate(newTicket);
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  }

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = searchQuery === "" || 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.trackingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === null || ticket.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTickets = filteredTickets.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter, statusFilter]);

  const ticketsByCategory = Object.keys(categoryConfig).reduce((acc, key) => {
    acc[key] = tickets.filter(t => t.category === key).length;
    return acc;
  }, {} as Record<string, number>);

  if (selectedTicket) {
    const status = statusConfig[selectedTicket.status] || statusConfig.new;
    const severity = severityConfig[selectedTicket.severity] || severityConfig.low;
    const StatusIcon = status.icon;

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedTicket(null)}
            data-testid="button-back-to-tickets"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">{selectedTicket.trackingId}</h1>
              <Badge className={`${status.bgColor} ${status.color} border-0`}>{status.label}</Badge>
              <Badge variant={severity.variant}>{severity.label}</Badge>
            </div>
            <p className="text-muted-foreground">{selectedTicket.subject}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1">{selectedTicket.description}</p>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="mt-1">{categoryConfig[selectedTicket.category]?.label || selectedTicket.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="mt-1">
                    {selectedTicket.createdAt 
                      ? format(new Date(selectedTicket.createdAt), "PPpp")
                      : "Unknown"
                    }
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <h3 className="font-semibold">Comments</h3>
                </div>

                {commentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">No comments yet</p>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className={`rounded-lg p-3 ${comment.isAdmin ? "bg-primary/10" : "bg-muted"}`}
                        >
                          <div className="mb-1 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-sm font-medium">
                              {comment.userName || comment.userEmail}
                              {comment.isAdmin && (
                                <Badge variant="outline" className="ml-2">Admin</Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {comment.createdAt ? format(new Date(comment.createdAt), "PPp") : ""}
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
                      data-testid="input-new-comment"
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

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicket.createdAt 
                        ? format(new Date(selectedTicket.createdAt), "PPp")
                        : "Unknown"
                      }
                    </p>
                  </div>
                </div>
                {selectedTicket.resolvedAt && (
                  <div className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Resolved</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedTicket.resolvedAt), "PPp")}
                      </p>
                    </div>
                  </div>
                )}
                {selectedTicket.closedAt && (
                  <div className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Closed</p>
                      <p className="text-xs text-muted-foreground">
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
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white">
        <h1 className="mb-2 text-3xl font-bold">Support Tickets</h1>
        <p className="mb-6 text-blue-100">
          Track your support requests, submit new tickets, and get help from our team.
        </p>
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search tickets by ID, subject, or description..."
            className="h-12 w-full rounded-lg border-0 bg-white pl-12 text-gray-900 placeholder:text-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-tickets"
          />
        </div>
      </div>

      <div className="space-y-6">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Browse Categories</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(categoryConfig).map(([key, config]) => {
                const IconComponent = config.icon;
                const count = ticketsByCategory[key] || 0;
                const isActive = categoryFilter === key;
                
                return (
                  <Card 
                    key={key}
                    className={`cursor-pointer hover-elevate ${isActive ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setCategoryFilter(isActive ? null : key)}
                    data-testid={`card-category-${key}`}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.bgColor}`}>
                          <IconComponent className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{config.label}</p>
                          <p className="text-sm text-muted-foreground">{count} ticket{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  {categoryFilter ? `${categoryConfig[categoryFilter]?.label} Tickets` : 'All Tickets'}
                </h2>
                {categoryFilter && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCategoryFilter(null)}
                    className="text-muted-foreground"
                  >
                    Clear filter
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-9" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
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
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-ticket">
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {Object.entries(statusConfig).map(([key, config]) => {
                const count = tickets.filter(t => t.status === key).length;
                if (count === 0) return null;
                return (
                  <button key={key} onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}
                    className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ${statusFilter === key ? 'ring-2 ring-primary' : ''} ${config.bgColor}`}
                    data-testid={`button-status-filter-${key}`}>
                    <span className={`h-2 w-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                    <span className={config.color}>{config.label}: {count}</span>
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Ticket className="mb-4 h-16 w-16 text-muted-foreground" />
                  <h2 className="mb-2 text-xl font-semibold">
                    {searchQuery || categoryFilter ? "No tickets found" : "No tickets yet"}
                  </h2>
                  <p className="mb-4 text-center text-muted-foreground">
                    {searchQuery || categoryFilter 
                      ? "Try adjusting your search or filter criteria"
                      : "Submit a ticket when you need help with the portal"
                    }
                  </p>
                  {!searchQuery && !categoryFilter && (
                    <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-ticket">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Ticket
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {paginatedTickets.map((ticket) => {
                  const status = statusConfig[ticket.status] || statusConfig.new;
                  const severity = severityConfig[ticket.severity] || severityConfig.low;
                  const category = categoryConfig[ticket.category] || categoryConfig.other;
                  const priorityBorderColor = {
                    low: "border-l-blue-400",
                    medium: "border-l-yellow-400",
                    high: "border-l-orange-400",
                    critical: "border-l-red-500",
                  }[ticket.severity] || "border-l-blue-400";

                  return (
                    <Card 
                      key={ticket.id} 
                      className={`cursor-pointer hover-elevate border-l-4 rounded-none ${priorityBorderColor}`}
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`card-ticket-${ticket.id}`}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${status.bgColor}`}>
                            <status.icon className={`h-6 w-6 ${status.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium">{ticket.subject}</h3>
                              <Badge className={`${status.bgColor} ${status.color} border-0`}>{status.label}</Badge>
                              <Badge variant={severity.variant}>{severity.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {ticket.trackingId} - {category.label} - {ticket.createdAt 
                                ? format(new Date(ticket.createdAt), "MMM d, yyyy")
                                : "Unknown"
                              }
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  );
                })}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-3">
                    <span className="text-sm text-muted-foreground">
                      Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length}
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
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit a Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and we'll get back to you as soon as possible
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief summary of the issue (min 5 characters)"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                required
                data-testid="input-ticket-subject"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(v) => setNewTicket({ ...newTicket, category: v, subcategory: "" })}
                >
                  <SelectTrigger data-testid="select-ticket-category">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newTicket.subcategory}
                  onValueChange={(v) => setNewTicket({ ...newTicket, subcategory: v })}
                >
                  <SelectTrigger data-testid="select-ticket-subcategory">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {newTicket.category === "it_support" && <>
                      <SelectItem value="pc_setup">PC Setup & Configuration</SelectItem>
                      <SelectItem value="software_install">Software Installation</SelectItem>
                      <SelectItem value="software_remove">Software Removal</SelectItem>
                      <SelectItem value="access_permissions">Access & Permissions</SelectItem>
                      <SelectItem value="equipment_request">Equipment Request</SelectItem>
                      <SelectItem value="network_issue">Network Issue</SelectItem>
                      <SelectItem value="email_issue">Email Issue</SelectItem>
                      <SelectItem value="printer_issue">Printer Issue</SelectItem>
                      <SelectItem value="hardware_repair">Hardware Repair</SelectItem>
                      <SelectItem value="vpn_access">VPN Access</SelectItem>
                      <SelectItem value="general_it">General IT</SelectItem>
                    </>}
                    {newTicket.category === "digital_transformation" && <>
                      <SelectItem value="process_automation">Process Automation</SelectItem>
                      <SelectItem value="new_system">New System Request</SelectItem>
                      <SelectItem value="system_integration">System Integration</SelectItem>
                      <SelectItem value="reporting_analytics">Reporting & Analytics</SelectItem>
                      <SelectItem value="ux_improvement">UX Improvement</SelectItem>
                      <SelectItem value="workflow_optimization">Workflow Optimization</SelectItem>
                      <SelectItem value="data_migration">Data Migration</SelectItem>
                      <SelectItem value="api_development">API Development</SelectItem>
                      <SelectItem value="general_dt">General DT</SelectItem>
                    </>}
                    {newTicket.category === "other" && <>
                      <SelectItem value="general">General</SelectItem>
                    </>}
                    {!newTicket.category && <SelectItem value="__none" disabled>Select a department first</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={newTicket.severity}
                onValueChange={(v) => setNewTicket({ ...newTicket, severity: v })}
              >
                <SelectTrigger data-testid="select-ticket-severity">
                  <SelectValue placeholder="Select severity" />
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about the issue (min 10 characters)..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={5}
                required
                data-testid="textarea-ticket-description"
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTicketMutation.isPending}
                data-testid="button-submit-new-ticket"
              >
                {createTicketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <OtherModulesSection />
    </div>
  );
}
