import { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";

// SM pages
import DashboardPage from "./pages/dashboard";
import CustomersPage from "./pages/customers";
import HorsesPage from "./pages/horses";
import StablesPage from "./pages/stables";
import BoxesPage from "./pages/boxes";
import ItemsPage from "./pages/items";
import CurrentAgreementsPage from "./pages/current-agreements";
import NewAgreementPage from "./pages/new-agreement";
import AgreementHistoryPage from "./pages/agreement-history";
import BillingElementsPage from "./pages/billing-elements";
import ToInvoicePage from "./pages/to-invoice";
import InvoicesPage from "./pages/invoices";
import ReportsPage from "./pages/reports";
import HorseMovementsPage from "./pages/horse-movements";
import AdminUsersPage from "./pages/admin-users";
import AdminSettingsPage from "./pages/admin-settings";
import AdminAuditLogsPage from "./pages/admin-audit-logs";
import NotFoundPage from "./pages/not-found";

function AdminRoute({ component: Component, userRole }: { component: React.ComponentType; userRole: string }) {
  if (userRole !== "ADMIN") {
    return <Redirect to="/" />;
  }
  return <Component />;
}

function SmRoutes({ userRole }: { userRole: string }) {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/horses" component={HorsesPage} />
      <Route path="/stables" component={StablesPage} />
      <Route path="/boxes" component={BoxesPage} />
      <Route path="/items" component={ItemsPage} />
      <Route path="/agreements/current" component={CurrentAgreementsPage} />
      <Route path="/agreements/new" component={NewAgreementPage} />
      <Route path="/agreements/history" component={AgreementHistoryPage} />
      <Route path="/billing-elements" component={BillingElementsPage} />
      <Route path="/billing/to-invoice" component={ToInvoicePage} />
      <Route path="/billing/invoices" component={InvoicesPage} />
      <Route path="/reports/livery" component={ReportsPage} />
      <Route path="/stable-management/horse-movements" component={HorseMovementsPage} />
      <Route path="/admin/users">{() => <AdminRoute component={AdminUsersPage} userRole={userRole} />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettingsPage} userRole={userRole} />}</Route>
      <Route path="/admin/audit-logs">{() => <AdminRoute component={AdminAuditLogsPage} userRole={userRole} />}</Route>
      <Route component={NotFoundPage} />
    </Switch>
  );
}

export default function StableMasterModule() {
  const { user, isLoading } = useAuth();
  const [userRole, setUserRole] = useState<string>("LIVERY_ADMIN");

  useEffect(() => {
    fetch("/api/sm2/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.role) setUserRole(data.role);
      })
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  const handleLogout = () => {
    window.location.href = "/dashboard";
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar onLogout={handleLogout} userRole={userRole} />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">Stable Master</span>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <SmRoutes userRole={userRole} />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
