import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MetricCard as MetricCardType } from "@shared";

interface MetricCardProps {
  metric: MetricCardType;
  icon?: React.ReactNode;
}

export function MetricCard({ metric, icon }: MetricCardProps) {
  const renderChange = () => {
    if (metric.change === undefined) return null;
    
    const isPositive = metric.change > 0;
    const isNegative = metric.change < 0;
    const isNeutral = metric.change === 0;
    
    return (
      <div className={`flex items-center gap-1 text-xs font-medium ${
        isPositive ? "text-green-600 dark:text-green-400" : 
        isNegative ? "text-red-600 dark:text-red-400" : 
        "text-muted-foreground"
      }`}>
        {isPositive && <TrendingUp className="h-3 w-3" />}
        {isNegative && <TrendingDown className="h-3 w-3" />}
        {isNeutral && <Minus className="h-3 w-3" />}
        <span>{isPositive ? "+" : ""}{metric.change}%</span>
        {metric.changeLabel && (
          <span className="text-muted-foreground ml-1">{metric.changeLabel}</span>
        )}
      </div>
    );
  };

  return (
    <Card className="hover-elevate transition-all duration-200" data-testid={`metric-card-${metric.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {metric.title}
        </CardTitle>
        {icon && (
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{metric.value}</div>
        {renderChange()}
      </CardContent>
    </Card>
  );
}
