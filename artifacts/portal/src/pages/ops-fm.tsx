import { UnderDevelopmentBanner } from "@/components/under-development-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { 
  Building,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Zap,
  Thermometer,
  Droplets,
  Shield
} from "lucide-react";
import type { PageSectionWithTemplate } from "@shared";

const SERVICE_URL = "/ops-fm";

const fmCategories = [
  { id: "maintenance", name: "Maintenance Requests", count: 0, icon: Wrench, iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30" },
  { id: "inspections", name: "Inspections & Audits", count: 0, icon: ClipboardCheck, iconBg: "bg-green-100 text-green-600 dark:bg-green-900/30" },
  { id: "assets", name: "Asset Management", count: 0, icon: Building, iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/30" },
  { id: "safety", name: "Safety & Compliance", count: 0, icon: Shield, iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30" },
];

const activeWorkOrders: { id: string; title: string; priority: string; status: string; assignee: string; due: string }[] = [];

const facilityStats = [
  { name: "Open Work Orders", value: "0", icon: Wrench, trend: "" },
  { name: "Scheduled Maintenance", value: "0", icon: Calendar, trend: "" },
  { name: "Completed This Month", value: "0", icon: CheckCircle2, trend: "" },
  { name: "Overdue Tasks", value: "0", icon: AlertTriangle, trend: "" },
];

const utilityMonitoring = [
  { name: "Electricity", value: "0 kWh", status: "normal", icon: Zap },
  { name: "HVAC System", value: "0°C", status: "normal", icon: Thermometer },
  { name: "Water Usage", value: "0 L", status: "normal", icon: Droplets },
];

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">High</Badge>;
    case "medium":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200">Medium</Badge>;
    default:
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">Low</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200">In Progress</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200">Pending</Badge>;
    case "scheduled":
      return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200">Scheduled</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">Completed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function renderSection(section: PageSectionWithTemplate) {
  switch (section.title) {
    case "Facility Stats":
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {facilityStats.map((stat) => (
            <Card key={stat.name} data-testid={`stat-${stat.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.name}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      );

    case "FM Categories":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {fmCategories.map((category) => (
            <div 
              key={category.id}
              className="flex items-center gap-3 p-4 rounded-lg border hover-elevate cursor-pointer"
              data-testid={`category-${category.id}`}
            >
              <div className={`p-2.5 rounded-lg ${category.iconBg}`}>
                <category.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.count} items</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      );

    case "Active Work Orders":
      return (
        <div className="space-y-3">
          {activeWorkOrders.length === 0 && (
            <p className="text-sm text-muted-foreground">No active work orders.</p>
          )}
          {activeWorkOrders.map((order) => (
            <div 
              key={order.id}
              className="flex items-center gap-4 p-3 rounded-lg border hover-elevate"
              data-testid={`order-${order.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{order.id}</span>
                  {getPriorityBadge(order.priority)}
                </div>
                <p className="font-medium text-sm truncate">{order.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{order.assignee}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <Clock className="h-3 w-3" />
                  <span>{order.due}</span>
                </div>
              </div>
              {getStatusBadge(order.status)}
            </div>
          ))}
        </div>
      );

    case "Utility Monitoring":
      return (
        <div className="space-y-4">
          {utilityMonitoring.map((utility) => (
            <div 
              key={utility.name}
              className="flex items-center justify-between p-3 rounded-lg border"
              data-testid={`utility-${utility.name.toLowerCase()}`}
            >
              <div className="flex items-center gap-3">
                <utility.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{utility.name}</p>
                  <p className="text-xs text-muted-foreground">{utility.value}</p>
                </div>
              </div>
              {utility.status === "normal" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

export default function OpsFMPage() {
  return (
    <ServicePageLayout
      serviceUrl={SERVICE_URL}
      title="OPS & Facility Management"
      subtitle="Work orders, maintenance, and facility operations management"
      collaborationSection="ops_fm"
      externalLinks={[
        { label: "Launch Power BI", url: "https://app.powerbi.com", icon: BarChart3 },
      ]}
      renderSection={renderSection}
    >
      <UnderDevelopmentBanner />
      <OtherModulesSection />
    </ServicePageLayout>
  );
}
