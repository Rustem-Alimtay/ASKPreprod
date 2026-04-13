import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, FileText, Upload, Download, Trash2, Pencil, MoveRight, MoreVertical } from "lucide-react";
import type { Customer, Item } from "@shared/sm2";

export default function CurrentAgreementsPage() {
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [checkoutAgreement, setCheckoutAgreement] = useState<any>(null);
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  const [documentsAgreement, setDocumentsAgreement] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editAgreement, setEditAgreement] = useState<any>(null);
  const [editAgreementCategory, setEditAgreementCategory] = useState("with_horse");
  const [editAgreementType, setEditAgreementType] = useState("permanent");
  const [editSelectedCustomerId, setEditSelectedCustomerId] = useState("");
  const [editCustomerSearch, setEditCustomerSearch] = useState("");
  const [editCustomerDropdownOpen, setEditCustomerDropdownOpen] = useState(false);
  const [editSelectedItemId, setEditSelectedItemId] = useState("");
  const [editMonthlyAmount, setEditMonthlyAmount] = useState("");

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInAgreement, setCheckInAgreement] = useState<any>(null);
  const [checkInBoxName, setCheckInBoxName] = useState("");
  const [selectedCheckInHorseId, setSelectedCheckInHorseId] = useState("");
  const [checkInHorseSearch, setCheckInHorseSearch] = useState("");
  const [checkInHorseDropdownOpen, setCheckInHorseDropdownOpen] = useState(false);

  const { toast } = useToast();

  const { data: agreements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/livery-agreements", "?status=active"],
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: ["/api/sm2/livery-agreements", documentsAgreement?.id, "documents"],
    queryFn: async () => {
      if (!documentsAgreement?.id) return [];
      const res = await fetch(`/api/sm2/livery-agreements/${documentsAgreement.id}/documents`);
      return res.json();
    },
    enabled: !!documentsAgreement?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/sm2/customers"],
  });

  const { data: liveryItems = [] } = useQuery<Item[]>({
    queryKey: ["/api/sm2/items/livery-packages"],
  });

  const { data: boxesWithStatus = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/boxes-with-status"],
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sm2/livery-agreements/${data.id}`, {
      endDate: data.endDate,
      checkoutReason: data.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/livery-agreements"] });
      setShowCheckoutDialog(false);
      toast({ title: "Agreement checkout date set successfully" });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sm2/livery-agreements/${data.id}`, data.updates),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/livery-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements"] });
      setShowEditDialog(false);
      toast({ title: "Agreement updated successfully" });

      if (variables.boxChanged && editAgreement) {
        const newBox = boxesWithStatus.find((b: any) => b.id === variables.updates.boxId);
        setCheckInAgreement({ id: editAgreement.id, customerId: editSelectedCustomerId, boxId: variables.updates.boxId });
        setCheckInBoxName(newBox?.name || "New Box");
        setSelectedCheckInHorseId("");
        setCheckInHorseSearch("");
        setShowCheckInModal(true);
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to update agreement", description: error.message, variant: "destructive" });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/horse-movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/livery-agreements"] });
      setShowCheckInModal(false);
      toast({ title: "Horse checked in successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to check in horse", description: error.message, variant: "destructive" });
    },
  });

  const { data: customerHorses = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/horse-ownership/customer", checkInAgreement?.customerId, "checkin-eligible"],
    queryFn: async () => {
      const custId = checkInAgreement?.customerId;
      if (!custId) return [];
      const res = await fetch(`/api/sm2/horse-ownership/customer/${custId}`);
      const ownership = await res.json();
      if (!Array.isArray(ownership) || ownership.length === 0) return [];
      const [horsesRes, movementsRes] = await Promise.all([
        fetch("/api/sm2/horses"),
        fetch("/api/sm2/horse-movements"),
      ]);
      const allHorses = await horsesRes.json();
      const allMovements = await movementsRes.json();
      const activeHorseIds = new Set(
        (allMovements as any[]).filter((m: any) => !m.checkOut).map((m: any) => m.horseId)
      );
      return ownership
        .map((o: any) => allHorses.find((h: any) => h.id === o.horseId))
        .filter((h: any) => h && h.status === "active" && !activeHorseIds.has(h.id));
    },
    enabled: !!checkInAgreement?.customerId,
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => apiRequest("DELETE", `/api/sm2/agreement-documents/${docId}`),
    onSuccess: () => {
      refetchDocs();
      toast({ title: "Document deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !documentsAgreement) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Only PDF files are allowed", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large (max 10MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await apiRequest("POST", `/api/sm2/livery-agreements/${documentsAgreement.id}/documents`, {
          filename: file.name,
          fileData: base64,
        });
        refetchDocs();
        toast({ title: "Document uploaded successfully" });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Failed to upload document", variant: "destructive" });
      setUploading(false);
    }

    e.target.value = "";
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const visibleAgreements = useMemo(() => {
    return agreements.filter((a: any) => {
      if (!a.endDate) return true;
      return a.endDate >= todayStr;
    });
  }, [agreements, todayStr]);

  const editActiveCustomers = useMemo(() => {
    const active = customers.filter(c => c.status === "active");
    if (!editCustomerSearch.trim()) return active;
    const s = editCustomerSearch.toLowerCase();
    return active.filter(c =>
      (c.fullname || '').toLowerCase().includes(s) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  }, [customers, editCustomerSearch]);

  const editSelectedCustomer = customers.find(c => c.id === editSelectedCustomerId);
  const editSelectedItem = liveryItems.find(i => i.id === editSelectedItemId);

  const handleEditItemChange = (itemId: string) => {
    setEditSelectedItemId(itemId);
    const item = liveryItems.find(i => i.id === itemId);
    setEditMonthlyAmount(item?.price || "0");
  };

  const [editEndDate, setEditEndDate] = useState("");

  const openEditDialog = (agreement: any) => {
    setEditAgreement(agreement);
    setEditAgreementCategory(agreement.agreementCategory || "with_horse");
    setEditSelectedCustomerId(agreement.customerId);
    setEditCustomerSearch("");
    setEditSelectedItemId(agreement.itemId);
    setEditMonthlyAmount(agreement.monthlyAmount || "");
    const effectiveType = agreement.endDate ? "temporary" : (agreement.type || "permanent");
    setEditAgreementType(effectiveType);
    setEditEndDate(agreement.endDate || "");
    setEditSelectedBoxId(agreement.boxId);
    setShowEditDialog(true);
  };

  const editAvailableBoxes = useMemo(() => {
    if (!editAgreement) return [];
    return boxesWithStatus.filter((b: any) => b.isAvailable || b.id === editAgreement.boxId);
  }, [boxesWithStatus, editAgreement]);

  const [editSelectedBoxId, setEditSelectedBoxId] = useState("");

  const columns = [
    { key: "referenceNumber", label: "Reference #" },
    {
      key: "type",
      label: "Type",
      render: (item: any) => (
        <Badge variant={item.type === "permanent" ? "default" : "outline"}>
          {item.type === "permanent" ? "Permanent" : "Temporary"}
        </Badge>
      ),
    },
    { key: "horseName", label: "Horse", render: (item: any) => item.horseName || "—" },
    { key: "customerName", label: "Customer" },
    { key: "stableName", label: "Stable" },
    { key: "boxName", label: "Box" },
    { key: "itemName", label: "Livery Package" },
    { key: "startDate", label: "Start Date" },
    { key: "endDate", label: "End Date", render: (item: any) => item.endDate || "-" },
    {
      key: "monthlyAmount",
      label: "Monthly Amount",
      render: (item: any) => item.monthlyAmount ? `AED ${parseFloat(item.monthlyAmount).toFixed(2)}` : "-",
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Current Agreements"
        description="Active livery agreements"
      />

      <DataTable
        columns={columns}
        data={visibleAgreements}
        isLoading={isLoading}
        actions={(item) => (
          <div className="flex items-center gap-1">
            {item.endDate && (
              <Badge variant="secondary" className="text-xs mr-1">
                Ends {item.endDate}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-actions-${item.id}`}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => openEditDialog(item)}
                  data-testid={`button-edit-${item.id}`}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setDocumentsAgreement(item); setShowDocumentsDialog(true); }}
                  data-testid={`button-documents-${item.id}`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Documents
                </DropdownMenuItem>
                {!item.endDate && (
                  <DropdownMenuItem
                    onClick={() => { setCheckoutAgreement(item); setShowCheckoutDialog(true); }}
                    data-testid={`button-terminate-${item.id}`}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Agreement Termination
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      />

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Livery Agreement</DialogTitle>
            <DialogDescription>Update the details for agreement {editAgreement?.referenceNumber}</DialogDescription>
          </DialogHeader>
          {editAgreement && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const boxId = editSelectedBoxId || editAgreement.boxId;
                const boxChanged = boxId !== editAgreement.boxId;
                editMutation.mutate({
                  id: editAgreement.id,
                  boxChanged,
                  updates: {
                    agreementCategory: editAgreementCategory,
                    customerId: editSelectedCustomerId,
                    boxId,
                    itemId: editSelectedItemId,
                    startDate: fd.get("startDate") as string,
                    endDate: editAgreementType === "temporary" ? editEndDate : null,
                    type: editAgreementType,
                    notes: (fd.get("notes") as string) || null,
                    monthlyAmount: editMonthlyAmount || editSelectedItem?.price || "0",
                  },
                });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            >
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <Label>Box</Label>
                  <Select value={editSelectedBoxId || editAgreement.boxId} onValueChange={setEditSelectedBoxId}>
                    <SelectTrigger data-testid="select-edit-box">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editAvailableBoxes.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.stableName})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                <div className="relative">
                  <Label>Customer</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-edit-customer-search"
                      placeholder="Search customer..."
                      value={editSelectedCustomer && !editCustomerDropdownOpen ? editSelectedCustomer.fullname : editCustomerSearch}
                      onChange={(e) => {
                        setEditCustomerSearch(e.target.value);
                        setEditCustomerDropdownOpen(true);
                        if (editSelectedCustomerId) setEditSelectedCustomerId("");
                      }}
                      onFocus={() => setEditCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setEditCustomerDropdownOpen(false), 200)}
                    />
                    {editSelectedCustomerId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => { setEditSelectedCustomerId(""); setEditCustomerSearch(""); setEditCustomerDropdownOpen(true); }}
                      >✕</button>
                    )}
                  </div>
                  {editCustomerDropdownOpen && !editSelectedCustomerId && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {editActiveCustomers.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No customers found</div>
                      ) : (
                        editActiveCustomers.map(c => (
                          <button
                            type="button"
                            key={c.id}
                            data-testid={`edit-customer-option-${c.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => { setEditSelectedCustomerId(c.id); setEditCustomerSearch(""); setEditCustomerDropdownOpen(false); }}
                          >
                            <div className="font-medium">{c.fullname}</div>
                            {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Livery Package</Label>
                  <Select value={editSelectedItemId} onValueChange={handleEditItemChange}>
                    <SelectTrigger data-testid="select-edit-item">
                      <SelectValue placeholder="Select livery package..." />
                    </SelectTrigger>
                    <SelectContent>
                      {liveryItems.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name} (AED {i.price}/mo)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editSelectedItem && (
                  <div>
                    <Label>Monthly Amount (AED)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={editMonthlyAmount}
                        onChange={(e) => setEditMonthlyAmount(e.target.value)}
                        data-testid="input-edit-monthly-amount"
                      />
                      {editMonthlyAmount !== editSelectedItem.price && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMonthlyAmount(editSelectedItem.price || "0")}
                          data-testid="button-edit-reset-price"
                          className="text-xs whitespace-nowrap"
                        >
                          Reset to {editSelectedItem.price}
                        </Button>
                      )}
                    </div>
                    {editMonthlyAmount !== editSelectedItem.price && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Default package price: AED {editSelectedItem.price}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label>Start Date</Label>
                  <Input name="startDate" type="date" required defaultValue={editAgreement.startDate} data-testid="input-edit-start" />
                </div>

                <div>
                  <Label>Type</Label>
                  <Select value={editAgreementType} onValueChange={setEditAgreementType}>
                    <SelectTrigger data-testid="select-edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editAgreementType === "temporary" && (
                  <div>
                    <Label>End Date</Label>
                    <Input name="endDate" type="date" required value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} data-testid="input-edit-end" />
                  </div>
                )}

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea name="notes" placeholder="Additional notes..." defaultValue={editAgreement.notes || ""} data-testid="input-edit-notes" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={editMutation.isPending || !editSelectedCustomerId || !editSelectedItemId} data-testid="button-submit-edit">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agreement Termination</DialogTitle>
            <DialogDescription>Terminate the livery agreement and check out any horse currently in the box.</DialogDescription>
          </DialogHeader>
          {checkoutAgreement && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                checkoutMutation.mutate({
                  id: checkoutAgreement.id,
                  endDate: fd.get("endDate"),
                  reason: fd.get("reason"),
                });
              }}
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Terminating agreement: <strong>{checkoutAgreement.referenceNumber}</strong> — {checkoutAgreement.customerName}
                </p>
                <div>
                  <Label>Termination Date</Label>
                  <Input name="endDate" type="date" required max={todayStr} data-testid="input-termination-date" />
                </div>
                <div>
                  <Label>Reason (optional)</Label>
                  <Textarea name="reason" placeholder="Reason for termination..." data-testid="input-termination-reason" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={checkoutMutation.isPending} variant="destructive" data-testid="button-submit-termination">
                  Confirm Termination
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDocumentsDialog} onOpenChange={setShowDocumentsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agreement Documents</DialogTitle>
            <DialogDescription>
              {documentsAgreement ? `${documentsAgreement.horseName || "No Horse"} - ${documentsAgreement.customerName} (${documentsAgreement.referenceNumber})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="pdf-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent text-sm">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload PDF"}
                </div>
              </Label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
                data-testid="input-upload-document"
              />
            </div>

            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No documents uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`document-row-${doc.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(`/api/sm2/agreement-documents/${doc.id}/download`, "_blank")}
                        data-testid={`button-download-doc-${doc.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckInModal} onOpenChange={(open) => {
        if (!open) {
          setShowCheckInModal(false);
          setCheckInAgreement(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check In Horse</DialogTitle>
            <DialogDescription>
              The box was changed. Do you want to check a horse into box <strong>{checkInBoxName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Label>Select Horse</Label>
              <div className="relative">
                <Input
                  data-testid="input-recheckin-horse-search"
                  placeholder="Search horse..."
                  value={customerHorses.find((h: any) => h.id === selectedCheckInHorseId) && !checkInHorseDropdownOpen
                    ? customerHorses.find((h: any) => h.id === selectedCheckInHorseId)?.horseName
                    : checkInHorseSearch}
                  onChange={(e) => {
                    setCheckInHorseSearch(e.target.value);
                    setCheckInHorseDropdownOpen(true);
                    if (selectedCheckInHorseId) setSelectedCheckInHorseId("");
                  }}
                  onFocus={() => setCheckInHorseDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCheckInHorseDropdownOpen(false), 200)}
                />
                {selectedCheckInHorseId && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                    onClick={() => { setSelectedCheckInHorseId(""); setCheckInHorseSearch(""); setCheckInHorseDropdownOpen(true); }}
                  >✕</button>
                )}
              </div>
              {checkInHorseDropdownOpen && !selectedCheckInHorseId && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {customerHorses.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No eligible horses found</div>
                  ) : (
                    customerHorses.filter((h: any) => {
                      if (!checkInHorseSearch.trim()) return true;
                      return h.horseName.toLowerCase().includes(checkInHorseSearch.toLowerCase());
                    }).map((h: any) => (
                      <button
                        type="button"
                        key={h.id}
                        data-testid={`recheckin-horse-option-${h.id}`}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => { setSelectedCheckInHorseId(h.id); setCheckInHorseSearch(""); setCheckInHorseDropdownOpen(false); }}
                      >
                        <div className="font-medium">{h.horseName}</div>
                        <div className="text-xs text-muted-foreground">
                          {h.breed || ""}{h.color ? ` · ${h.color}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowCheckInModal(false); setCheckInAgreement(null); }}
              data-testid="button-skip-recheckin"
            >
              Skip
            </Button>
            <Button
              disabled={!selectedCheckInHorseId || checkInMutation.isPending}
              onClick={() => {
                if (!checkInAgreement || !selectedCheckInHorseId) return;
                checkInMutation.mutate({
                  agreementId: checkInAgreement.id,
                  horseId: selectedCheckInHorseId,
                  stableboxId: checkInAgreement.boxId,
                  checkIn: new Date().toISOString().split("T")[0],
                });
              }}
              data-testid="button-confirm-recheckin"
            >
              <MoveRight className="w-4 h-4 mr-1" />
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
