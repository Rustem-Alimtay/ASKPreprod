import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { SearchBar } from "../components/search-bar";

import { ImportDialog } from "../components/import-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MoreVertical, Trash2, Upload } from "lucide-react";
import type { Stable } from "@shared/sm2";

export default function BoxesPage() {
  const userRole = useUserRole();
  const isAdmin = userRole === "ADMIN";
  const [stableSearch, setStableSearch] = useState("");
  const [boxSearch, setBoxSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingBox, setEditingBox] = useState<any>(null);
  const [selectedStableId, setSelectedStableId] = useState("");
  const [selectedType, setSelectedType] = useState("box");
  const [importStableId, setImportStableId] = useState("");
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (stableSearch) queryParams.set("stableSearch", stableSearch);
  if (boxSearch) queryParams.set("boxSearch", boxSearch);
  const qs = queryParams.toString();

  const { data: boxes = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/boxes", qs ? `?${qs}` : ""],
  });

  const { data: stables = [] } = useQuery<Stable[]>({
    queryKey: ["/api/sm2/stables"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/boxes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes"] });
      setShowCreateDialog(false);
      toast({ title: "Box created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sm2/boxes/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes"] });
      setShowEditDialog(false);
      toast({ title: "Box updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sm2/boxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes"] });
      toast({ title: "Box deleted successfully" });
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/boxes/import", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes"] });
      setShowImportDialog(false);
      toast({ title: "Boxes imported successfully" });
    },
  });

  const typeLabels: Record<string, string> = {
    box: "Box",
    tack_room: "Tack Room",
    storage_room: "Storage Room",
  };

  const columns = [
    { key: "name", label: "Box Name" },
    {
      key: "type",
      label: "Type",
      render: (item: any) => (
        <Badge variant="outline">{typeLabels[item.type] || item.type}</Badge>
      ),
    },
    { key: "stableName", label: "Parent Stable" },
  ];

  const importFields = [
    { targetField: "netsuiteId", label: "NetSuite ID" },
    { targetField: "name", label: "Box Name", required: true },
    { targetField: "type", label: "Type (box / tack_room / storage_room)" },
  ];

  const handleImport = (data: Record<string, string>[]) => {
    if (!importStableId) {
      toast({ title: "Please select a parent stable first", variant: "destructive" });
      return;
    }
    const mapped = data.map(row => ({
      netsuiteId: row.netsuiteId || null,
      name: row.name || "Unknown",
      type: row.type || "box",
      stableId: importStableId,
      status: "active",
    }));
    importMutation.mutate({ boxes: mapped });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Boxes"
        description="Manage boxes, tack rooms, and storage rooms"
        actions={isAdmin ? (
          <>
            <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-boxes">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-box">
              <Plus className="w-4 h-4 mr-2" />
              New Box
            </Button>
          </>
        ) : undefined}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchBar placeholder="Search stable..." value={stableSearch} onChange={setStableSearch} className="w-52" />
        <SearchBar placeholder="Search box..." value={boxSearch} onChange={setBoxSearch} className="w-52" />
      </div>

      <DataTable
        columns={columns}
        data={boxes}
        isLoading={isLoading}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-actions-box-${item.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setEditingBox(item); setShowEditDialog(true); }}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => deleteMutation.mutate(item.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Box</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                name: fd.get("name"),
                type: selectedType,
                stableId: selectedStableId,
                status: "active",
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label>Box Name</Label>
                <Input name="name" required data-testid="input-box-name" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger data-testid="select-box-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="tack_room">Tack Room</SelectItem>
                    <SelectItem value="storage_room">Storage Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parent Stable</Label>
                <Select value={selectedStableId} onValueChange={setSelectedStableId}>
                  <SelectTrigger data-testid="select-box-stable">
                    <SelectValue placeholder="Select stable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stables.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-box">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Box</DialogTitle>
          </DialogHeader>
          {editingBox && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editingBox.id,
                  name: fd.get("name"),
                  status: fd.get("status"),
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label>Box Name</Label>
                  <Input name="name" defaultValue={editingBox.name} required data-testid="input-edit-box-name" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Input name="status" defaultValue={editingBox.status} data-testid="input-edit-box-status" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-box">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        title="Import Boxes"
        fields={importFields}
        onImport={handleImport}
        isPending={importMutation.isPending}
        extraSelectors={
          <div>
            <Label>Parent Stable (required for all imported boxes)</Label>
            <Select value={importStableId} onValueChange={setImportStableId}>
              <SelectTrigger data-testid="select-import-stable" className="mt-1">
                <SelectValue placeholder="Select stable..." />
              </SelectTrigger>
              <SelectContent>
                {stables.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
