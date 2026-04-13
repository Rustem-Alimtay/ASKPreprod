import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { SearchBar } from "../components/search-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import type { Customer, Item } from "@shared/sm2";

export default function NewAgreementPage() {
  const [stableSearch, setStableSearch] = useState("");
  const [boxSearch, setBoxSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBox, setSelectedBox] = useState<any>(null);
  const [agreementType, setAgreementType] = useState("permanent");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInAgreement, setCheckInAgreement] = useState<any>(null);
  const [checkInBoxName, setCheckInBoxName] = useState("");
  const [selectedCheckInHorseId, setSelectedCheckInHorseId] = useState("");
  const [checkInHorseSearch, setCheckInHorseSearch] = useState("");
  const [checkInHorseDropdownOpen, setCheckInHorseDropdownOpen] = useState(false);

  const { toast } = useToast();

  const { data: boxesWithStatus = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/boxes-with-status"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/sm2/customers"],
  });

  const { data: liveryItems = [] } = useQuery<Item[]>({
    queryKey: ["/api/sm2/items/livery-packages"],
  });

  const { data: customerHorses = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/horse-ownership/customer", selectedCustomerId || checkInAgreement?.customerId, "checkin-eligible"],
    queryFn: async () => {
      const custId = checkInAgreement?.customerId || selectedCustomerId;
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
    enabled: !!(checkInAgreement?.customerId || selectedCustomerId),
  });

  const checkInMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/horse-movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements"] });
      setShowCheckInModal(false);
      toast({ title: "Horse checked in successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to check in horse", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/livery-agreements", data),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/livery-agreements"] });
      setShowCreateDialog(false);

      const agreement = await res.json();
      setCheckInAgreement({ ...agreement, customerId: selectedCustomerId });
      setCheckInBoxName(selectedBox?.name || "");
      setSelectedCheckInHorseId("");
      setCheckInHorseSearch("");
      setShowCheckInModal(true);

      toast({ title: "Livery agreement created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create agreement", description: error.message, variant: "destructive" });
    },
  });

  const filteredBoxes = useMemo(() => {
    let result = boxesWithStatus;
    if (stableSearch) {
      result = result.filter(b => b.stableName.toLowerCase().includes(stableSearch.toLowerCase()));
    }
    if (boxSearch) {
      result = result.filter(b => b.name.toLowerCase().includes(boxSearch.toLowerCase()));
    }
    return result;
  }, [boxesWithStatus, stableSearch, boxSearch]);

  const groupedByStable = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const box of filteredBoxes) {
      if (!groups[box.stableName]) groups[box.stableName] = [];
      groups[box.stableName].push(box);
    }
    return groups;
  }, [filteredBoxes]);

  const activeCustomers = useMemo(() => {
    const active = customers.filter(c => c.status === "active");
    if (!customerSearch.trim()) return active;
    const s = customerSearch.toLowerCase();
    return active.filter(c =>
      (c.fullname || '').toLowerCase().includes(s) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedItem = liveryItems.find(i => i.id === selectedItemId);

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = liveryItems.find(i => i.id === itemId);
    setMonthlyAmount(item?.price || "0");
  };

  const openCreateDialog = (box: any) => {
    setSelectedBox(box);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setSelectedItemId("");
    setMonthlyAmount("");
    setAgreementType("permanent");
    setShowCreateDialog(true);
  };

  const filteredCheckInHorses = useMemo(() => {
    if (!checkInHorseSearch.trim()) return customerHorses;
    const s = checkInHorseSearch.toLowerCase();
    return customerHorses.filter((h: any) => h.horseName.toLowerCase().includes(s));
  }, [customerHorses, checkInHorseSearch]);

  const selectedCheckInHorse = customerHorses.find((h: any) => h.id === selectedCheckInHorseId);

  return (
    <div className="p-6">
      <PageHeader
        title="New Agreement"
        description="Create livery agreements by selecting available boxes"
      />

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <SearchBar placeholder="Search stable..." value={stableSearch} onChange={setStableSearch} className="w-52" />
        <SearchBar placeholder="Search box..." value={boxSearch} onChange={setBoxSearch} className="w-52" />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading boxes...</div>
      ) : Object.keys(groupedByStable).length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No boxes found matching your criteria</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByStable).map(([stableName, stableBoxes]) => (
            <fieldset key={stableName} className="border border-border rounded-lg p-4">
              <legend className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground" data-testid={`text-stable-group-${stableName}`}>
                {stableName}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {stableBoxes.map((box) => (
                  <div
                    key={box.id}
                    className={`relative p-3 rounded-lg border text-left min-h-[100px] flex flex-col justify-between ${
                      box.isAvailable
                        ? "bg-muted/30 border-border"
                        : "bg-emerald-500/10 border-emerald-500/30 opacity-60"
                    }`}
                    data-testid={`box-cell-${box.id}`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {box.name}
                      </div>
                      {box.isAvailable ? (
                        <div className="text-sm italic text-muted-foreground mt-1">
                          Available
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-bold mt-1 truncate">
                            {box.horseName || "Occupied"}
                          </div>
                          {box.customerName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {box.customerName}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      {box.isAvailable ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => openCreateDialog(box)}
                          data-testid={`button-new-agreement-${box.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          New Agreement
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          Occupied
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Livery Agreement</DialogTitle>
            <DialogDescription>Create a new livery agreement for the selected box</DialogDescription>
          </DialogHeader>
          {selectedBox && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const refNum = `LA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
                createMutation.mutate({
                  referenceNumber: refNum,
                  agreementCategory: "with_horse",
                  customerId: selectedCustomerId,
                  boxId: selectedBox.id,
                  itemId: selectedItemId,
                  startDate: fd.get("startDate"),
                  endDate: agreementType === "temporary" ? fd.get("endDate") : null,
                  type: agreementType,
                  status: "active",
                  notes: fd.get("notes") || null,
                  monthlyAmount: monthlyAmount || selectedItem?.price || "0",
                });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            >
              <div className="space-y-4">
                <div className="p-3 rounded-md bg-muted text-sm">
                  Box: <strong>{selectedBox.name}</strong> ({selectedBox.stableName})
                </div>

                <div className="relative">
                  <Label>Customer</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-agreement-customer-search"
                      placeholder="Search customer..."
                      value={selectedCustomer && !customerDropdownOpen ? selectedCustomer.fullname : customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setCustomerDropdownOpen(true);
                        if (selectedCustomerId) setSelectedCustomerId("");
                      }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                    />
                    {selectedCustomerId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => { setSelectedCustomerId(""); setCustomerSearch(""); setCustomerDropdownOpen(true); }}
                      >✕</button>
                    )}
                  </div>
                  {customerDropdownOpen && !selectedCustomerId && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {activeCustomers.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No customers found</div>
                      ) : (
                        activeCustomers.map(c => (
                          <button
                            type="button"
                            key={c.id}
                            data-testid={`agreement-customer-option-${c.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(""); setCustomerDropdownOpen(false); }}
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
                  <Select value={selectedItemId} onValueChange={handleItemChange}>
                    <SelectTrigger data-testid="select-agreement-item">
                      <SelectValue placeholder="Select livery package..." />
                    </SelectTrigger>
                    <SelectContent>
                      {liveryItems.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name} (AED {i.price}/mo)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItem && (
                  <div>
                    <Label>Monthly Amount (AED)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={monthlyAmount}
                        onChange={(e) => setMonthlyAmount(e.target.value)}
                        data-testid="input-monthly-amount"
                      />
                      {monthlyAmount !== selectedItem.price && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setMonthlyAmount(selectedItem.price || "0")}
                          data-testid="button-reset-price"
                          className="text-xs whitespace-nowrap"
                        >
                          Reset to {selectedItem.price}
                        </Button>
                      )}
                    </div>
                    {monthlyAmount !== selectedItem.price && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Default package price: AED {selectedItem.price}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label>Start Date</Label>
                  <Input name="startDate" type="date" required data-testid="input-agreement-start" />
                </div>

                <div>
                  <Label>Type</Label>
                  <Select value={agreementType} onValueChange={setAgreementType}>
                    <SelectTrigger data-testid="select-agreement-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {agreementType === "temporary" && (
                  <div>
                    <Label>End Date</Label>
                    <Input name="endDate" type="date" required data-testid="input-agreement-end" />
                  </div>
                )}

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea name="notes" placeholder="Additional notes..." data-testid="input-agreement-notes" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={createMutation.isPending || !selectedCustomerId || !selectedItemId} data-testid="button-submit-agreement">
                  Create Agreement
                </Button>
              </DialogFooter>
            </form>
          )}
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
              Do you want to check a horse into box <strong>{checkInBoxName}</strong> now?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Label>Select Horse</Label>
              <div className="relative">
                <Input
                  data-testid="input-checkin-horse-search"
                  placeholder="Search horse..."
                  value={selectedCheckInHorse && !checkInHorseDropdownOpen ? selectedCheckInHorse.horseName : checkInHorseSearch}
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
                  {filteredCheckInHorses.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No horses found for this customer</div>
                  ) : (
                    filteredCheckInHorses.map((h: any) => (
                      <button
                        type="button"
                        key={h.id}
                        data-testid={`checkin-horse-option-${h.id}`}
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
              data-testid="button-skip-checkin"
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
              data-testid="button-confirm-checkin"
            >
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
