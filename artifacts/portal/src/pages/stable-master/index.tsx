import { useState, useEffect } from "react";
import { Router, Switch, Route, Redirect } from "wouter";
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
    return <Redirect to="/stable-master" />;
  }
  return <Component />;
}

function SmRoutes({ userRole }: { userRole: string }) {
  return (
    <Switch>
      <Route path="/stable-master" component={DashboardPage} />
      <Route path="/stable-master/customers" component={CustomersPage} />
      <Route path="/stable-master/horses" component={HorsesPage} />
      <Route path="/stable-master/stables" component={StablesPage} />
      <Route path="/stable-master/boxes" component={BoxesPage} />
      <Route path="/stable-master/items" component={ItemsPage} />
      <Route path="/stable-master/agreements/current" component={CurrentAgreementsPage} />
      <Route path="/stable-master/agreements/new" component={NewAgreementPage} />
      <Route path="/stable-master/agreements/history" component={AgreementHistoryPage} />
      <Route path="/stable-master/billing-elements" component={BillingElementsPage} />
      <Route path="/stable-master/billing/to-invoice" component={ToInvoicePage} />
      <Route path="/stable-master/billing/invoices" component={InvoicesPage} />
      <Route path="/stable-master/reports/livery" component={ReportsPage} />
      <Route path="/stable-master/stable-management/horse-movements" component={HorseMovementsPage} />
      <Route path="/stable-master/admin/users">{() => <AdminRoute component={AdminUsersPage} userRole={userRole} />}</Route>
      <Route path="/stable-master/admin/settings">{() => <AdminRoute component={AdminSettingsPage} userRole={userRole} />}</Route>
      <Route path="/stable-master/admin/audit-logs">{() => <AdminRoute component={AdminAuditLogsPage} userRole={userRole} />}</Route>
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
    return <Redirect to="/login" />;
  }

  const handleLogout = () => {
    window.location.href = "/dashboard";
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <Router>
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
    </Router>
  );
}
