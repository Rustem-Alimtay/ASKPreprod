import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { resolveIcon } from "@/lib/icon-resolver";
import {
  Shield,
  LogOut,
  Ticket,
  Pin,
  PinOff,
  Target,
  CircleDot,
  Home,
  Warehouse,
  Fence,
  Loader2,
  ChevronDown,
  ShoppingCart,
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
import type { ExternalService } from "@shared";
import { useToast } from "@/hooks/use-toast";
import { Fragment, useState } from "react";

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
          <Link href="/intranet" className="flex items-center gap-2.5">
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
              {filteredServices?.map((service) => {
                const IconComponent = resolveIcon(service.icon || "");
                const isActive = location === service.url || 
                  (!!service.url && location.startsWith(service.url));

                const serviceSlug = service.name.toLowerCase().replace(/[()&]/g, '').replace(/\s+/g, '-');
                const serviceUrl = service.url || "#";

                if (serviceUrl === "/applications/customer-db") {
                  return (
                    <Fragment key={service.id}>
                      <SidebarMenuItem>
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
                    </Fragment>
                  );
                }

                if (serviceUrl === "/erp") {
                  return (
                    <Collapsible
                      key={service.id}
                      defaultOpen={location.startsWith("/erp") || location === "/my-approvals"}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={location.startsWith("/erp") || location === "/my-approvals"}
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
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location.startsWith("/erp/procurement/requisitions")}
                                data-testid="nav-sub-erp-requisitions"
                              >
                                <Link href="/erp/procurement/requisitions">
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  <span>Requisitions</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === "/my-approvals"}
                                data-testid="nav-sub-my-approvals"
                              >
                                <Link href="/my-approvals">
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                  <span>My Approvals</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
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
            <div
              className="flex items-center gap-2.5 flex-1 rounded-md p-1 -m-1"
              data-testid="user-profile"
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
            </div>
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
