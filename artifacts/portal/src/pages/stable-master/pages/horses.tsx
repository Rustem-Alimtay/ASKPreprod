import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { SearchBar } from "../components/search-bar";

import { ImportDialog } from "../components/import-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Upload, MoreVertical, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HorsesPage() {
  const userRole = useUserRole();
  const isAdmin = userRole === "ADMIN";
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [stableBoxSearch, setStableBoxSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingHorse, setEditingHorse] = useState<any>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [ownerComboOpen, setOwnerComboOpen] = useState(false);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [editOwnerId, setEditOwnerId] = useState<string>("");
  const [editOwnerComboOpen, setEditOwnerComboOpen] = useState(false);
  const [editOwnerSearchTerm, setEditOwnerSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: allCustomers = [] } = useQuery<any[]>({
    queryKey: ["/api/sm2/customers"],
  });

  const filteredCustomers = useMemo(() => {
    if (!ownerSearchTerm) return allCustomers;
    return allCustomers.filter((c: any) =>
      c.fullname.toLowerCase().includes(ownerSearchTerm.toLowerCase())
    );
  }, [allCustomers, ownerSearchTerm]);

  const filteredEditCustomers = useMemo(() => {
    if (!editOwnerSearchTerm) return allCustomers;
    return allCustomers.filter((c: any) =>
      c.fullname.toLowerCase().includes(editOwnerSearchTerm.toLowerCase())
    );
  }, [allCustomers, editOwnerSearchTerm]);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (customerSearch) queryParams.set("customerSearch", customerSearch);
  if (stableBoxSearch) queryParams.set("stableBoxSearch", stableBoxSearch);
  const qs = queryParams.toString();

  const { data: horses = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/horses", qs ? `?${qs}` : ""],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/horses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      setShowCreateDialog(false);
      toast({ title: "Horse created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sm2/horses/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      setShowEditDialog(false);
      toast({ title: "Horse updated successfully" });
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/horses/import", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      setShowImportDialog(false);
      toast({ title: "Horses imported successfully" });
    },
  });

  const columns = [
    { key: "horseName", label: "Horse Name" },
    {
      key: "ownerName",
      label: "Owner",
      render: (item: any) => item.ownerName || "-",
    },
    { key: "breed", label: "Breed", render: (item: any) => item.breed || "-" },
    { key: "dateOfBirth", label: "Date of Birth", render: (item: any) => item.dateOfBirth || "-" },
    {
      key: "stableBox",
      label: "Stable / Box",
      render: (item: any) => item.stable && item.box ? `${item.stable} / ${item.box}` : "-",
    },
  ];

  const importFields = [
    { targetField: "netsuiteId", label: "NetSuite ID" },
    { targetField: "horseName", label: "Horse Name", required: true },
    { targetField: "breed", label: "Breed" },
    { targetField: "dateOfBirth", label: "Date of Birth" },
    { targetField: "sex", label: "Sex" },
    { targetField: "color", label: "Color" },
    { targetField: "size", label: "Size" },
    { targetField: "passportName", label: "Passport Name" },
    { targetField: "passportNumber", label: "Passport Number" },
  ];

  const handleImport = (data: Record<string, string>[]) => {
    const mapped = data.map(row => ({
      netsuiteId: row.netsuiteId || null,
      horseName: row.horseName || "Unknown",
      breed: row.breed || null,
      dateOfBirth: row.dateOfBirth || null,
      sex: row.sex || null,
      color: row.color || null,
      size: row.size || null,
      passportName: row.passportName || null,
      passportNumber: row.passportNumber || null,
      status: "active",
    }));
    importMutation.mutate({ horses: mapped });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Horses"
        description="Manage horses used in livery agreements"
        actions={isAdmin ? (
          <>
            <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-horses">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-horse">
              <Plus className="w-4 h-4 mr-2" />
              New Horse
            </Button>
          </>
        ) : undefined}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchBar placeholder="Horse name..." value={search} onChange={setSearch} className="w-52" />
        <SearchBar placeholder="Customer..." value={customerSearch} onChange={setCustomerSearch} className="w-52" />
        <SearchBar placeholder="Stable / Box..." value={stableBoxSearch} onChange={setStableBoxSearch} className="w-52" />
      </div>

      <DataTable
        columns={columns}
        data={horses}
        isLoading={isLoading}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-actions-${item.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => { setEditingHorse(item); setEditOwnerId(item.ownerId || ""); setShowEditDialog(true); }}
                data-testid={`button-edit-${item.id}`}
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) { setSelectedOwnerId(""); setOwnerSearchTerm(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Horse</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedOwnerId) {
                toast({ title: "Owner is required", variant: "destructive" });
                return;
              }
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                horseName: fd.get("horseName"),
                breed: fd.get("breed") || null,
                dateOfBirth: fd.get("dateOfBirth") || null,
                sex: fd.get("sex") || null,
                color: fd.get("color") || null,
                size: fd.get("size") || null,
                status: "active",
                ownerId: selectedOwnerId,
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label>Owner <span className="text-destructive">*</span></Label>
                <Popover open={ownerComboOpen} onOpenChange={setOwnerComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={ownerComboOpen}
                      className="w-full justify-between font-normal"
                      data-testid="select-owner"
                    >
                      {selectedOwnerId
                        ? allCustomers.find((c: any) => c.id === selectedOwnerId)?.fullname || "Select owner..."
                        : "Select owner..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search customers..."
                        value={ownerSearchTerm}
                        onValueChange={setOwnerSearchTerm}
                        data-testid="input-owner-search"
                      />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {filteredCustomers.map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setSelectedOwnerId(c.id);
                                setOwnerComboOpen(false);
                                setOwnerSearchTerm("");
                              }}
                              data-testid={`option-owner-${c.id}`}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedOwnerId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.fullname}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Horse Name</Label>
                <Input name="horseName" required data-testid="input-horse-name" />
              </div>
              <div>
                <Label>Breed</Label>
                <Input name="breed" data-testid="input-breed" />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input name="dateOfBirth" type="date" data-testid="input-dob" />
              </div>
              <div>
                <Label>Sex</Label>
                <Input name="sex" data-testid="input-sex" />
              </div>
              <div>
                <Label>Color</Label>
                <Input name="color" data-testid="input-color" />
              </div>
              <div>
                <Label>Size</Label>
                <Input name="size" data-testid="input-size" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-horse">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) { setEditOwnerId(""); setEditOwnerSearchTerm(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Horse</DialogTitle>
          </DialogHeader>
          {editingHorse && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editingHorse.id,
                  horseName: fd.get("horseName"),
                  breed: fd.get("breed") || null,
                  dateOfBirth: fd.get("dateOfBirth") || null,
                  sex: fd.get("sex") || null,
                  color: fd.get("color") || null,
                  size: fd.get("size") || null,
                  status: fd.get("status") || "active",
                  ownerId: editOwnerId || undefined,
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label>Owner</Label>
                  <Popover open={editOwnerComboOpen} onOpenChange={setEditOwnerComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editOwnerComboOpen}
                        className="w-full justify-between font-normal"
                        data-testid="select-edit-owner"
                      >
                        {editOwnerId
                          ? allCustomers.find((c: any) => c.id === editOwnerId)?.fullname || "Select owner..."
                          : "Select owner..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search customers..."
                          value={editOwnerSearchTerm}
                          onValueChange={setEditOwnerSearchTerm}
                          data-testid="input-edit-owner-search"
                        />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {filteredEditCustomers.map((c: any) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => {
                                  setEditOwnerId(c.id);
                                  setEditOwnerComboOpen(false);
                                  setEditOwnerSearchTerm("");
                                }}
                                data-testid={`option-edit-owner-${c.id}`}
                              >
                                <Check className={cn("mr-2 h-4 w-4", editOwnerId === c.id ? "opacity-100" : "opacity-0")} />
                                {c.fullname}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Horse Name</Label>
                  <Input name="horseName" defaultValue={editingHorse.horseName} required data-testid="input-edit-horse-name" />
                </div>
                <div>
                  <Label>Breed</Label>
                  <Input name="breed" defaultValue={editingHorse.breed || ""} data-testid="input-edit-breed" />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input name="dateOfBirth" type="date" defaultValue={editingHorse.dateOfBirth || ""} data-testid="input-edit-dob" />
                </div>
                <div>
                  <Label>Sex</Label>
                  <Input name="sex" defaultValue={editingHorse.sex || ""} data-testid="input-edit-sex" />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input name="color" defaultValue={editingHorse.color || ""} data-testid="input-edit-color" />
                </div>
                <div>
                  <Label>Size</Label>
                  <Input name="size" defaultValue={editingHorse.size || ""} data-testid="input-edit-size" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Input name="status" defaultValue={editingHorse.status} data-testid="input-edit-status" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-horse">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        title="Import Horses"
        fields={importFields}
        onImport={handleImport}
        isPending={importMutation.isPending}
      />
    </div>
  );
}
