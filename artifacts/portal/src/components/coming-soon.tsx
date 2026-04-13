import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  moduleName: string;
  description?: string;
  plannedFeatures?: string[];
  icon?: any;
}

export function ComingSoon({ moduleName, description, plannedFeatures, icon: Icon }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6" data-testid="coming-soon-container">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : <Construction className="h-8 w-8 text-muted-foreground" />}
        </div>

        <div className="space-y-2">
          <Badge variant="outline" className="text-xs mb-2">Under Development</Badge>
          <h2 className="text-2xl font-semibold font-outfit" data-testid="text-module-name">{moduleName}</h2>
          {description && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
          )}
        </div>

        {plannedFeatures && plannedFeatures.length > 0 && (
          <Card className="text-left">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Planned Capabilities</h3>
              <ul className="space-y-2">
                {plannedFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">&#8226;</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
