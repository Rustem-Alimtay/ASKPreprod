import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  X,
} from "lucide-react";

export type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type ProjectPriority = "low" | "medium" | "high" | "critical";

export const statusConfig: Record<ProjectStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  not_started: { label: "Not Started", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800", icon: Pause },
  in_progress: { label: "In Progress", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Clock },
  on_hold: { label: "On Hold", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", icon: AlertCircle },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", icon: X },
};

export const priorityColors: Record<ProjectPriority, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const blueprintStatusOptions = [
  { value: "in_development", label: "In Development" },
  { value: "review", label: "In Review" },
  { value: "live", label: "Live" },
  { value: "enhancement_needed", label: "Enhancement Needed" },
];

export const portalSections = [
  { name: "dashboard", title: "Dashboard" },
  { name: "business_units", title: "Business Units" },
  { name: "erp", title: "Finance" },
  { name: "hrms", title: "HRMS" },
  { name: "customer_db", title: "Customer Database" },
  { name: "equestrian", title: "Equestrian Center" },
  { name: "asset_lease", title: "Asset & Lease" },
  { name: "events", title: "Events & Entertainment" },
  { name: "media_marketing", title: "Media & Marketing" },
  { name: "intranet", title: "AKS Request Center" },
  { name: "projects", title: "Projects" },
  { name: "legal", title: "Legal & Compliance" },
  { name: "performance_kpi", title: "Performance & KPIs" },
  { name: "ops_fm", title: "OPS & FM" },
  { name: "it_dt", title: "IT Service Desk" },
];

export function getDeadlineStatus(deadline: string | null, status: string): "overdue" | "due_soon" | null {
  if (!deadline || status === "completed" || status === "cancelled") return null;
  const now = new Date();
  const dl = new Date(deadline);
  if (dl < now) return "overdue";
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (dl.getTime() - now.getTime() < threeDays) return "due_soon";
  return null;
}
