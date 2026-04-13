import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, FileText, Receipt, CreditCard } from "lucide-react";
import { Horseshoe } from "../components/icons/horseshoe";
import { Link } from "wouter";

export default function DashboardPage() {
  const { data: horses = [], isLoading: loadingHorses } = useQuery<any[]>({ queryKey: ["/api/sm2/horses"] });
  const { data: customers = [], isLoading: loadingCustomers } = useQuery<any[]>({ queryKey: ["/api/sm2/customers"] });
  const { data: stables = [], isLoading: loadingStables } = useQuery<any[]>({ queryKey: ["/api/sm2/stables"] });
  const { data: agreements = [], isLoading: loadingAgreements } = useQuery<any[]>({ queryKey: ["/api/sm2/livery-agreements", "?status=active"] });
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<any[]>({ queryKey: ["/api/sm2/invoices"] });
  const { data: billingElements = [], isLoading: loadingBilling } = useQuery<any[]>({ queryKey: ["/api/sm2/billing-elements", "?billed=false"] });

  const stats = [
    {
      title: "Active Horses",
      value: horses.filter((h: any) => h.status === "active").length,
      icon: Horseshoe,
      loading: loadingHorses,
      href: "/horses",
      color: "text-primary",
    },
    {
      title: "Active Customers",
      value: customers.filter((c: any) => c.status === "active").length,
      icon: Users,
      loading: loadingCustomers,
      href: "/customers",
      color: "text-chart-3",
    },
    {
      title: "Stables",
      value: stables.length,
      icon: Building2,
      loading: loadingStables,
      href: "/stables",
      color: "text-chart-2",
    },
    {
      title: "Active Agreements",
      value: agreements.length,
      icon: FileText,
      loading: loadingAgreements,
      href: "/agreements/current",
      color: "text-chart-4",
    },
    {
      title: "Pending Billing",
      value: billingElements.length,
      icon: Receipt,
      loading: loadingBilling,
      href: "/billing/to-invoice",
      color: "text-chart-5",
    },
    {
      title: "Total Invoices",
      value: invoices.length,
      icon: CreditCard,
      loading: loadingInvoices,
      href: "/billing/invoices",
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" description="Welcome to StableMaster" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover-elevate cursor-pointer transition-all">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stat.value}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Recent Active Agreements</h2>
        {loadingAgreements ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : agreements.length === 0 ? (
          <p className="text-muted-foreground">No active agreements</p>
        ) : (
          <div className="space-y-2">
            {agreements.slice(0, 5).map((agreement: any) => (
              <Card key={agreement.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                      <Horseshoe className="w-5 h-5" inverted />
                    </div>
                    <div>
                      <p className="font-medium">{agreement.horseName || "No Horse"}</p>
                      <p className="text-sm text-muted-foreground">{agreement.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {agreement.monthlyAmount ? `AED ${parseFloat(agreement.monthlyAmount).toFixed(2)}/mo` : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">{agreement.stableName} / {agreement.boxName}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
