import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RefreshCw, Clock } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  lastSync?: string;
  connectionStatus?: "connected" | "disconnected" | "syncing";
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardHeader({
  title,
  description,
  lastSync,
  connectionStatus,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="dashboard-title">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground" data-testid="dashboard-description">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {connectionStatus && <StatusBadge status={connectionStatus} />}
        {lastSync && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="last-sync">
            <Clock className="h-3.5 w-3.5" />
            <span>Last sync: {lastSync}</span>
          </div>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}
