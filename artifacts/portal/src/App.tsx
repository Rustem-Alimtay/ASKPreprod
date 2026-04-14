import { Component, type ReactNode } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "16px", fontFamily: "Inter, sans-serif" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ color: "#666" }}>An unexpected error occurred. Please try refreshing the page.</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = "/dashboard"; }} style={{ padding: "8px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Dashboard from "@/pages/dashboard";
import FinanceDashboard from "@/pages/finance-dashboard";
import HRDashboard from "@/pages/hr-dashboard";
import LiveryDashboard from "@/pages/livery-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import SettingsPage from "@/pages/settings";
import SystemSettingsPage from "@/pages/system-settings";
import HelpCenterPage from "@/pages/help-center";
import MyTicketsPage from "@/pages/my-tickets";
import AdminTicketsPage from "@/pages/admin-tickets";
import OtherSystemsPage from "@/pages/other-systems";
import VeterinaryPage from "@/pages/veterinary";
import ProjectsPage from "@/pages/projects";
import ManageTagsPage from "@/pages/manage-tags";
import HRMSPage from "@/pages/hrms";
import EventsPage from "@/pages/events";
import IntranetPage from "@/pages/intranet";
import LegalPage from "@/pages/legal";
import OpsFMPage from "@/pages/ops-fm";
import ITDTPage from "@/pages/it-dt";
import ProjectGroupPage from "@/pages/project-group";
import CustomerDBPage from "@/pages/customer-db";
import CustomerProfilePage from "@/pages/customer-profile";
import AzureTablesPage from "@/pages/azure-tables";
import DynamicServicePage from "@/pages/dynamic-service";
import StableMasterModule from "@/pages/stable-master/index";
import RequisitionsListPage from "@/pages/requisitions-list";
import RequisitionNewPage from "@/pages/requisition-new";
import RequisitionDetailPage from "@/pages/requisition-detail";
import MyApprovalsPage from "@/pages/my-approvals";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { MinimizedSectionsProvider, MinimizedTaskbar } from "@/components/expandable-section";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

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

  const isAdmin = user.role === "admin" || user.role === "superadmin";

  const allowedPages = (user as any).allowedPages as string[] | null | undefined;
  const hasPageRestrictions = !isAdmin && Array.isArray(allowedPages) && allowedPages.length > 0;

  const adminOnlyRoutes: string[] = [];
  if (!isAdmin && adminOnlyRoutes.some(r => location === r || location.startsWith(r + "/"))) {
    return <Redirect to="/dashboard" />;
  }

  if (hasPageRestrictions) {
    const roleAllowedRoutes: string[] = [];
    const isAllowedRoute = location === "/" || allowedPages!.some(
      (route) => location === route || location.startsWith(route + "/")
    ) || roleAllowedRoutes.some(r => location === r || location.startsWith(r + "/"));
    if (!isAllowedRoute) {
      return <Redirect to="/dashboard" />;
    }
  }

  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "4.5rem",
  };

  return (
    <MinimizedSectionsProvider>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1 overflow-hidden">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search systems, reports, or employees..." 
                    className="w-80 pl-10 bg-muted/40 border-border/60"
                    data-testid="input-global-search"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <NotificationDropdown />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <Switch>
                <Route path="/">
                  <Redirect to="/dashboard" />
                </Route>
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/my-approvals" component={MyApprovalsPage} />
                <Route path="/erp/procurement/requisitions/new" component={RequisitionNewPage} />
                <Route path="/erp/procurement/requisitions/:id" component={RequisitionDetailPage} />
                <Route path="/erp/procurement/requisitions" component={RequisitionsListPage} />
                <Route path="/intranet/requisitions/new" component={RequisitionNewPage} />
                <Route path="/intranet/requisitions/:id" component={RequisitionDetailPage} />
                <Route path="/intranet/requisitions" component={RequisitionsListPage} />
                <Route path="/erp/finance" component={FinanceDashboard} />
                <Route path="/erp/procurement" component={FinanceDashboard} />
                <Route path="/erp/inventory" component={FinanceDashboard} />
                <Route path="/erp/payments" component={FinanceDashboard} />
                <Route path="/erp">
                  <Redirect to="/erp/finance" />
                </Route>
                <Route path="/finance">
                  <Redirect to="/erp/finance" />
                </Route>
                <Route path="/hr" component={HRMSPage} />
                <Route path="/livery" component={LiveryDashboard} />
                <Route path="/admin" component={AdminDashboard} />
                <Route path="/admin/tickets" component={AdminTicketsPage} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/system-settings" component={SystemSettingsPage} />
                <Route path="/help" component={HelpCenterPage} />
                <Route path="/tickets" component={MyTicketsPage} />
                <Route path="/tickets/new" component={MyTicketsPage} />
                <Route path="/my-tickets" component={MyTicketsPage} />
                <Route path="/other-systems" component={OtherSystemsPage} />
                <Route path="/events" component={EventsPage} />
                <Route path="/intranet" component={IntranetPage} />
                <Route path="/legal" component={LegalPage} />
                <Route path="/ops-fm" component={OpsFMPage} />
                <Route path="/it-dt" component={ITDTPage} />
                <Route path="/projects/group/:groupId" component={ProjectGroupPage} />
                <Route path="/projects/monday" component={ProjectsPage} />
                <Route path="/projects/tuesday" component={ProjectsPage} />
                <Route path="/projects">
                  <Redirect to="/projects/monday" />
                </Route>
                <Route path="/manage-tags" component={ManageTagsPage} />
                <Route path="/applications/customer-db" component={CustomerDBPage} />
                <Route path="/applications/customer-db/:id" component={CustomerProfilePage} />
                <Route path="/azure-tables" component={AzureTablesPage} />
                <Route path="/services/:id" component={DynamicServicePage} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </SidebarInset>
        </div>
        <MinimizedTaskbar />
      </SidebarProvider>
    </MinimizedSectionsProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="unified-portal-theme">
          <TooltipProvider>
            <Switch>
              <Route path="/login" component={LoginPage} />
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password/:token" component={ResetPasswordPage} />
              <Route path="/stable-master/:rest*" component={StableMasterModule} />
              <Route path="/stable-master" component={StableMasterModule} />
              <Route>
                <ProtectedRoutes />
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
