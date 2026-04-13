import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { SearchBar } from "../components/search-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileText, Trash2, Pencil, AlertTriangle } from "lucide-react";
import type { Customer, Item } from "@shared/sm2";

type LineItem = {
  key: string;
  type: "livery" | "billing";
  description: string;
  horseName: string | null;
  date: string;
  qty: number;
  unitPrice: number;
  amount: number;
  proRateLabel?: string;
  agreementId?: string;
  billingElementId?: string;
  horseId?: string;
  boxId?: string;
  itemId?: string;
  billingMonth?: string;
};

function getProRateFraction(agreement: any, billingMonth: string): { fraction: number; label: string } {
  const [bmYear, bmMonth] = billingMonth.split("-").map(Number);
  const daysInMonth = new Date(bmYear, bmMonth, 0).getDate();

  const startDate = agreement.startDate ? new Date(agreement.startDate) : null;
  const endDate = agreement.endDate ? new Date(agreement.endDate) : null;

  let firstDay = 1;
  let lastDay = daysInMonth;

  if (startDate && startDate.getFullYear() === bmYear && startDate.getMonth() + 1 === bmMonth && startDate.getDate() > 1) {
    firstDay = startDate.getDate();
  }

  if (endDate && endDate.getFullYear() === bmYear && endDate.getMonth() + 1 === bmMonth && endDate.getDate() < daysInMonth) {
    lastDay = endDate.getDate();
  }

  const activeDays = lastDay - firstDay + 1;
  if (activeDays >= daysInMonth) return { fraction: 1, label: "" };
  if (activeDays <= 0) return { fraction: 0, label: "" };
  return { fraction: activeDays / daysInMonth, label: `${activeDays}/${daysInMonth} days` };
}

function isMonthInAgreementRange(agreement: any, billingMonth: string): boolean {
  const [bmYear, bmMonth] = billingMonth.split("-").map(Number);
  const bmDate = new Date(bmYear, bmMonth - 1, 1);
  const bmEnd = new Date(bmYear, bmMonth, 0);

  if (agreement.startDate) {
    const start = new Date(agreement.startDate);
    if (start > bmEnd) return false;
  }

  if (agreement.endDate) {
    const end = new Date(agreement.endDate);
    const bmStart = new Date(bmYear, bmMonth - 1, 1);
    if (end < bmStart) return false;
  }

  return true;
}

export default function ToInvoicePage() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingElement, setEditingElement] = useState<any>(null);
  const [editHorseId, setEditHorseId] = useState("");
  const [editHorseSearch, setEditHorseSearch] = useState("");
  const [editHorseDropdownOpen, setEditHorseDropdownOpen] = useState(false);
  const [editItemId, setEditItemId] = useState("");
  const [editItemSearch, setEditItemSearch] = useState("");
  const [editItemDropdownOpen, setEditItemDropdownOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editFinalPrice, setEditFinalPrice] = useState("");
  const [editTransactionDate, setEditTransactionDate] = useState("");

  const [showHorseWarning, setShowHorseWarning] = useState(false);
  const [unassignedAgreements, setUnassignedAgreements] = useState<any[]>([]);
  const [preCheckLoading, setPreCheckLoading] = useState(false);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/sm2/customers"],
  });

  const { data: agreements = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/livery-agreements"],
  });

  const { data: billingElements = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/billing-elements", "?billed=false"],
  });

  const { data: nonLiveryItems = [] } = useQuery<Item[]>({
    queryKey: ["/api/sm2/items/non-livery-packages"],
  });

  const { data: allHorses = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/horses"],
  });

  const agreementIds = useMemo(() => agreements.map((a: any) => a.id), [agreements]);

  const { data: billedMonths = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/sm2/billed-months", agreementIds.join(",")],
    queryFn: async () => {
      if (agreementIds.length === 0) return {};
      const res = await fetch(`/api/sm2/billed-months?agreementIds=${agreementIds.join(",")}`);
      return res.json();
    },
    enabled: agreementIds.length > 0,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ customerId, lineItems }: { customerId: string; lineItems: LineItem[] }) => {
      const selected = lineItems.filter(li => selectedItems.has(li.key));
      if (selected.length === 0) return;

      let total = 0;
      const billingElementIds: string[] = [];
      const liveryItems: any[] = [];

      for (const li of selected) {
        total += li.amount;
        if (li.type === "billing" && li.billingElementId) {
          billingElementIds.push(li.billingElementId);
        } else if (li.type === "livery" && li.agreementId) {
          liveryItems.push({
            agreementId: li.agreementId,
            horseId: li.horseId,
            boxId: li.boxId,
            itemId: li.itemId,
            price: li.amount.toFixed(2),
            billingMonth: li.billingMonth,
          });
        }
      }

      return apiRequest("POST", "/api/sm2/invoices", {
        customerId,
        invoiceDate: new Date().toISOString().split("T")[0],
        billingMonth,
        totalAmount: total.toFixed(2),
        billingElementIds,
        liveryItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billing-elements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billed-months"] });
      setSelectedItems(new Set());
      toast({ title: "Invoice generated successfully" });
    },
  });

  const deleteBillingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sm2/billing-elements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billing-elements"] });
      toast({ title: "Billing element deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete billing element", variant: "destructive" });
    },
  });

  const editBillingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/sm2/billing-elements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/billing-elements"] });
      setShowEditDialog(false);
      toast({ title: "Billing element updated" });
    },
    onError: () => {
      toast({ title: "Failed to update billing element", variant: "destructive" });
    },
  });

  const handleGenerateClick = async (customerId: string, lineItems: LineItem[]) => {
    setPreCheckLoading(true);
    try {
      const res = await fetch(`/api/sm2/horse-assignment-check?billingMonth=${billingMonth}&customerId=${customerId}`, { credentials: "include" });
      if (!res.ok) {
        toast({ title: "Pre-check failed", description: "Could not verify horse assignments", variant: "destructive" });
        setPreCheckLoading(false);
        return;
      }
      const unassigned = await res.json();
      if (unassigned.length > 0) {
        setUnassignedAgreements(unassigned);
        setShowHorseWarning(true);
        setPreCheckLoading(false);
        return;
      }
      setPreCheckLoading(false);
      generateMutation.mutate({ customerId, lineItems });
    } catch {
      toast({ title: "Pre-check failed", variant: "destructive" });
      setPreCheckLoading(false);
    }
  };

  const openEditDialog = (li: LineItem) => {
    const be = billingElements.find((b: any) => b.id === li.billingElementId);
    if (!be) return;
    setEditingElement(be);
    setEditHorseId(be.horseId || "");
    setEditHorseSearch("");
    setEditHorseDropdownOpen(false);
    setEditItemId(be.itemId || "");
    setEditItemSearch("");
    setEditItemDropdownOpen(false);
    setEditQuantity(be.quantity || 1);
    setEditFinalPrice(be.price ? String(parseFloat(be.price)) : "");
    setEditTransactionDate(be.transactionDate || "");
    setShowEditDialog(true);
  };

  const editSelectedItem = nonLiveryItems.find(i => i.id === editItemId);
  const editItemPrice = editSelectedItem?.price ? parseFloat(editSelectedItem.price) : 0;
  const editItemUnitFactor = editSelectedItem?.unitFactor ? parseFloat(editSelectedItem.unitFactor) : 1;
  const editComputedPrice = editItemUnitFactor > 0 ? (editItemPrice / editItemUnitFactor) * editQuantity : 0;

  const handleEditItemChange = (val: string) => {
    setEditItemId(val);
    const item = nonLiveryItems.find(i => i.id === val);
    const price = item?.price ? parseFloat(item.price) : 0;
    const uf = item?.unitFactor ? parseFloat(item.unitFactor) : 1;
    const computed = uf > 0 ? (price / uf) * editQuantity : 0;
    setEditFinalPrice(computed.toFixed(2));
  };

  const handleEditQuantityChange = (newQty: number) => {
    setEditQuantity(newQty);
    if (editSelectedItem) {
      const computed = editItemUnitFactor > 0 ? (editItemPrice / editItemUnitFactor) * newQty : 0;
      setEditFinalPrice(computed.toFixed(2));
    }
  };

  const filteredEditItems = useMemo(() => {
    if (!editItemSearch.trim()) return nonLiveryItems;
    const search = editItemSearch.toLowerCase();
    return nonLiveryItems.filter((i: Item) =>
      i.name.toLowerCase().includes(search) ||
      (i.department && i.department.toLowerCase().includes(search)) ||
      (i.location && i.location.toLowerCase().includes(search))
    );
  }, [nonLiveryItems, editItemSearch]);

  const filteredEditHorses = useMemo(() => {
    const active = allHorses.filter((h: any) => h.status === "active");
    if (!editHorseSearch.trim()) return active;
    const s = editHorseSearch.toLowerCase();
    return active.filter((h: any) => h.horseName.toLowerCase().includes(s));
  }, [allHorses, editHorseSearch]);

  const selectedEditHorse = allHorses.find((h: any) => h.id === editHorseId);

  const billingMonthLabel = useMemo(() => {
    if (!billingMonth) return "";
    const [y, m] = billingMonth.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [billingMonth]);

  const activeAgreements = useMemo(() => {
    return agreements.filter((a: any) => a.status === "active" || a.status === "ended");
  }, [agreements]);

  const invoiceableCustomers = useMemo(() => {
    const customerIds = new Set<string>();
    activeAgreements.forEach((a: any) => customerIds.add(a.customerId));
    billingElements.forEach((b: any) => customerIds.add(b.customerId));

    return Array.from(customerIds).map(id => {
      const customer = customers.find(c => c.id === id);
      const customerAgreements = activeAgreements.filter((a: any) => a.customerId === id);
      const customerBilling = billingElements.filter((b: any) => b.customerId === id);

      const lineItems: LineItem[] = [];

      for (const a of customerAgreements) {
        if (!isMonthInAgreementRange(a, billingMonth)) continue;
        const alreadyBilled = billedMonths[a.id]?.includes(billingMonth);
        if (alreadyBilled) continue;

        const monthlyAmount = parseFloat(a.monthlyAmount || "0");
        const { fraction, label } = getProRateFraction(a, billingMonth);
        if (fraction <= 0) continue;

        const amount = monthlyAmount * fraction;

        lineItems.push({
          key: `livery-${a.id}-${billingMonth}`,
          type: "livery",
          description: a.itemName + (label ? ` (${label})` : ""),
          horseName: a.horseName,
          date: billingMonthLabel,
          qty: 1,
          unitPrice: monthlyAmount,
          amount,
          proRateLabel: label,
          agreementId: a.id,
          horseId: a.horseId,
          boxId: a.boxId,
          itemId: a.itemId,
          billingMonth,
        });
      }

      for (const b of customerBilling) {
        const bMonth = b.billingMonth || (b.transactionDate ? b.transactionDate.substring(0, 7) : null);
        if (bMonth && bMonth !== billingMonth) continue;
        const qty = b.quantity || 1;
        const totalPrice = parseFloat(b.price || "0");
        lineItems.push({
          key: `billing-${b.id}`,
          type: "billing",
          description: b.itemName,
          horseName: b.horseName,
          date: b.transactionDate,
          qty,
          unitPrice: qty > 0 ? totalPrice / qty : totalPrice,
          amount: totalPrice,
          billingElementId: b.id,
        });
      }

      const total = lineItems.reduce((sum, li) => sum + li.amount, 0);

      return {
        customerId: id,
        customerName: customer ? customer.fullname : "Unknown",
        lineItems,
        total,
      };
    }).filter(c => {
      if (c.lineItems.length === 0) return false;
      if (!customerSearch) return true;
      return c.customerName.toLowerCase().includes(customerSearch.toLowerCase());
    });
  }, [customers, activeAgreements, billingElements, customerSearch, billingMonth, billingMonthLabel, billedMonths]);

  const toggleItem = useCallback((key: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback((customerLineItems: LineItem[]) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      const allSelected = customerLineItems.every(li => next.has(li.key));
      if (allSelected) {
        customerLineItems.forEach(li => next.delete(li.key));
      } else {
        customerLineItems.forEach(li => next.add(li.key));
      }
      return next;
    });
  }, []);

  const getSelectedTotal = (lineItems: LineItem[]) => {
    return lineItems.filter(li => selectedItems.has(li.key)).reduce((sum, li) => sum + li.amount, 0);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="To Invoice"
        description="Select billable items and generate invoices for customers"
      />

      <div className="flex gap-3 mb-6 flex-wrap items-end">
        <SearchBar
          placeholder="Search customer..."
          value={customerSearch}
          onChange={setCustomerSearch}
          className="max-w-sm"
        />
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Billing Month</Label>
          <Input
            type="month"
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            className="w-48"
            data-testid="input-billing-month"
          />
        </div>
      </div>

      {invoiceableCustomers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          No invoiceable items found
        </div>
      ) : (
        <div className="space-y-4">
          {invoiceableCustomers.map((c) => {
            const allSelected = c.lineItems.length > 0 && c.lineItems.every(li => selectedItems.has(li.key));
            const someSelected = c.lineItems.some(li => selectedItems.has(li.key));
            const selectedTotal = getSelectedTotal(c.lineItems);

            return (
              <Card key={c.customerId}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      className={!allSelected && someSelected ? "opacity-70" : ""}
                      onCheckedChange={() => toggleAll(c.lineItems)}
                      data-testid={`checkbox-select-all-${c.customerId}`}
                    />
                    <CardTitle className="text-lg">{c.customerName}</CardTitle>
                  </div>
                  <Button
                    onClick={() => handleGenerateClick(c.customerId, c.lineItems)}
                    disabled={generateMutation.isPending || preCheckLoading || !someSelected}
                    data-testid={`button-generate-invoice-${c.customerId}`}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {preCheckLoading ? "Checking..." : "Generate Invoice"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Horse</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.lineItems.map((li) => (
                        <TableRow key={li.key}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(li.key)}
                              onCheckedChange={() => toggleItem(li.key)}
                              data-testid={`checkbox-item-${li.key}`}
                            />
                          </TableCell>
                          <TableCell>{li.type === "livery" ? "Livery Fee" : "Billing Element"}</TableCell>
                          <TableCell>{li.description}</TableCell>
                          <TableCell>{li.horseName || "—"}</TableCell>
                          <TableCell>{li.date}</TableCell>
                          <TableCell className="text-right">{li.qty}</TableCell>
                          <TableCell className="text-right">AED {li.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">AED {li.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {li.type === "billing" && li.billingElementId && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(li)}
                                  data-testid={`button-edit-billing-${li.billingElementId}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteBillingMutation.mutate(li.billingElementId!)}
                                  disabled={deleteBillingMutation.isPending}
                                  data-testid={`button-delete-billing-${li.billingElementId}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {someSelected && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={6} className="font-semibold">Selected Total</TableCell>
                          <TableCell className="text-right font-semibold">AED {selectedTotal.toFixed(2)}</TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={6} className="font-semibold text-muted-foreground">Grand Total (all items)</TableCell>
                        <TableCell className="text-right font-semibold text-muted-foreground">AED {c.total.toFixed(2)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Element</DialogTitle>
            <DialogDescription>Update the billing element details</DialogDescription>
          </DialogHeader>
          {editingElement && (
            <form
              onSubmit={(e) => { e.preventDefault(); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            >
              <div className="space-y-4">
                <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                  <div>Customer: <strong>{customers.find(c => c.id === editingElement.customerId)?.fullname || "Unknown"}</strong></div>
                </div>

                <div className="relative">
                  <Label>Horse</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-edit-horse-search"
                      placeholder="Search horse..."
                      value={selectedEditHorse && !editHorseDropdownOpen ? selectedEditHorse.horseName : editHorseSearch}
                      onChange={(e) => {
                        setEditHorseSearch(e.target.value);
                        setEditHorseDropdownOpen(true);
                        if (editHorseId) setEditHorseId("");
                      }}
                      onFocus={() => setEditHorseDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setEditHorseDropdownOpen(false), 200)}
                    />
                    {editHorseId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => { setEditHorseId(""); setEditHorseSearch(""); setEditHorseDropdownOpen(true); }}
                      >✕</button>
                    )}
                  </div>
                  {editHorseDropdownOpen && !editHorseId && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {filteredEditHorses.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No horses found</div>
                      ) : (
                        filteredEditHorses.map((h: any) => (
                          <button
                            type="button"
                            key={h.id}
                            data-testid={`edit-horse-option-${h.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => { setEditHorseId(h.id); setEditHorseSearch(""); setEditHorseDropdownOpen(false); }}
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

                <div className="relative">
                  <Label>Item</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-edit-item-search"
                      placeholder="Search items by name, department, or location..."
                      value={editSelectedItem && !editItemDropdownOpen ? `${editSelectedItem.name}${editSelectedItem.price ? ` - AED ${editSelectedItem.price}` : ""}` : editItemSearch}
                      onChange={(e) => {
                        setEditItemSearch(e.target.value);
                        setEditItemDropdownOpen(true);
                        if (editItemId) {
                          setEditItemId("");
                          setEditFinalPrice("");
                        }
                      }}
                      onFocus={() => setEditItemDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setEditItemDropdownOpen(false), 200)}
                    />
                    {editItemId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => {
                          setEditItemId("");
                          setEditItemSearch("");
                          setEditFinalPrice("");
                          setEditItemDropdownOpen(true);
                        }}
                        data-testid="button-edit-clear-item"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {editItemDropdownOpen && !editItemId && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {filteredEditItems.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No items found</div>
                      ) : (
                        filteredEditItems.map(i => (
                          <button
                            type="button"
                            key={i.id}
                            data-testid={`edit-item-option-${i.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => {
                              handleEditItemChange(i.id);
                              setEditItemSearch("");
                              setEditItemDropdownOpen(false);
                            }}
                          >
                            <div className="font-medium">{i.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {i.price ? `AED ${i.price}` : "No price"}{i.department ? ` · ${i.department}` : ""}{i.location ? ` · ${i.location}` : ""}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {editSelectedItem && (
                  <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Unit Factor:</span>
                      <span>{editItemUnitFactor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base Price (per unit factor):</span>
                      <span>AED {editItemPrice.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => handleEditQuantityChange(parseInt(e.target.value) || 1)}
                    data-testid="input-edit-quantity"
                  />
                </div>

                {editSelectedItem && (
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Label className="text-muted-foreground">Computed Price</Label>
                      <Input
                        type="text"
                        value={`AED ${editComputedPrice.toFixed(2)}`}
                        readOnly
                        className="bg-muted"
                        data-testid="text-edit-computed-price"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Final Selling Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editFinalPrice}
                        onChange={(e) => setEditFinalPrice(e.target.value)}
                        data-testid="input-edit-final-price"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Transaction Date</Label>
                  <Input
                    type="date"
                    value={editTransactionDate}
                    onChange={(e) => setEditTransactionDate(e.target.value)}
                    required
                    data-testid="input-edit-date"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  disabled={editBillingMutation.isPending || !editItemId || !editFinalPrice || !editTransactionDate || editQuantity < 1 || parseFloat(editFinalPrice) <= 0}
                  data-testid="button-submit-edit-billing"
                  onClick={() => {
                    if (!editTransactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(editTransactionDate)) return;
                    if (!editFinalPrice || parseFloat(editFinalPrice) <= 0) return;
                    editBillingMutation.mutate({
                      id: editingElement.id,
                      data: {
                        horseId: editHorseId || null,
                        itemId: editItemId,
                        quantity: editQuantity,
                        price: parseFloat(editFinalPrice).toFixed(2),
                        transactionDate: editTransactionDate,
                      },
                    });
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHorseWarning} onOpenChange={setShowHorseWarning}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Invoice generation blocked — the following boxes have no horse assigned for this period
            </DialogTitle>
            <DialogDescription>
              Please assign a horse via Horse Movements before generating invoices for {billingMonth}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Box</TableHead>
                  <TableHead>Package</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedAgreements.map((ua: any) => (
                  <TableRow key={ua.agreementId} data-testid={`row-unassigned-${ua.agreementId}`}>
                    <TableCell>{ua.customerName}</TableCell>
                    <TableCell>{ua.boxName}</TableCell>
                    <TableCell>{ua.itemName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHorseWarning(false)} data-testid="button-close-horse-warning">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
