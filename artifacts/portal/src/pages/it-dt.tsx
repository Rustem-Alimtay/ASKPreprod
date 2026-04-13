import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Ticket,
  Clock,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Send,
  MessageSquare,
  RefreshCw,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Zap,
  HelpCircle,
  Headphones
} from "lucide-react";
import type { Ticket as TicketType, TicketComment } from "@shared";
import { format, formatDistanceToNow } from "date-fns";
import { statusConfig, severityConfig, categoryConfig } from "@/lib/ticket-config";
import { useDebounce } from "@/hooks/use-debounce";

export default function ITDTPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";


  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [newComment, setNewComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-destructive" data-testid="text-access-denied">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground" data-testid="text-access-denied-message">You do not have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketType[]; total: number }>({
    queryKey: ["/api/admin/tickets", statusFilter, "it_support"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("category", "it_support");
      const res = await fetch(`/api/admin/tickets?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "comments"],
    enabled: !!selectedTicket,
  });

  const { data: usersList = [] } = useQuery<{ id: string; username: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/users/list"],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string; assignedTo?: string; assignedToName?: string } }) => {
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
      toast({ title: "Failed to update ticket", description: error.message, variant: "destructive" });
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

  function handleStatusChange(ticketId: string, newStatus: string) {
    updateTicketMutation.mutate({ id: ticketId, data: { status: newStatus } });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
  }

  function handleAssign(ticketId: string, userId: string) {
    const u = usersList.find(x => x.id === userId);
    const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : "";
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

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTickets = filteredTickets.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter]);

  if (selectedTicket) {
    const status = statusConfig[selectedTicket.status] || statusConfig.new;
    const severity = severityConfig[selectedTicket.severity] || severityConfig.low;
    const cat = categoryConfig[selectedTicket.category] || categoryConfig.other;

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
              <Badge className={`${cat.bgColor} ${cat.color} border-0`}>{cat.label}</Badge>
            </div>
            <p className="text-muted-foreground">{selectedTicket.subject}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Submitted By</Label>
                  <p className="mt-1 text-sm">{selectedTicket.userName || selectedTicket.userEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="mt-1 text-sm">
                    {selectedTicket.createdAt
                      ? format(new Date(selectedTicket.createdAt), "PPp")
                      : "Unknown"
                    }
                  </p>
                </div>
                {isAdmin && (
                <div>
                  <Label className="text-muted-foreground text-xs">Assigned To</Label>
                  <p className="mt-1 text-sm">{selectedTicket.assignedToName || "Unassigned"}</p>
                </div>
                )}
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
                          className={`rounded-lg p-3 ${comment.isAdmin ? "bg-primary/10 border border-primary/20" : "bg-muted"}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
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
                      placeholder="Add a response..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      data-testid="input-itsd-comment"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={addCommentMutation.isPending || !newComment.trim()}
                      data-testid="button-send-itsd-comment"
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
                  <Label className="text-xs">Update Status</Label>
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
                  <Label className="text-xs">Assign To</Label>
                  <Select
                    value={selectedTicket.assignedTo || "unassigned"}
                    onValueChange={(v) => handleAssign(selectedTicket.id, v === "unassigned" ? "" : v)}
                    disabled={updateTicketMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-itsd-assignee">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Headphones className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold font-outfit" data-testid="text-itsd-title">IT Service Desk</h1>
            <p className="text-muted-foreground text-sm">
              Manage and respond to support tickets
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 w-40 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-itsd-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9" data-testid="select-itsd-status-filter">
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
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Ticket className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">No tickets found</h2>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No support tickets have been submitted yet"
                }
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Assigned</TableHead>}
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map((ticket) => {
                  const status = statusConfig[ticket.status] || statusConfig.new;
                  const severity = severityConfig[ticket.severity] || severityConfig.low;
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={ticket.id} className="cursor-pointer" onClick={() => setSelectedTicket(ticket)} data-testid={`row-ticket-${ticket.id}`}>
                      <TableCell className="font-mono text-xs">{ticket.trackingId}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">{ticket.userName || ticket.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={severity.variant}>{severity.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                          <span className={`text-xs ${status.color}`}>{status.label}</span>
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
                        {ticket.createdAt
                          ? <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                          : "Unknown"
                        }
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
