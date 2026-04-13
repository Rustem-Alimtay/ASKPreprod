import { UnderDevelopmentBanner } from "@/components/under-development-banner";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { 
  Search, 
  FileText,
  Scale,
  Shield,
  FileCheck,
  AlertTriangle,
  ChevronRight,
  Clock,
  Download,
  Building2,
  Gavel,
  ScrollText
} from "lucide-react";
import type { PageSectionWithTemplate } from "@shared";

const SERVICE_URL = "/legal";

const legalCategories = [
  { id: "contracts", name: "Contracts & Agreements", count: 0, icon: FileCheck, iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30" },
  { id: "compliance", name: "Compliance & Regulatory", count: 0, icon: Shield, iconBg: "bg-green-100 text-green-600 dark:bg-green-900/30" },
  { id: "corporate", name: "Corporate Governance", count: 0, icon: Building2, iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/30" },
  { id: "ip", name: "Intellectual Property", count: 0, icon: ScrollText, iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30" },
];

const recentDocuments: { id: number; name: string; type: string; size: string; date: string; status: string }[] = [];

const complianceAlerts: { id: number; title: string; description: string; priority: string; dueDate: string }[] = [];

const quickLinks = [
  { name: "Contract Request Form", icon: FileText },
  { name: "Legal Review Portal", icon: Scale },
  { name: "Compliance Training", icon: Shield },
  { name: "Policy Library", icon: ScrollText },
];

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">High</Badge>;
    case "medium":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200">Medium</Badge>;
    default:
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">Low</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">Active</Badge>;
    case "review":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200">In Review</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
}

export default function LegalPage() {
  const [searchQuery, setSearchQuery] = useState("");

  function renderSection(section: PageSectionWithTemplate) {
    switch (section.title) {
      case "Legal Overview":
        return (
          <Card className="bg-gradient-to-r from-slate-700 to-slate-900 text-white border-0">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-2">
                <Gavel className="h-8 w-8" />
                <h2 className="text-2xl font-bold font-outfit">Legal & Compliance</h2>
              </div>
              <p className="text-slate-300 mb-6">
                Manage contracts, compliance documents, regulatory requirements, and legal resources.
              </p>
              <div className="relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search contracts, policies, or legal documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  data-testid="input-legal-search"
                />
              </div>
            </CardContent>
          </Card>
        );

      case "Document Categories":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {legalCategories.map((category) => (
              <div 
                key={category.id}
                className="flex items-center gap-3 p-4 rounded-lg border hover-elevate cursor-pointer"
                data-testid={`category-${category.id}`}
              >
                <div className={`p-2.5 rounded-lg ${category.iconBg}`}>
                  <category.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.count} documents</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        );

      case "Recent Documents":
        return (
          <div className="space-y-3">
            {recentDocuments.length === 0 && (
              <p className="text-sm text-muted-foreground">No documents to display.</p>
            )}
            {recentDocuments.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover-elevate"
                data-testid={`document-${doc.id}`}
              >
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.type}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{doc.size}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{doc.date}</span>
                  </div>
                </div>
                {getStatusBadge(doc.status)}
                <Button variant="ghost" size="icon" data-testid={`button-download-${doc.id}`}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        );

      case "Compliance Alerts":
        return (
          <div className="space-y-4">
            {complianceAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No compliance alerts.</p>
            )}
            {complianceAlerts.map((alert) => (
              <div 
                key={alert.id}
                className="p-3 rounded-lg border space-y-2"
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{alert.title}</p>
                  {getPriorityBadge(alert.priority)}
                </div>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Due: {alert.dueDate}
                </div>
              </div>
            ))}
          </div>
        );

      case "Quick Links":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Button 
                key={link.name}
                variant="outline" 
                className="justify-start gap-3"
                data-testid={`link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <link.icon className="h-4 w-4" />
                {link.name}
              </Button>
            ))}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <ServicePageLayout
      serviceUrl={SERVICE_URL}
      title="Legal & Compliance"
      subtitle="Contracts, compliance monitoring, and legal document management"
      collaborationSection="legal"
      renderSection={renderSection}
    >
      <UnderDevelopmentBanner />
      <OtherModulesSection />
    </ServicePageLayout>
  );
}
