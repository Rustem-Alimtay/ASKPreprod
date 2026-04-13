import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const variant = status === "active" || status === "paid"
    ? "default"
    : status === "inactive" || status === "cancelled"
    ? "secondary"
    : "outline";

  return (
    <Badge variant={variant} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
