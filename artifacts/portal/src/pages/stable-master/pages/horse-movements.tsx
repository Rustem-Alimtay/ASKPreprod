import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoveRight, X, Search, LogOut } from "lucide-react";

interface BoxGridItem {
  id: string;
  name: string;
  type: string;
  stableId: string;
  stableName: string;
  status: string;
  isOccupied: boolean;
  hasAgreement: boolean;
  movementId: string | null;
  horseId: string | null;
  horseName: string | null;
  customerId: string | null;
  customerName: string | null;
  agreementId: string | null;
  itemName: string | null;
  monthlyAmount: string | null;
  checkIn: string | null;
}

interface EnrichedMovement {
  id: string;
  agreementId: string | null;
  horseId: string;
  stableboxId: string;
  checkIn: string;
  checkOut: string | null;
  createdAt: string;
  horseName: string;
  customerName: string;
  boxName: string;
  stableName: string;
}

interface HorseOwnershipEntry {
  id: string;
  horseId: string;
  customerId: string;
}

interface HorseEntry {
  id: string;
  horseName: string;
  status: string;
}

export default function HorseMovementsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedBox, setSelectedBox] = useState<BoxGridItem | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [targetBoxId, setTargetBoxId] = useState("");
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [checkinHorseId, setCheckinHorseId] = useState("");
  const [checkinDate, setCheckinDate] = useState(new Date().toISOString().split("T")[0]);
  const [stableFilter, setStableFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [horseFilter, setHorseFilter] = useState("");
  const [logCustomerFilter, setLogCustomerFilter] = useState("");
  const [logBoxFilter, setLogBoxFilter] = useState("");

  const { data: boxGrid = [], isLoading: gridLoading } = useQuery<BoxGridItem[]>({
    queryKey: ["/api/sm2/box-grid"],
  });

  const { data: movementLog = [], isLoading: logLoading } = useQuery<EnrichedMovement[]>({
    queryKey: ["/api/sm2/horse-movements/enriched"],
  });

  const { data: customerHorses = [] } = useQuery<HorseOwnershipEntry[]>({
    queryKey: ["/api/sm2/horse-ownership/customer", selectedBox?.customerId],
    enabled: !!selectedBox?.customerId && checkinDialogOpen,
  });

  const { data: allHorses = [] } = useQuery<HorseEntry[]>({
    queryKey: ["/api/sm2/horses"],
    enabled: checkinDialogOpen,
  });

  const activeHorseIds = useMemo(() => {
    return new Set(boxGrid.filter(b => b.isOccupied && b.horseId).map(b => b.horseId!));
  }, [boxGrid]);

  const eligibleCheckinHorses = useMemo(() => {
    const customerHorseIds = new Set(customerHorses.map(ch => ch.horseId));
    return allHorses.filter(h =>
      customerHorseIds.has(h.id) &&
      !activeHorseIds.has(h.id) &&
      h.status === "active"
    );
  }, [customerHorses, allHorses, activeHorseIds]);

  const stables = useMemo(() => {
    const set = new Set(boxGrid.map(b => b.stableName));
    return Array.from(set).sort();
  }, [boxGrid]);

  const filteredGrid = useMemo(() => {
    let result = boxGrid;
    if (stableFilter !== "all") {
      result = result.filter(b => b.stableName === stableFilter);
    }
    if (customerFilter) {
      result = result.filter(b => b.customerName?.toLowerCase().includes(customerFilter.toLowerCase()));
    }
    if (horseFilter) {
      result = result.filter(b => b.horseName?.toLowerCase().includes(horseFilter.toLowerCase()));
    }
    return result;
  }, [boxGrid, stableFilter, customerFilter, horseFilter]);

  const groupedByStable = useMemo(() => {
    const groups: Record<string, BoxGridItem[]> = {};
    filteredGrid.forEach(b => {
      if (!groups[b.stableName]) groups[b.stableName] = [];
      groups[b.stableName].push(b);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => a.name.localeCompare(b.name)));
    return groups;
  }, [filteredGrid]);

  const emptyBoxes = useMemo(() => {
    return boxGrid.filter(b => !b.isOccupied && !b.hasAgreement);
  }, [boxGrid]);

  const customerMoveTargets = useMemo(() => {
    if (!selectedBox?.customerId) return [];
    return boxGrid.filter(b =>
      b.id !== selectedBox.id &&
      !b.isOccupied &&
      b.customerId === selectedBox.customerId
    );
  }, [boxGrid, selectedBox]);

  const today = new Date().toISOString().split("T")[0];

  const filteredLog = useMemo(() => {
    let result = movementLog;
    if (logCustomerFilter) {
      result = result.filter(m => m.customerName.toLowerCase().includes(logCustomerFilter.toLowerCase()));
    }
    if (logBoxFilter) {
      result = result.filter(m => m.boxName.toLowerCase().includes(logBoxFilter.toLowerCase()) || m.stableName.toLowerCase().includes(logBoxFilter.toLowerCase()));
    }
    return result;
  }, [movementLog, logCustomerFilter, logBoxFilter]);

  const moveMutation = useMutation({
    mutationFn: async (data: { movementId: string; newBoxId: string }) => {
      const res = await apiRequest("POST", "/api/sm2/horse-movements/move", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/box-grid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements/enriched"] });
      setMoveDialogOpen(false);
      setSelectedBox(null);
      setTargetBoxId("");
      toast({ title: "Horse moved successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: { movementId: string; checkOutDate: string }) =>
      apiRequest("PATCH", `/api/sm2/horse-movements/${data.movementId}`, {
        checkOut: data.checkOutDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/box-grid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements/enriched"] });
      setCheckoutDialogOpen(false);
      setSelectedBox(null);
      setCheckoutDate(new Date().toISOString().split("T")[0]);
      toast({ title: "Horse checked out of box successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async (data: { agreementId: string; horseId: string; stableboxId: string; checkIn: string }) => {
      const res = await apiRequest("POST", "/api/sm2/horse-movements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/box-grid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horse-movements/enriched"] });
      setCheckinDialogOpen(false);
      setSelectedBox(null);
      setCheckinHorseId("");
      setCheckinDate(new Date().toISOString().split("T")[0]);
      toast({ title: "Horse checked in successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  const handleBoxClick = (box: BoxGridItem) => {
    setSelectedBox(prev => prev?.id === box.id ? null : box);
  };

  const handleMove = () => {
    if (!selectedBox?.movementId || !targetBoxId) return;
    moveMutation.mutate({ movementId: selectedBox.movementId, newBoxId: targetBoxId });
  };

  const handleCheckin = () => {
    if (!selectedBox?.agreementId || !checkinHorseId || !selectedBox?.id) return;
    checkinMutation.mutate({
      agreementId: selectedBox.agreementId,
      horseId: checkinHorseId,
      stableboxId: selectedBox.id,
      checkIn: checkinDate,
    });
  };

  const handleCheckout = () => {
    if (!selectedBox?.movementId || !checkoutDate) return;
    checkoutMutation.mutate({ movementId: selectedBox.movementId, checkOutDate: checkoutDate });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const occupiedCount = boxGrid.filter(b => b.isOccupied).length;
  const totalCount = boxGrid.length;

  const getCustomerShortName = (name: string | null) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length <= 1) return name;
    return parts[0];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Horse Movements</h1>
          <p className="text-muted-foreground" data-testid="text-occupancy-summary">
            {occupiedCount} occupied / {totalCount} total boxes
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={stableFilter} onValueChange={setStableFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-stable-filter">
            <SelectValue placeholder="All Stables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stables</SelectItem>
            {stables.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by customer..."
            className="pl-8 w-[180px]"
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            data-testid="input-filter-grid-customer"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by horse..."
            className="pl-8 w-[180px]"
            value={horseFilter}
            onChange={e => setHorseFilter(e.target.value)}
            data-testid="input-filter-grid-horse"
          />
        </div>
        <div className="flex gap-3 ml-auto text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted border border-border" />
            <span>Empty</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {gridLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading boxes...</p>
          </div>
        ) : Object.keys(groupedByStable).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No boxes match your filters
          </div>
        ) : (
          Object.entries(groupedByStable).map(([stableName, stableBoxes]) => (
            <fieldset key={stableName} className="border border-border rounded-lg p-4">
              <legend className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground" data-testid={`text-stable-group-${stableName}`}>
                {stableName}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {stableBoxes.map(box => {
                  const isSelected = selectedBox?.id === box.id;
                  return (
                    <button
                      key={box.id}
                      onClick={() => handleBoxClick(box)}
                      className={`relative p-3 rounded-lg border text-left transition-all cursor-pointer min-h-[100px] flex flex-col justify-between ${
                        isSelected
                          ? "ring-2 ring-primary border-primary"
                          : box.isOccupied
                            ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60"
                            : box.hasAgreement
                              ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60"
                              : "bg-muted/30 border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                      data-testid={`box-cell-${box.id}`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground" data-testid={`text-box-name-${box.id}`}>
                          {box.name}
                        </div>
                        {box.isOccupied ? (
                          <>
                            <div className="text-sm font-bold mt-1 truncate" data-testid={`text-horse-name-${box.id}`}>
                              {box.horseName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" data-testid={`text-customer-name-${box.id}`}>
                              {box.customerName}
                            </div>
                          </>
                        ) : box.hasAgreement ? (
                          <>
                            <div className="text-sm italic text-amber-600 dark:text-amber-400 mt-1" data-testid={`text-horse-name-${box.id}`}>
                              No horse checked in
                            </div>
                            <div className="text-xs text-muted-foreground truncate" data-testid={`text-customer-name-${box.id}`}>
                              {box.customerName}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm italic text-muted-foreground mt-1" data-testid={`text-horse-name-${box.id}`}>
                              No horse
                            </div>
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        {box.isOccupied ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30" data-testid={`badge-status-${box.id}`}>
                            {getCustomerShortName(box.customerName)}
                          </Badge>
                        ) : box.hasAgreement ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500/50 text-amber-600 dark:text-amber-400" data-testid={`badge-status-${box.id}`}>
                            Agreement active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5" data-testid={`badge-status-${box.id}`}>
                            Unassigned
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))
        )}
      </div>

      <Dialog open={!!selectedBox} onOpenChange={(open) => { if (!open) setSelectedBox(null); }}>
        <DialogContent className="max-w-md" data-testid="card-box-detail">
          <DialogHeader>
            <DialogTitle data-testid="text-detail-title">
              Box {selectedBox?.name} {(selectedBox?.isOccupied || selectedBox?.hasAgreement) ? `· ${getCustomerShortName(selectedBox.customerName)}` : ""}
            </DialogTitle>
            <DialogDescription data-testid="text-detail-checkin">
              {selectedBox?.isOccupied
                ? `Occupied since ${formatDate(selectedBox.checkIn)}`
                : selectedBox?.hasAgreement
                  ? "Agreement active — no horse checked in"
                  : "Empty box — no horse currently assigned"}
            </DialogDescription>
          </DialogHeader>

          {selectedBox?.isOccupied ? (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horse</span>
                  <span className="font-semibold" data-testid="text-detail-horse">{selectedBox.horseName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold" data-testid="text-detail-customer">{selectedBox.customerName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-semibold" data-testid="text-detail-package">{selectedBox.itemName || "—"}</span>
                </div>
                {selectedBox.monthlyAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agreed price</span>
                    <span className="font-semibold" data-testid="text-detail-price">AED {parseFloat(selectedBox.monthlyAmount).toLocaleString()} / month</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setMoveDialogOpen(true)}
                    disabled={customerMoveTargets.length === 0}
                    data-testid="button-move-horse"
                  >
                    <MoveRight className="w-4 h-4 mr-2" />
                    Move to another box
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCheckoutDialogOpen(true)}
                    disabled={!selectedBox.movementId}
                    data-testid="button-checkout-horse"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Check out horse
                  </Button>
                </div>
              </div>
            </div>
          ) : selectedBox?.hasAgreement ? (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold" data-testid="text-detail-customer">{selectedBox.customerName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-semibold" data-testid="text-detail-package">{selectedBox.itemName || "—"}</span>
                </div>
                {selectedBox.monthlyAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agreed price</span>
                    <span className="font-semibold" data-testid="text-detail-price">AED {parseFloat(selectedBox.monthlyAmount).toLocaleString()} / month</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400">This box has an active agreement but no horse is currently checked in.</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCheckinDialogOpen(true)}
                  data-testid="button-checkin-horse"
                >
                  <MoveRight className="w-4 h-4 mr-2" />
                  Check in a horse
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">This box has no horse assigned.</p>
              <Button
                variant="outline"
                onClick={() => navigate("/stable-master/agreements/new")}
                data-testid="button-create-agreement"
              >
                Create new agreement
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold" data-testid="text-movement-log-title">Movement Log</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by customer..."
              className="pl-8 w-[200px]"
              value={logCustomerFilter}
              onChange={e => setLogCustomerFilter(e.target.value)}
              data-testid="input-filter-customer"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by box/stable..."
              className="pl-8 w-[200px]"
              value={logBoxFilter}
              onChange={e => setLogBoxFilter(e.target.value)}
              data-testid="input-filter-box"
            />
          </div>
        </div>

        {logLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading movements...</p>
          </div>
        ) : filteredLog.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-movements">
            No movement records found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Horse</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Box</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLog.map(m => (
                  <TableRow key={m.id} data-testid={`row-movement-${m.id}`}>
                    <TableCell className="text-muted-foreground" data-testid={`text-log-date-${m.id}`}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-log-horse-${m.id}`}>{m.horseName}</TableCell>
                    <TableCell data-testid={`text-log-customer-${m.id}`}>{m.customerName}</TableCell>
                    <TableCell data-testid={`text-log-box-${m.id}`}>{m.boxName} ({m.stableName})</TableCell>
                    <TableCell data-testid={`text-log-checkin-${m.id}`}>{formatDate(m.checkIn)}</TableCell>
                    <TableCell data-testid={`text-log-checkout-${m.id}`}>{formatDate(m.checkOut)}</TableCell>
                    <TableCell>
                      {m.checkOut ? (
                        <Badge variant="secondary" data-testid={`badge-status-${m.id}`}>Closed</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30" data-testid={`badge-status-${m.id}`}>Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={moveDialogOpen} onOpenChange={(open) => { setMoveDialogOpen(open); if (!open) setTargetBoxId(""); }}>
        <DialogContent data-testid="dialog-move-horse">
          <DialogHeader>
            <DialogTitle>Move {selectedBox?.horseName} to another box</DialogTitle>
            <DialogDescription>Select a box under {selectedBox?.customerName}'s agreements to move this horse to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Currently in: <strong>{selectedBox?.name}</strong> ({selectedBox?.stableName})
            </p>
            {customerMoveTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No other available boxes under this customer's agreements.</p>
            ) : (
              <Select value={targetBoxId} onValueChange={setTargetBoxId}>
                <SelectTrigger data-testid="select-target-box">
                  <SelectValue placeholder="Select target box..." />
                </SelectTrigger>
                <SelectContent>
                  {customerMoveTargets.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name} — {b.stableName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)} data-testid="button-cancel-move">Cancel</Button>
            <Button onClick={handleMove} disabled={!targetBoxId || moveMutation.isPending} data-testid="button-confirm-move">
              {moveMutation.isPending ? "Moving..." : "Confirm Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutDialogOpen} onOpenChange={(open) => { setCheckoutDialogOpen(open); if (!open) { setCheckoutDate(new Date().toISOString().split("T")[0]); } }}>
        <DialogContent data-testid="dialog-checkout-horse">
          <DialogHeader>
            <DialogTitle>Check out {selectedBox?.horseName}</DialogTitle>
            <DialogDescription>Remove the horse from {selectedBox?.name}. The livery agreement will remain active.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Checkout Date</Label>
              <Input
                type="date"
                value={checkoutDate}
                max={today}
                onChange={e => setCheckoutDate(e.target.value)}
                data-testid="input-checkout-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)} data-testid="button-cancel-checkout">Cancel</Button>
            <Button onClick={handleCheckout} disabled={!checkoutDate || checkoutMutation.isPending} data-testid="button-confirm-checkout">
              {checkoutMutation.isPending ? "Processing..." : "Confirm Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkinDialogOpen} onOpenChange={(open) => { setCheckinDialogOpen(open); if (!open) { setCheckinHorseId(""); setCheckinDate(new Date().toISOString().split("T")[0]); } }}>
        <DialogContent data-testid="dialog-checkin-horse">
          <DialogHeader>
            <DialogTitle>Check in a horse</DialogTitle>
            <DialogDescription>Select a horse owned by {selectedBox?.customerName || "the customer"} to check into {selectedBox?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Horse</Label>
              <Select value={checkinHorseId} onValueChange={setCheckinHorseId}>
                <SelectTrigger data-testid="select-checkin-horse">
                  <SelectValue placeholder="Select a horse..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleCheckinHorses.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.horseName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleCheckinHorses.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">No available horses for this customer.</p>
              )}
            </div>
            <div>
              <Label>Check-in Date</Label>
              <Input
                type="date"
                value={checkinDate}
                max={today}
                onChange={e => setCheckinDate(e.target.value)}
                data-testid="input-checkin-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinDialogOpen(false)} data-testid="button-cancel-checkin">Cancel</Button>
            <Button onClick={handleCheckin} disabled={!checkinHorseId || !checkinDate || checkinMutation.isPending} data-testid="button-confirm-checkin">
              {checkinMutation.isPending ? "Processing..." : "Confirm Check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
