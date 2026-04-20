import { Component, Suspense, type ReactNode } from "react";
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
import { MinimizedSectionsProvider, MinimizedTaskbar } from "@/components/expandable-section";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import StableMasterModule from "@/pages/stable-master/index";
import { protectedRoutes } from "@/routes/routes-config";

class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error("App error:", error, info);
  }
  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 font-sans">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">An unexpected error occurred. Please try again.</p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const sidebarStyle = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "4.5rem",
} as React.CSSProperties;

const FullScreenSpinner = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const PageSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Redirect to="/login" />;

  const allowedPages = user.allowedPages;
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const hasPageRestrictions =
    !isAdmin && Array.isArray(allowedPages) && allowedPages.length > 0;

  if (hasPageRestrictions) {
    const isAllowedRoute =
      location === "/" ||
      allowedPages!.some((route) => location === route || location.startsWith(route + "/"));
    if (!isAllowedRoute) return <Redirect to="/intranet" />;
  }

  return (
    <MinimizedSectionsProvider>
      <SidebarProvider style={sidebarStyle}>
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
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <ErrorBoundary onReset={() => setLocation("/intranet")}>
                <Suspense fallback={<PageSpinner />}>
                  <Switch>
                    {protectedRoutes.map((route, i) => {
                      if (route.kind === "redirect") {
                        return (
                          <Route key={i} path={route.path}>
                            <Redirect to={route.redirectTo} />
                          </Route>
                        );
                      }
                      if (route.kind === "fallback") {
                        return <Route key={i} component={route.component} />;
                      }
                      return <Route key={i} path={route.path} component={route.component} />;
                    })}
                  </Switch>
                </Suspense>
              </ErrorBoundary>
            </main>
          </SidebarInset>
        </div>
        <MinimizedTaskbar />
      </SidebarProvider>
    </MinimizedSectionsProvider>
  );
}

function App() {
  const [, setLocation] = useLocation();
  return (
    <ErrorBoundary onReset={() => setLocation("/intranet")}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="unified-portal-theme">
          <TooltipProvider>
            <Switch>
              <Route path="/login" component={LoginPage} />
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password/:token" component={ResetPasswordPage} />
              <Route path="/stable-master" nest component={StableMasterModule} />
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
