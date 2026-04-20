import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Receipt,
  FileText,
  Users,
  Building2,
  Box,
  Package,
  ClipboardList,
  FilePlus,
  CreditCard,
  FileBarChart,
  BarChart3,
  UserCog,
  History,
  ArrowRightLeft,
  ArrowLeft,
} from "lucide-react";
import { Horseshoe } from "./icons/horseshoe";

const navGroups = [
  {
    label: "Billing Element",
    adminOnly: false,
    items: [
      { title: "Billing Elements", url: "/billing-elements", icon: Receipt },
    ],
  },
  {
    label: "Livery Agreements",
    adminOnly: false,
    items: [
      { title: "Current Agreements", url: "/agreements/current", icon: FileText },
      { title: "New Agreement", url: "/agreements/new", icon: FilePlus },
      { title: "History", url: "/agreements/history", icon: History },
    ],
  },
  {
    label: "Master Data",
    adminOnly: false,
    items: [
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Horses", url: "/horses", icon: Horseshoe },
      { title: "Stables", url: "/stables", icon: Building2 },
      { title: "Boxes", url: "/boxes", icon: Box },
      { title: "Items", url: "/items", icon: Package },
    ],
  },
  {
    label: "Stable Management",
    adminOnly: false,
    items: [
      { title: "Horse Movements", url: "/stable-management/horse-movements", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Billing",
    adminOnly: false,
    items: [
      { title: "To Invoice", url: "/billing/to-invoice", icon: ClipboardList },
      { title: "Invoices", url: "/billing/invoices", icon: CreditCard },
    ],
  },
  {
    label: "Reports",
    adminOnly: false,
    items: [
      { title: "Livery Reports", url: "/reports/livery", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { title: "Users", url: "/admin/users", icon: UserCog },
    ],
  },
];

interface AppSidebarProps {
  userRole: string;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Horseshoe className="w-5 h-5" inverted />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight" data-testid="text-app-title">StableMaster</h1>
              <p className="text-xs text-muted-foreground">Stable Management</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.filter(group => !group.adminOnly || userRole === "ADMIN").map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url || location.startsWith(item.url + "/")}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {group.label === "Administration" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="~/intranet" data-testid="link-nav-back-to-portal">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Portal</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {userRole !== "ADMIN" && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="~/intranet" data-testid="link-nav-back-to-portal">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Portal</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
