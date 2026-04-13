import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { SearchBar } from "../components/search-bar";

import { ImportDialog } from "../components/import-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Plus } from "lucide-react";
import type { Customer } from "@shared/sm2";

export default function CustomersPage() {
  const userRole = useUserRole();
  const isAdmin = userRole === "ADMIN";
  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/sm2/customers", search ? `?search=${search}` : ""],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/customers"] });
      setShowNewDialog(false);
      toast({ title: "Customer created successfully" });
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/customers/import", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/customers"] });
      setShowImportDialog(false);
      toast({ title: "Customers imported successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const columns = [
    { key: "fullname", label: "Full Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
  ];

  const importFields = [
    { targetField: "netsuiteId", label: "NetSuite ID" },
    { targetField: "fullname", label: "Full Name", required: true },
    { targetField: "phone", label: "Phone" },
    { targetField: "email", label: "Email" },
    { targetField: "status", label: "Status" },
  ];

  const handleImport = (data: Record<string, string>[]) => {
    const mapped = data.map(row => ({
      netsuiteId: row.netsuiteId || null,
      fullname: row.fullname || "Unknown",
      phone: row.phone || null,
      email: row.email || null,
      status: row.status || "active",
    }));
    importMutation.mutate({ customers: mapped });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Customers"
        description="View customers synced from NetSuite"
        actions={isAdmin ? (
          <>
            <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-customers">
              <Upload className="w-4 h-4 mr-2" />
              Import (Temp)
            </Button>
            <Button variant="outline" onClick={() => setShowNewDialog(true)} data-testid="button-new-customer">
              <Plus className="w-4 h-4 mr-2" />
              New Customer (Temp)
            </Button>
          </>
        ) : undefined}
      />

      <div className="mb-4">
        <SearchBar
          placeholder="Search by name..."
          value={search}
          onChange={setSearch}
          className="max-w-sm"
        />
      </div>

      <DataTable columns={columns} data={customers} isLoading={isLoading} />

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer (Temporary)</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                fullname: fd.get("fullname"),
                phone: fd.get("phone"),
                email: fd.get("email"),
                status: "active",
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input name="fullname" required data-testid="input-fullname" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input name="phone" data-testid="input-phone" />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" data-testid="input-email" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-customer">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        title="Import Customers"
        fields={importFields}
        onImport={handleImport}
        isPending={importMutation.isPending}
      />
    </div>
  );
}
