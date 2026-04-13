import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

type ConnectionStatus = "connected" | "disconnected" | "syncing";

interface StatusBadgeProps {
  status: ConnectionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    connected: {
      icon: Wifi,
      label: "Connected",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    },
    disconnected: {
      icon: WifiOff,
      label: "Disconnected",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    },
    syncing: {
      icon: RefreshCw,
      label: "Syncing",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <Badge variant="outline" className={`gap-1.5 ${className}`} data-testid={`status-badge-${status}`}>
      <Icon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}

type DataStatus = "completed" | "pending" | "failed" | "active" | "on-leave" | "terminated" | "in-transit" | "delivered" | "delayed";

interface DataStatusBadgeProps {
  status: DataStatus;
}

export function DataStatusBadge({ status }: DataStatusBadgeProps) {
  const config: Record<DataStatus, { label: string; className: string }> = {
    completed: {
      label: "Completed",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    pending: {
      label: "Pending",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    failed: {
      label: "Failed",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    active: {
      label: "Active",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    "on-leave": {
      label: "On Leave",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    terminated: {
      label: "Terminated",
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
    "in-transit": {
      label: "In Transit",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    delivered: {
      label: "Delivered",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    delayed: {
      label: "Delayed",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="secondary" className={className} data-testid={`data-status-${status}`}>
      {label}
    </Badge>
  );
}
