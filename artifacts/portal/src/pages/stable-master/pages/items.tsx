import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { SearchBar } from "../components/search-bar";

import { ImportDialog } from "../components/import-dialog";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "../hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload } from "lucide-react";
import type { Item } from "@shared/sm2";

export default function ItemsPage() {
  const userRole = useUserRole();
  const isAdmin = userRole === "ADMIN";
  const [search, setSearch] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/sm2/items", search ? `?search=${search}` : ""],
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sm2/items/import", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/items"] });
      setShowImportDialog(false);
      toast({ title: "Items imported successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const columns = [
    { key: "name", label: "Item Name" },
    {
      key: "unitFactor",
      label: "Unit Factor",
      render: (item: Item) => item.unitFactor ? item.unitFactor : "-",
    },
    {
      key: "price",
      label: "Price",
      render: (item: Item) => item.price ? `AED ${item.price}` : "-",
    },
  ];

  const importFields = [
    { targetField: "name", label: "Item Name", required: true },
    { targetField: "unitFactor", label: "Unit Factor" },
    { targetField: "price", label: "Price" },
    { targetField: "averageCost", label: "Average Cost" },
    { targetField: "department", label: "Department" },
    { targetField: "class", label: "Class" },
    { targetField: "location", label: "Location" },
    { targetField: "netsuiteId", label: "NetSuite ID" },
    { targetField: "status", label: "Status" },
    { targetField: "isInactive", label: "Is Inactive (true/false)" },
  ];

  const handleImport = (data: Record<string, string>[]) => {
    const mapped = data.map(row => ({
      name: row.name || "Unknown",
      unitFactor: row.unitFactor || null,
      price: row.price || null,
      averageCost: row.averageCost || null,
      department: row.department || null,
      class: row.class || null,
      location: row.location || null,
      netsuiteId: row.netsuiteId || null,
      status: row.status || "active",
      isLiveryPackage: false,
      isInactive: row.isInactive === "true",
    }));
    importMutation.mutate({ items: mapped });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Items"
        description="Items and service items. Unit Factor = quantity unit for pricing, Price = price for that unit factor."
        actions={isAdmin ? (
          <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-items">
            <Upload className="w-4 h-4 mr-2" />
            Import (Temp)
          </Button>
        ) : undefined}
      />

      <div className="mb-4">
        <SearchBar placeholder="Search item name..." value={search} onChange={setSearch} className="max-w-sm" />
      </div>

      <DataTable columns={columns} data={items} isLoading={isLoading} />

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        title="Import Items"
        fields={importFields}
        onImport={handleImport}
        isPending={importMutation.isPending}
      />
    </div>
  );
}
