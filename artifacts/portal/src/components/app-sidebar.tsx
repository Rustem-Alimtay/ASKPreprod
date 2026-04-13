import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { resolveIcon } from "@/lib/icon-resolver";
import { 
  LayoutDashboard, 
  Shield, 
  LogOut, 
  Ticket,
  Pin,
  PinOff,
  Calendar,
  Settings,
  ChevronDown,
  LayoutGrid,
  Target,
  CircleDot,
  Home,
  Warehouse,
  DollarSign,
  ShoppingCart,
  Package,
  CreditCard,
  Fence,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExternalService, AllowedSubmodules } from "@shared";
import { CreateSpaceDialog } from "@/components/create-space-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const secondaryNavItems = [
  {
    title: "Users Profile",
    url: "/settings",
    icon: resolveIcon("UserCircle"),
  },
  {
    title: "Settings",
    url: "/system-settings",
    icon: Settings,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isLoading: authLoading, logout, isLoggingOut } = useAuth();
  const { isPinned, togglePinned, state } = useSidebar();
  const { toast } = useToast();
  const [ssoLoading, setSsoLoading] = useState(false);

  const { data: enabledServices } = useQuery<ExternalService[]>({
    queryKey: ["/api/services/enabled"],
    enabled: !!user,
  });

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";


  const { data: myServiceIds } = useQuery<string[]>({
    queryKey: ["/api/my-services"],
    enabled: !!user && !isAdmin,
  });

  const servicesByAccess = isAdmin
    ? enabledServices
    : enabledServices?.filter((s) => myServiceIds?.includes(s.id));

  const allowedPagesRaw = (user as any)?.allowedPages as string[] | null | undefined;
  const hasPageRestrictionsForFilter = !isAdmin && Array.isArray(allowedPagesRaw) && allowedPagesRaw.length > 0;

  const filteredServices = hasPageRestrictionsForFilter
    ? servicesByAccess?.filter((s) => s.url && allowedPagesRaw!.some(p => s.url === p || s.url!.startsWith(p + "/") || p.startsWith(s.url! + "/")))
    : servicesByAccess;
  const isSuperAdmin = user?.role === "superadmin";

  const canAccessSubmodule = (serviceKey: string, submoduleKey: string): boolean => {
    if (isSuperAdmin) return true;
    const allowed = (user as any)?.allowedSubmodules as AllowedSubmodules | null | undefined;
    if (!allowed || !allowed[serviceKey]) return true;
    return allowed[serviceKey].includes(submoduleKey);
  };

  const canAccessPage = (path: string): boolean => {
    if (!hasPageRestrictionsForFilter) return true;
    return allowedPagesRaw!.some(p => path === p || path.startsWith(p + "/"));
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.username || "User";
  };

  const getJobTitle = () => {
    if (user?.jobTitle) {
      return user.jobTitle;
    }
    const roleLabels: Record<string, string> = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      finance: "Finance",
      procurement: "Procurement",
      livery: "Livery",
      others: "User",
    };
    return roleLabels[user?.role || ""] || user?.role || "User";
  };

  return (
    <Sidebar className="bg-sidebar border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary flex-shrink-0">
              <span className="text-sm font-bold text-primary-foreground">U</span>
            </div>
            {state === "expanded" && (
              <span className="text-sm font-semibold text-sidebar-foreground font-outfit whitespace-nowrap">Unified Portal</span>
            )}
          </Link>
          {state === "expanded" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePinned}
              className="h-7 w-7 flex-shrink-0"
              data-testid="button-pin-sidebar"
              title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard" || location === "/"}
                  className="h-9 px-3 rounded-md"
                  data-testid="nav-item-dashboard"
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="text-sm">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {filteredServices?.map((service) => {
                const IconComponent = resolveIcon(service.icon || "");
                const isActive = location === service.url || 
                  (!!service.url && location.startsWith(service.url));

                if (service.url === "/equestrian") {
                  return (
                    <Collapsible key={service.id} defaultOpen={location.startsWith("/equestrian")} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={location.startsWith("/equestrian")}
                            className="h-9 px-3 rounded-md"
                            data-testid="nav-item-equestrian"
                            tooltip="Equestrian"
                          >
                            <IconComponent className="h-4 w-4" />
                            <span className="text-sm">{service.name}</span>
                            <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {canAccessSubmodule("equestrian", "stable-assets") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/equestrian/stable-assets"} data-testid="nav-sub-equestrian-stable-assets">
                                <Link href="/equestrian/stable-assets">
                                  <Warehouse className="h-3.5 w-3.5" />
                                  <span>Stable Assets Manager</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {canAccessSubmodule("equestrian", "stable-master") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location.startsWith("/equestrian/stable-master") && !location.startsWith("/equestrian/stable-master-v1")} data-testid="nav-sub-equestrian-stable-master">
                                <Link href="/equestrian/stable-master">
                                  <CircleDot className="h-3.5 w-3.5" />
                                  <span>Stable Master</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {canAccessSubmodule("equestrian", "stable-master-mvp") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                data-testid="nav-sub-equestrian-stable-master-v1"
                                onClick={async () => {
                                  if (ssoLoading) return;
                                  setSsoLoading(true);
                                  try {
                                    const res = await fetch("/api/sso/generate-token", { method: "POST", headers: { "Content-Type": "application/json" } });
                                    if (!res.ok) {
                                      const errorData = await res.json().catch(() => ({ message: "Failed to generate SSO token" }));
                                      toast({ title: "SSO Error", description: errorData.message || "Could not generate access token. Please try again.", variant: "destructive" });
                                      return;
                                    }
                                    const data = await res.json();
                                    const popup = window.open(data.url, "_blank");
                                    if (!popup || popup.closed) {
                                      toast({ title: "Popup Blocked", description: "Your browser blocked the popup. Please allow popups for this site and try again.", variant: "destructive" });
                                    }
                                  } catch {
                                    toast({ title: "Connection Error", description: "Could not connect to the server. Please check your connection and try again.", variant: "destructive" });
                                  } finally {
                                    setSsoLoading(false);
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                {ssoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fence className="h-3.5 w-3.5" />}
                                <span>{ssoLoading ? "Loading..." : "Stable Master MVP"}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                if (service.url === "/erp") {
                  return (
                    <Collapsible key={service.id} defaultOpen={location.startsWith("/erp")} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={location.startsWith("/erp")}
                            className="h-9 px-3 rounded-md"
                            data-testid="nav-item-erp"
                            tooltip="ERP"
                          >
                            <IconComponent className="h-4 w-4" />
                            <span className="text-sm">{service.name}</span>
                            <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {canAccessSubmodule("erp", "finance") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/erp/finance"} data-testid="nav-sub-erp-finance">
                                <Link href="/erp/finance">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  <span>Finance</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {canAccessSubmodule("erp", "procurement") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location.startsWith("/erp/procurement")} data-testid="nav-sub-erp-procurement">
                                <Link href="/erp/procurement">
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  <span>Procurement</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {canAccessSubmodule("erp", "inventory") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/erp/inventory"} data-testid="nav-sub-erp-inventory">
                                <Link href="/erp/inventory">
                                  <Package className="h-3.5 w-3.5" />
                                  <span>Inventory</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {isAdmin && canAccessSubmodule("erp", "payments") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/erp/payments"} data-testid="nav-sub-erp-payments">
                                <Link href="/erp/payments">
                                  <CreditCard className="h-3.5 w-3.5" />
                                  <span>Payments</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                if (service.url === "/projects") {
                  return (
                    <Collapsible key={service.id} defaultOpen={location.startsWith("/projects")} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={location.startsWith("/projects")}
                            className="h-9 px-3 rounded-md"
                            data-testid="nav-item-projects"
                            tooltip="Projects"
                          >
                            <IconComponent className="h-4 w-4" />
                            <span className="text-sm">{service.name}</span>
                            <div className="ml-auto flex items-center gap-1">
                              <CreateSpaceDialog />
                              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {canAccessSubmodule("projects", "monday") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/projects/monday"} data-testid="nav-sub-projects-monday">
                                <Link href="/projects/monday">
                                  <LayoutGrid className="h-3.5 w-3.5" />
                                  <span>Monday</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                            {canAccessSubmodule("projects", "tuesday") && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={location === "/projects/tuesday"} data-testid="nav-sub-projects-tuesday">
                                <Link href="/projects/tuesday">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>Tuesday</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                const serviceSlug = service.name.toLowerCase().replace(/[()&]/g, '').replace(/\s+/g, '-');
                const serviceUrl = service.url || "#";

                if (serviceUrl === "/applications/customer-db") {
                  return (
                    <SidebarMenuItem key={service.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-9 px-3 rounded-md"
                        data-testid={`nav-item-${serviceSlug}`}
                        tooltip={service.name}
                      >
                        <Link href={serviceUrl}>
                          <IconComponent className="h-4 w-4" />
                          <span className="text-sm">{service.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                if (service.isExternal) {
                  return (
                    <SidebarMenuItem key={service.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-9 px-3 rounded-md"
                        data-testid={`nav-item-${serviceSlug}`}
                        tooltip={service.name}
                      >
                        <Link href={serviceUrl}>
                          <IconComponent className="h-4 w-4" />
                          <span className="text-sm">{service.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={service.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-9 px-3 rounded-md"
                      data-testid={`nav-item-${serviceSlug}`}
                      tooltip={service.name}
                    >
                      <Link href={serviceUrl}>
                        <IconComponent className="h-4 w-4" />
                        <span className="text-sm">{service.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Workflow
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/my-approvals"}
                  className="h-9 px-3 rounded-md"
                  data-testid="nav-item-my-approvals"
                  tooltip="My Approvals"
                >
                  <Link href="/my-approvals">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="text-sm">My Approvals</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin"}
                    className="h-9 px-3 rounded-md"
                    data-testid="nav-item-admin"
                    tooltip="User Management"
                  >
                    <Link href="/admin">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">User Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/tickets"}
                    className="h-9 px-3 rounded-md"
                    data-testid="nav-item-admin-tickets"
                    tooltip="Ticket Management"
                  >
                    <Link href="/admin/tickets">
                      <Ticket className="h-4 w-4" />
                      <span className="text-sm">Ticket Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Stable Master
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/stable-master")}
                  className="h-9 px-3 rounded-md"
                  data-testid="nav-item-stable-master"
                  tooltip="Stable Master"
                >
                  <Link href="/stable-master">
                    <Fence className="h-4 w-4" />
                    <span className="text-sm">Stable Master</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pt-4">
          <SidebarGroupLabel className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavItems
                .filter((item) => !item.adminOnly || isAdmin)
                .filter((item) => canAccessPage(item.url))
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    className="h-9 px-3 rounded-md"
                    data-testid={`nav-item-${item.title.toLowerCase()}`}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-2.5">
        {authLoading ? (
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            {state === "expanded" && (
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            )}
          </div>
        ) : user ? (
          <div className="flex items-center justify-between gap-2">
            <Link 
              href="/settings" 
              className="flex items-center gap-2.5 flex-1 rounded-md p-1 -m-1 hover-elevate cursor-pointer"
              data-testid="link-user-profile"
            >
              <Avatar className="h-8 w-8 bg-primary/10 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">{getInitials()}</AvatarFallback>
              </Avatar>
              {state === "expanded" && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">{getDisplayName()}</span>
                  <span className="text-[11px] text-muted-foreground">{getJobTitle()}</span>
                </div>
              )}
            </Link>
            {state === "expanded" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                disabled={isLoggingOut}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
