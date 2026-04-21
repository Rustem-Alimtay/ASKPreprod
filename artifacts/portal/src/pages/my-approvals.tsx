import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ChevronRight } from "lucide-react";

type MyApproval = {
  step: {
    id: string;
    stage: string;
    assignedToName: string | null;
    createdAt: string | null;
  };
  requisition: {
    id: string;
    requestTitle: string;
    department: string;
    requestedBy: string;
    estimatedCostAed: number;
    status: string;
    dateOfRequest: string;
  };
};

function stageBadgeVariant(stage: string): "default" | "secondary" | "destructive" | "outline" {
  if (stage.includes("Rejected")) return "destructive";
  if (stage === "Ready for Purchase" || stage === "PO Created") return "default";
  return "secondary";
}

export default function MyApprovalsPage() {
  const { data = [], isLoading } = useQuery<MyApproval[]>({
    queryKey: ["/api/my-approvals"],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-my-approvals-title">My Approvals</h1>
        <p className="text-muted-foreground">
          Requisitions waiting for your review or decision.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">Nothing to approve</h2>
            <p className="text-sm text-muted-foreground">
              You have no pending approval tasks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.map((item) => (
            <Card key={item.step.id} data-testid={`card-approval-${item.step.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base" data-testid="text-approval-title">
                      {item.requisition.requestTitle}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.requisition.department} · Requested by {item.requisition.requestedBy} · {item.requisition.dateOfRequest}
                    </p>
                  </div>
                  <Badge variant={stageBadgeVariant(item.step.stage)}>{item.step.stage}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <div className="text-sm">
                  <span className="font-medium">AED {Number(item.requisition.estimatedCostAed).toLocaleString()}</span>
                </div>
                <Button asChild variant="outline" size="sm" data-testid={`button-review-${item.step.id}`}>
                  <Link href={`/intranet/requisitions/${item.requisition.id}`}>
                    Review
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
