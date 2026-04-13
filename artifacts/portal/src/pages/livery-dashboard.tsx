import { OtherModulesSection } from "@/components/other-modules-section";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { DataStatusBadge } from "@/components/status-badge";
import { PieChartCard, BarChartCard } from "@/components/dashboard-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Truck, Package, CheckCircle2, Clock, Search } from "lucide-react";
import { useState } from "react";
import type { LiveryData } from "@shared";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiveryDashboard() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery<LiveryData>({
    queryKey: ["/api/livery"],
  });

  const handleRefresh = () => {
    refetch();
  };

  const filteredDeliveries = data?.deliveries?.filter(
    (d) =>
      d.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deliveryStatsChartData = data?.deliveryStats?.map((item) => ({
    name: item.status,
    value: item.count,
  })) ?? [];

  const deliveryColumns = [
    { key: "trackingNumber", header: "Tracking #", className: "font-mono text-sm" },
    { key: "origin", header: "Origin" },
    { key: "destination", header: "Destination" },
    { key: "estimatedDelivery", header: "Est. Delivery" },
    {
      key: "status",
      header: "Status",
      render: (item: LiveryData["deliveries"][0]) => (
        <DataStatusBadge status={item.status} />
      ),
    },
  ];

  const metricIcons = [
    <Package className="h-4 w-4" />,
    <Truck className="h-4 w-4" />,
    <CheckCircle2 className="h-4 w-4" />,
    <Clock className="h-4 w-4" />,
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <DashboardHeader
          title="Livery Dashboard"
          description="Delivery tracking and logistics"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <DashboardHeader
        title="Livery Dashboard"
        description="Delivery tracking and logistics"
        lastSync={data?.lastSync}
        connectionStatus={data?.connectionStatus}
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data?.metrics?.map((metric, index) => (
          <MetricCard key={metric.id} metric={metric} icon={metricIcons[index]} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieChartCard
          title="Delivery Status Distribution"
          data={deliveryStatsChartData}
          isLoading={isLoading}
        />
        <BarChartCard
          title="Deliveries by Status"
          data={deliveryStatsChartData}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Active Deliveries</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deliveries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-deliveries"
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredDeliveries ?? []}
            columns={deliveryColumns}
            isLoading={isLoading}
            emptyMessage="No deliveries found"
            testIdPrefix="livery-deliveries"
          />
        </CardContent>
      </Card>
      <OtherModulesSection />
    </div>
  );
}
