import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, ArrowRight, Clock, DollarSign, Building2, User } from "lucide-react";
import type { ApprovalStep, Requisition } from "@shared";

type ApprovalWithRequisition = ApprovalStep & { requisition?: Requisition };

function getStageBadgeClass(stage: string) {
  if (stage.includes("Line Manager")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0";
  if (stage.includes("Purchasing")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0";
  if (stage.includes("Budget")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0";
  if (stage.includes("Final")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0";
  return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-0";
}

function formatCost(cost: number) {
  return new Intl.NumberFormat("en-AE", { style: "decimal", minimumFractionDigits: 2 }).format(cost / 100);
}

export default function MyApprovalsPage() {
  const [, navigate] = useLocation();

  const { data: approvals = [], isLoading } = useQuery<ApprovalWithRequisition[]>({
    queryKey: ["/api/my-approvals"],
    queryFn: () => fetch("/api/my-approvals", { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-outfit" data-testid="text-page-title">My Approvals</h1>
          <p className="text-muted-foreground">Requisitions waiting for your review and approval</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : approvals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-no-approvals">No pending approvals</h3>
            <p className="text-muted-foreground">You don't have any requisitions waiting for your approval.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => {
            const req = approval.requisition;
            return (
              <Card
                key={approval.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  if (req) navigate(`/erp/procurement/requisitions/${req.id}`);
                }}
                data-testid={`card-approval-${approval.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-base" data-testid={`text-approval-title-${approval.id}`}>
                          {req?.requestTitle || "Unknown Request"}
                        </h3>
                        <Badge className={getStageBadgeClass(approval.stage)} data-testid={`badge-stage-${approval.id}`}>
                          {approval.stage}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {req && (
                          <>
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              {req.requestedBy}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {req.department}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5" />
                              AED {formatCost(req.estimatedCostAed)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {req.dateOfRequest}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`button-review-${approval.id}`}>
                      Review
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
