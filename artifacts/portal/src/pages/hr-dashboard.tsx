import { OtherModulesSection } from "@/components/other-modules-section";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { PieChartCard, BarChartCard } from "@/components/dashboard-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, UserCheck, UserMinus, Building2, Search } from "lucide-react";
import { useState } from "react";
import type { HRData } from "@shared";
import { Skeleton } from "@/components/ui/skeleton";

export default function HRDashboard() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery<HRData>({
    queryKey: ["/api/hr"],
  });

  const handleRefresh = () => {
    refetch();
  };

  const filteredEmployees = data?.employees?.filter(
    (e) => {
      const term = searchTerm.toLowerCase();
      return (
        e.employeeCode.toLowerCase().includes(term) ||
        e.name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term)
      );
    }
  );

  const departmentChartData = data?.departmentStats?.map((item) => ({
    name: item.department,
    value: item.count,
  })) ?? [];

  const employeeColumns = [
    { key: "employeeCode", header: "Employee Code", className: "font-mono text-sm", sortable: true },
    { key: "name", header: "Full Name", className: "font-medium", sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "department", header: "Department", sortable: true },
    { key: "position", header: "Position", sortable: true },
  ];

  const metricIcons = [
    <Users className="h-4 w-4" />,
    <UserCheck className="h-4 w-4" />,
    <UserMinus className="h-4 w-4" />,
    <Building2 className="h-4 w-4" />,
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <DashboardHeader
          title="HR Dashboard"
          description="Employee management and statistics"
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
        title="HR Dashboard"
        description="Employee management and statistics"
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
          title="Employees by Department"
          data={departmentChartData}
          isLoading={isLoading}
        />
        <BarChartCard
          title="Department Distribution"
          data={departmentChartData}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Employee Directory</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-employees"
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredEmployees ?? []}
            columns={employeeColumns}
            isLoading={isLoading}
            emptyMessage="No employees found"
            testIdPrefix="hr-employees"
            sortable
          />
        </CardContent>
      </Card>
      <OtherModulesSection />
    </div>
  );
}
