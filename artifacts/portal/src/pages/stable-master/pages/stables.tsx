import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import type { Stable } from "@shared/sm2";

export default function StablesPage() {
  const userRole = useUserRole();
  const isAdmin = userRole === "ADMIN";
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStable, setEditingStable] = useState<Stable | null>(null);
  const { toast } = useToast();

  const { data: stables = [], isLoading } = useQuery<Stable[]>({
    queryKey: ["/api/sm2/stables"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/stables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/stables"] });
      setShowCreateDialog(false);
      toast({ title: "Stable created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sm2/stables/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/stables"] });
      setShowEditDialog(false);
      toast({ title: "Stable updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sm2/stables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/stables"] });
      toast({ title: "Stable deleted successfully" });
    },
  });

  const columns = [
    { key: "name", label: "Stable Name" },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Stables"
        description="Manage stable infrastructure"
        actions={isAdmin ? (
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-stable">
            <Plus className="w-4 h-4 mr-2" />
            New Stable
          </Button>
        ) : undefined}
      />

      <DataTable
        columns={columns}
        data={stables}
        isLoading={isLoading}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-actions-stable-${item.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setEditingStable(item); setShowEditDialog(true); }}>
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
            <DialogTitle>New Stable</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({ name: fd.get("name"), status: "active" });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label>Stable Name</Label>
                <Input name="name" required data-testid="input-stable-name" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-stable">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stable</DialogTitle>
          </DialogHeader>
          {editingStable && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({ id: editingStable.id, name: fd.get("name"), status: fd.get("status") });
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label>Stable Name</Label>
                  <Input name="name" defaultValue={editingStable.name} required data-testid="input-edit-stable-name" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Input name="status" defaultValue={editingStable.status} data-testid="input-edit-stable-status" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-stable">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
