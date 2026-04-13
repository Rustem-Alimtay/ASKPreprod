import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, CreditCard, Tag } from "lucide-react";

const otherFinanceModules = [
  {
    id: "netsuite",
    name: "NetSuite",
    description: "Enterprise resource planning and financial management",
    icon: Globe,
    iconBg: "bg-blue-600",
    status: "Active",
    url: "https://system.netsuite.com",
  },
  {
    id: "qashio",
    name: "Qashio",
    description: "Petty cash and digital card management system",
    icon: CreditCard,
    iconBg: "bg-violet-500",
    status: "Active",
    url: "https://www.qashio.com/",
  },
  {
    id: "tagway",
    name: "Tagway",
    description: "Asset tagging and tracking system",
    icon: Tag,
    iconBg: "bg-amber-500",
    status: "Active",
    url: "https://www.tagwayrfid.com/",
  },
];

export function OtherModulesSection() {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold font-outfit mb-4">Other Modules</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherFinanceModules.map((module) => (
          <Card key={module.id} className="hover-elevate cursor-pointer" onClick={() => window.open(module.url, '_blank')} data-testid={`other-module-${module.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${module.iconBg}`}>
                  <module.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{module.name}</h4>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                      {module.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
