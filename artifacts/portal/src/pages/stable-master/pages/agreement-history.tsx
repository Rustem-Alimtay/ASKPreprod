import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { DataTable } from "../components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Undo2 } from "lucide-react";

export default function AgreementHistoryPage() {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelAgreement, setCancelAgreement] = useState<any>(null);
  const { toast } = useToast();

  const { data: agreements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sm2/livery-agreements", "?status=active"],
  });

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const historicalAgreements = useMemo(() => {
    return agreements.filter((a: any) => {
      if (!a.endDate) return false;
      return a.endDate < todayStr;
    });
  }, [agreements, todayStr]);

  const cancelCheckoutMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/sm2/livery-agreements/${id}/cancel-checkout`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/livery-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/boxes-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/horses"] });
      setShowCancelDialog(false);
      setCancelAgreement(null);
      toast({ title: "Checkout cancelled. Agreement is now active again." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to cancel checkout", description: error.message, variant: "destructive" });
    },
  });

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
    { key: "endDate", label: "End Date" },
    {
      key: "checkoutReason",
      label: "Reason",
      render: (item: any) => item.checkoutReason || "—",
    },
    {
      key: "monthlyAmount",
      label: "Monthly Amount",
      render: (item: any) => item.monthlyAmount ? `AED ${parseFloat(item.monthlyAmount).toFixed(2)}` : "-",
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Agreement History"
        description="Past livery agreements that have ended"
      />

      <DataTable
        columns={columns}
        data={historicalAgreements}
        isLoading={isLoading}
        emptyMessage="No historical agreements found"
        actions={(item) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCancelAgreement(item); setShowCancelDialog(true); }}
            data-testid={`button-cancel-checkout-${item.id}`}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Cancel Checkout
          </Button>
        )}
      />

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Checkout</DialogTitle>
            <DialogDescription>Reactivate this agreement and move it back to Current Agreements</DialogDescription>
          </DialogHeader>
          {cancelAgreement && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                <div>Reference: <strong>{cancelAgreement.referenceNumber}</strong></div>
                <div>Horse: <strong>{cancelAgreement.horseName}</strong></div>
                <div>Customer: <strong>{cancelAgreement.customerName}</strong></div>
                <div>End Date: <strong>{cancelAgreement.endDate}</strong></div>
                {cancelAgreement.checkoutReason && (
                  <div>Reason: <strong>{cancelAgreement.checkoutReason}</strong></div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                This will clear the end date and checkout reason, returning the agreement to the Current Agreements page. You can then edit it to set a new checkout date if needed.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(false)}
                >
                  Keep As Is
                </Button>
                <Button
                  disabled={cancelCheckoutMutation.isPending}
                  onClick={() => cancelCheckoutMutation.mutate(cancelAgreement.id)}
                  data-testid="button-confirm-cancel-checkout"
                >
                  Confirm Cancel Checkout
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
