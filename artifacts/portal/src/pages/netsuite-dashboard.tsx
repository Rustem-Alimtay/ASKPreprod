import { OtherModulesSection } from "@/components/other-modules-section";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { DataStatusBadge } from "@/components/status-badge";
import { BarChartCard, LineChartCard } from "@/components/dashboard-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DollarSign, CreditCard, TrendingUp, Users, Search } from "lucide-react";
import { useState } from "react";
import type { NetSuiteData } from "@shared";
import { Skeleton } from "@/components/ui/skeleton";

export default function NetSuiteDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery<NetSuiteData>({
    queryKey: ["/api/netsuite"],
  });

  const handleRefresh = () => {
    refetch();
  };

  const filteredTransactions = data?.transactions?.filter(
    (t) =>
      t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const revenueChartData = data?.revenueByMonth?.map((item) => ({
    name: item.month,
    value: item.revenue,
  })) ?? [];

  const transactionColumns = [
    { key: "id", header: "Transaction ID", className: "font-mono text-sm" },
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "customer", header: "Customer" },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: NetSuiteData["transactions"][0]) => (
        <span className="font-medium">${item.amount.toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: NetSuiteData["transactions"][0]) => (
        <DataStatusBadge status={item.status} />
      ),
    },
  ];

  const metricIcons = [
    <DollarSign className="h-4 w-4" />,
    <CreditCard className="h-4 w-4" />,
    <TrendingUp className="h-4 w-4" />,
    <Users className="h-4 w-4" />,
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <DashboardHeader
          title="NetSuite Dashboard"
          description="Financial data and transaction management"
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
        title="NetSuite Dashboard"
        description="Financial data and transaction management"
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
        <LineChartCard
          title="Revenue Trend"
          data={revenueChartData}
          isLoading={isLoading}
        />
        <BarChartCard
          title="Monthly Revenue"
          data={revenueChartData}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-transactions"
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredTransactions ?? []}
            columns={transactionColumns}
            isLoading={isLoading}
            emptyMessage="No transactions found"
            testIdPrefix="netsuite-transactions"
          />
        </CardContent>
      </Card>
      <OtherModulesSection />
    </div>
  );
}
