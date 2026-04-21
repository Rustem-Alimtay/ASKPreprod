import { lazy, type ComponentType } from "react";

// All page components are lazy-loaded so they don't bloat the initial bundle.
// The <Suspense> boundary in App.tsx handles the loading fallback.
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminTicketsPage = lazy(() => import("@/pages/admin-tickets"));
const SystemSettingsPage = lazy(() => import("@/pages/system-settings"));
const HelpCenterPage = lazy(() => import("@/pages/help-center"));
const MyTicketsPage = lazy(() => import("@/pages/my-tickets"));
const IntranetPage = lazy(() => import("@/pages/intranet"));
const CustomerDBPage = lazy(() => import("@/pages/customer-db"));
const CustomerProfilePage = lazy(() => import("@/pages/customer-profile"));
const DynamicServicePage = lazy(() => import("@/pages/dynamic-service"));
const RequisitionsListPage = lazy(() => import("@/pages/requisitions-list"));
const RequisitionNewPage = lazy(() => import("@/pages/requisition-new"));
const RequisitionDetailPage = lazy(() => import("@/pages/requisition-detail"));
const MyApprovalsPage = lazy(() => import("@/pages/my-approvals"));
const NotFound = lazy(() => import("@/pages/not-found"));

export type RouteEntry =
  | { kind: "route"; path: string; component: ComponentType<any> }
  | { kind: "redirect"; path: string; redirectTo: string }
  | { kind: "fallback"; component: ComponentType<any> };

export const protectedRoutes: RouteEntry[] = [
  { kind: "redirect", path: "/", redirectTo: "/intranet" },
  { kind: "route", path: "/my-approvals", component: MyApprovalsPage },
  { kind: "route", path: "/intranet/requisitions/new", component: RequisitionNewPage },
  { kind: "route", path: "/intranet/requisitions/:id", component: RequisitionDetailPage },
  { kind: "route", path: "/intranet/requisitions", component: RequisitionsListPage },
  { kind: "route", path: "/admin", component: AdminDashboard },
  { kind: "route", path: "/admin/tickets", component: AdminTicketsPage },
  { kind: "route", path: "/admin/system-settings", component: SystemSettingsPage },
  { kind: "route", path: "/help", component: HelpCenterPage },
  { kind: "route", path: "/tickets", component: MyTicketsPage },
  { kind: "route", path: "/tickets/new", component: MyTicketsPage },
  { kind: "route", path: "/my-tickets", component: MyTicketsPage },
  { kind: "route", path: "/intranet", component: IntranetPage },
  { kind: "route", path: "/applications/customer-db", component: CustomerDBPage },
  { kind: "route", path: "/applications/customer-db/:id", component: CustomerProfilePage },
  { kind: "route", path: "/services/:id", component: DynamicServicePage },
  { kind: "fallback", component: NotFound },
];

// Dev-time assertion: the fallback must be the last entry (wouter Switch matches in order).
if (import.meta.env?.DEV) {
  const fallbackIdx = protectedRoutes.findIndex((r) => r.kind === "fallback");
  if (fallbackIdx >= 0 && fallbackIdx !== protectedRoutes.length - 1) {
    console.error("routes-config: fallback must be the last entry");
  }
}
