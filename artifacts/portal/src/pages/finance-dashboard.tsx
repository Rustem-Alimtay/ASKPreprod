import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { OtherModulesSection } from "@/components/other-modules-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { 
  DollarSign, 
  ShoppingCart, 
  Package,
  FileText,
  TrendingUp,
  ClipboardList,
  ExternalLink,
  CreditCard,
  BarChart3,
  Receipt,
  Truck,
  Archive,
  CheckCircle,
  Shield,
  Activity,
  ArrowUpRight,
  Wallet,
  PieChart,
  Banknote,
} from "lucide-react";

const financeModules = [
  {
    id: "accounts-payable",
    title: "Accounts Payable",
    subtitle: "3 Invoices Pending Approval",
    icon: FileText,
    action: "View Invoices",
    url: "#",
  },
  {
    id: "budget-variance",
    title: "Budget Variance",
    subtitle: "Q1 2026: +2.4% vs Forecast",
    icon: TrendingUp,
    action: "View Report",
    url: "#",
  },
  {
    id: "financial-reports",
    title: "Financial Reports",
    subtitle: "Monthly Closing: In Progress",
    icon: BarChart3,
    action: "Open Reports",
    url: "#",
  },
  {
    id: "cash-flow",
    title: "Cash Flow",
    subtitle: "Net: AED 1.2M | 30-Day Forecast",
    icon: Wallet,
    action: "View Cash Flow",
    url: "#",
  },
  {
    id: "revenue-breakdown",
    title: "Revenue Breakdown",
    subtitle: "YTD: AED 8.5M across 3 BUs",
    icon: PieChart,
    action: "View Revenue",
    url: "#",
  },
  {
    id: "expense-tracker",
    title: "Expense Tracker",
    subtitle: "Monthly OPEX: AED 420K",
    icon: Banknote,
    action: "View Expenses",
    url: "#",
  },
];


const procurementModules = [
  {
    id: "purchase-orders",
    title: "Purchase Orders",
    subtitle: "12 Orders Pending",
    icon: ClipboardList,
    action: "View Orders",
    url: "#",
  },
  {
    id: "vendor-management",
    title: "Vendor Management",
    subtitle: "156 Active Vendors",
    icon: Truck,
    action: "Manage Vendors",
    url: "#",
  },
  {
    id: "requisitions",
    title: "Requisitions",
    subtitle: "5 Awaiting Approval",
    icon: Receipt,
    action: "View Requisitions",
    url: "/erp/procurement/requisitions",
  },
];

const inventoryModules = [
  {
    id: "stock-levels",
    title: "Stock Levels",
    subtitle: "Current inventory status",
    icon: Package,
    action: "View Inventory",
    url: "#",
  },
  {
    id: "warehouse",
    title: "Warehouse Management",
    subtitle: "3 Locations Active",
    icon: Archive,
    action: "Manage Warehouses",
    url: "#",
  },
  {
    id: "transfers",
    title: "Stock Transfers",
    subtitle: "2 Transfers In Progress",
    icon: Truck,
    action: "View Transfers",
    url: "#",
  },
];

const paymentMetrics = [
  { id: "monthly-volume", title: "Monthly Volume", value: "$284,500", change: 18.3 },
  { id: "transactions", title: "Transactions", value: "1,847", change: 12.5 },
  { id: "success-rate", title: "Success Rate", value: "98.7%", change: 0.5 },
  { id: "avg-transaction", title: "Avg Transaction", value: "$154", change: -2.1 },
];

const recentPayments = [
  { id: "PAY-001", customer: "Acme Corporation", amount: "$15,250", status: "completed", date: "Jan 15, 2026" },
  { id: "PAY-002", customer: "TechStart Inc", amount: "$8,900", status: "completed", date: "Jan 15, 2026" },
  { id: "PAY-003", customer: "Global Solutions", amount: "$22,000", status: "pending", date: "Jan 14, 2026" },
  { id: "PAY-004", customer: "DataFlow Ltd", amount: "$3,500", status: "completed", date: "Jan 14, 2026" },
  { id: "PAY-005", customer: "CloudNine Corp", amount: "$45,000", status: "failed", date: "Jan 13, 2026" },
];

export default function FinanceDashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const activeTab = location.includes("/erp/procurement") ? "procurement"
    : location.includes("/erp/inventory") ? "inventory"
    : location.includes("/erp/payments") ? "payments"
    : "finance";

  if (activeTab === "payments" && !isAdmin) {
    navigate("/erp/finance");
    return null;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-outfit">ERP</h1>
          <p className="text-muted-foreground">Finance, Procurement, and Inventory Management.</p>
        </div>
        <Button className="w-fit" data-testid="button-launch-netsuite">
          Launch NetSuite
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {activeTab === "finance" && (
        <div className="mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {financeModules.map((module) => (
              <Card key={module.id} data-testid={`finance-module-${module.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <module.icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{module.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{module.subtitle}</p>
                  <Button variant="outline" className="w-full" data-testid={`button-${module.id}`}>
                    {module.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold font-outfit">Power BI Dashboard</h3>
              <Button
                variant="outline"
                size="sm"
                data-testid="powerbi-open-new-tab"
                onClick={() => window.open("https://app.powerbi.com/reportEmbed?reportId=b37a6c8c-cbe6-4635-84e2-1d26d0af47c7&appId=fcee7e5c-5747-4076-ae52-06342581e3ef&autoAuth=true&ctid=0f3ed57e-4b52-4eda-87b3-26744d95f8e3", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
              </Button>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <iframe
                  title="Power BI Report"
                  src="https://app.powerbi.com/reportEmbed?reportId=b37a6c8c-cbe6-4635-84e2-1d26d0af47c7&appId=fcee7e5c-5747-4076-ae52-06342581e3ef&autoAuth=true&ctid=0f3ed57e-4b52-4eda-87b3-26744d95f8e3"
                  className="w-full border-0"
                  style={{ height: "600px" }}
                  allowFullScreen
                  data-testid="powerbi-embed"
                />
              </CardContent>
            </Card>
          </div>

          <OtherModulesSection />
        </div>
      )}

      {activeTab === "procurement" && (
        <div className="mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {procurementModules.map((module) => (
              <Card key={module.id} data-testid={`procurement-module-${module.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <module.icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{module.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{module.subtitle}</p>
                  <Button
                    variant={module.id === "requisition-arf" ? "default" : "outline"}
                    className="w-full"
                    data-testid={`button-${module.id}`}
                    onClick={() => { if (module.url !== "#") navigate(module.url); }}
                  >
                    {module.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold font-outfit">Vendors BI Dashboard</h3>
              <Button
                variant="outline"
                size="sm"
                data-testid="powerbi-vendors-open-new-tab"
                onClick={() => window.open("https://app.powerbi.com/reportEmbed?reportId=b0352db6-6036-4026-9f2f-4c5648bedaa7&autoAuth=true&ctid=0f3ed57e-4b52-4eda-87b3-26744d95f8e3", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
              </Button>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <iframe
                  title="Vendors BI"
                  src="https://app.powerbi.com/reportEmbed?reportId=b0352db6-6036-4026-9f2f-4c5648bedaa7&autoAuth=true&ctid=0f3ed57e-4b52-4eda-87b3-26744d95f8e3"
                  className="w-full border-0"
                  style={{ height: "600px" }}
                  allowFullScreen
                  data-testid="powerbi-vendors-embed"
                />
              </CardContent>
            </Card>
          </div>

          <OtherModulesSection />
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {inventoryModules.map((module) => (
              <Card key={module.id} data-testid={`inventory-module-${module.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <module.icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{module.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{module.subtitle}</p>
                  <Button variant="outline" className="w-full" data-testid={`button-${module.id}`}>
                    {module.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <OtherModulesSection />
        </div>
      )}

      {activeTab === "payments" && (
        <div className="mt-2">
          {/* Payment Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {paymentMetrics.map((metric) => (
              <Card key={metric.id} data-testid={`metric-${metric.id}`}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-2xl font-bold font-outfit">{metric.value}</span>
                    <Badge 
                      variant="secondary" 
                      className={metric.change >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"}
                    >
                      {metric.change >= 0 ? "+" : ""}{metric.change}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment Features & Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Features */}
            <Card data-testid="payment-features-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Payment Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Card Payments</p>
                    <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Secure Checkout</p>
                    <p className="text-xs text-muted-foreground">PCI DSS Compliant</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Real-time Webhooks</p>
                    <p className="text-xs text-muted-foreground">Instant notifications</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <Receipt className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Invoicing</p>
                    <p className="text-xs text-muted-foreground">Automated billing</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="lg:col-span-2" data-testid="recent-transactions-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2 gap-4">
                <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm" data-testid="button-view-all-transactions">
                  View All
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentPayments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      data-testid={`payment-row-${payment.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{payment.customer}</p>
                          <p className="text-xs text-muted-foreground">{payment.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{payment.amount}</span>
                        <Badge 
                          variant="secondary"
                          className={
                            payment.status === "completed" 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" 
                              : payment.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <OtherModulesSection />
        </div>
      )}
    </div>
  );
}

