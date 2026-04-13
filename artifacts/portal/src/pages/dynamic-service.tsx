import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { resolveIconOrNull } from "@/lib/icon-resolver";
import type { ExternalService, PageSectionWithTemplate } from "@shared";

export default function DynamicServicePage() {
  const [, params] = useRoute("/services/:id");
  const serviceId = params?.id || "";

  const { data: service, isLoading: serviceLoading } = useQuery<ExternalService>({
    queryKey: ["/api/services", serviceId],
    enabled: !!serviceId,
  });

  if (serviceLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-service-not-found">Service Not Found</h1>
        <p className="text-muted-foreground">The requested service could not be found.</p>
      </div>
    );
  }

  const renderSection = (section: PageSectionWithTemplate) => {
    const templateType = section.template?.sectionType;

    switch (templateType) {
      case "hero_banner": {
        const HeroIcon = section.icon ? resolveIconOrNull(section.icon) : null;
        return (
          <div className="rounded-md border border-border bg-muted/30 p-6" data-testid={`section-hero-${section.id}`}>
            <div className="flex items-center gap-3">
              {HeroIcon && (
                <div className="p-2 rounded-lg bg-primary/10">
                  <HeroIcon className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold font-outfit">{section.title}</h2>
                {section.subtitle && <p className="text-muted-foreground mt-1">{section.subtitle}</p>}
              </div>
            </div>
          </div>
        );
      }
      case "cards_grid":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid={`section-cards-${section.id}`}>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">No cards configured yet</p>
            </div>
          </div>
        );
      case "data_table":
        return (
          <div className="rounded-md border border-border bg-card p-4" data-testid={`section-table-${section.id}`}>
            <p className="text-sm text-muted-foreground">No data configured yet</p>
          </div>
        );
      case "metrics_row":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid={`section-metrics-${section.id}`}>
            <div className="rounded-md border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">Metric</p>
            </div>
          </div>
        );
      case "list":
        return (
          <div className="rounded-md border border-border bg-card p-4" data-testid={`section-list-${section.id}`}>
            <p className="text-sm text-muted-foreground">No items configured yet</p>
          </div>
        );
      case "iframe_embed":
        return (
          <div className="rounded-md border border-border bg-card p-4 min-h-[200px]" data-testid={`section-iframe-${section.id}`}>
            <p className="text-sm text-muted-foreground">Iframe URL not configured</p>
          </div>
        );
      case "activity_feed":
        return (
          <div className="rounded-md border border-border bg-card p-4" data-testid={`section-activity-${section.id}`}>
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        );
      case "quick_links":
        return (
          <div className="flex flex-wrap gap-2" data-testid={`section-links-${section.id}`}>
            <p className="text-sm text-muted-foreground">No quick links configured</p>
          </div>
        );
      case "tabs":
        return (
          <div className="rounded-md border border-border bg-card p-4" data-testid={`section-tabs-${section.id}`}>
            <p className="text-sm text-muted-foreground">No tabs configured yet</p>
          </div>
        );
      default:
        return (
          <div className="rounded-md border border-border bg-card p-4" data-testid={`section-default-${section.id}`}>
            <p className="text-sm text-muted-foreground">Section: {section.title}</p>
          </div>
        );
    }
  };

  return (
    <ServicePageLayout
      serviceId={serviceId}
      title={service.name}
      subtitle={service.description || undefined}
      renderSection={renderSection}
    >
      <OtherModulesSection />
    </ServicePageLayout>
  );
}
