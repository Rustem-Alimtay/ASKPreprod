import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, AlertCircle, Lightbulb, CheckCircle2, Clock, RefreshCw, Construction, Layers, Pencil, Plus } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { BlueprintDialog } from "@/components/blueprint-dialog";
import type { CollaborationBlueprint } from "@shared";

interface CollaborationStampProps {
  blueprint: CollaborationBlueprint | null | undefined;
  compact?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2; bgClass: string }> = {
  in_development: {
    label: "In Development",
    color: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: Construction,
    bgClass: "from-amber-500/10 to-orange-500/10"
  },
  review: {
    label: "In Review",
    color: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: RefreshCw,
    bgClass: "from-blue-500/10 to-cyan-500/10"
  },
  live: {
    label: "Live",
    color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
    bgClass: "from-emerald-500/10 to-green-500/10"
  },
  enhancement_needed: {
    label: "Enhancement Needed",
    color: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    icon: Lightbulb,
    bgClass: "from-purple-500/10 to-violet-500/10"
  }
};

export function CollaborationStamp({ blueprint, compact = false }: CollaborationStampProps) {
  if (!blueprint) return null;

  const config = statusConfig[blueprint.status] || statusConfig.in_development;
  const StatusIcon = config.icon;
  const missingItems = blueprint.missingItems || [];
  const ideas = blueprint.ideas || [];
  const hasEta = blueprint.etaDate;
  const formattedEta = hasEta ? format(new Date(blueprint.etaDate!), "MMM d, yyyy") : null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${config.color} border text-xs font-medium`} data-testid={`status-badge-${blueprint.sectionName}`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
        {hasEta && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formattedEta}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className={`bg-gradient-to-br ${config.bgClass} backdrop-blur-lg border border-white/20 dark:border-white/10 shadow-lg`} data-testid={`collab-stamp-${blueprint.sectionName}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color} border`}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className={`${config.color} border font-medium`} data-testid={`status-badge-${blueprint.sectionName}`}>
                  {config.label}
                </Badge>
                <span className="text-sm font-semibold text-foreground" data-testid={`section-title-${blueprint.sectionName}`}>{blueprint.sectionTitle}</span>
              </div>
              {blueprint.notes && (
                <p className="text-xs text-muted-foreground mt-1 max-w-md" data-testid={`notes-${blueprint.sectionName}`}>{blueprint.notes}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {hasEta && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-background/50 px-2 py-1 rounded-md border border-border/50" data-testid={`eta-container-${blueprint.sectionName}`}>
                <Calendar className="w-4 h-4" />
                <span>ETA: <span className="font-medium text-foreground" data-testid={`eta-value-${blueprint.sectionName}`}>{formattedEta}</span></span>
              </div>
            )}

            {missingItems.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 dark:text-red-400"
                    data-testid={`missing-items-trigger-${blueprint.sectionName}`}
                  >
                    <AlertCircle className="w-4 h-4 mr-1.5" />
                    {missingItems.length} Missing
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" data-testid={`missing-items-popover-${blueprint.sectionName}`}>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5" data-testid={`missing-items-title-${blueprint.sectionName}`}>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Missing Items
                  </h4>
                  <ul className="space-y-1">
                    {missingItems.map((item, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`missing-item-${blueprint.sectionName}-${idx}`}>
                        <span className="text-red-500 mt-1">-</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}

            {ideas.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-violet-700 dark:text-violet-400"
                    data-testid={`ideas-trigger-${blueprint.sectionName}`}
                  >
                    <Lightbulb className="w-4 h-4 mr-1.5" />
                    {ideas.length} Ideas
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" data-testid={`ideas-popover-${blueprint.sectionName}`}>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5" data-testid={`ideas-title-${blueprint.sectionName}`}>
                    <Lightbulb className="w-4 h-4 text-violet-500" />
                    Enhancement Ideas
                  </h4>
                  <ul className="space-y-1">
                    {ideas.map((idea, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`idea-item-${blueprint.sectionName}-${idx}`}>
                        <span className="text-violet-500 mt-1">+</span>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CollaborationStampMini({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.in_development;
  const StatusIcon = config.icon;
  
  return (
    <Badge className={`${config.color} border text-xs font-medium`}>
      <StatusIcon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

const sectionTitleMap: Record<string, string> = {
  dashboard: "Dashboard",
  business_units: "Business Units",
  erp: "Finance",
  hrms: "HRMS",
  customer_db: "Customer Database",
  equestrian: "Equestrian Center",
  asset_lease: "Asset & Lease",
  events: "Events & Entertainment",
  media_marketing: "Media & Marketing",
  intranet: "AKS Request Center",
  projects: "Projects",
  legal: "Legal & Compliance",
  performance_kpi: "Performance & KPIs",
  ops_fm: "Operations & FM",
  it_dt: "IT & Digital Transformation",
};

interface PageCollaborationStampProps {
  sectionName: string;
}

export function PageCollaborationStamp({ sectionName }: PageCollaborationStampProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "superadmin";

  const { data: blueprints } = useQuery<CollaborationBlueprint[]>({
    queryKey: ["/api/blueprints"],
  });

  const blueprint = blueprints?.find(b => b.sectionName === sectionName);
  const defaultTitle = sectionTitleMap[sectionName] || sectionName;

  if (!blueprint) {
    if (!canEdit) return null;
    
    return (
      <>
        <div 
          className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 backdrop-blur-sm border-2 border-violet-500/30 dark:border-violet-400/30 border-dashed shadow-sm mb-6"
          data-testid={`page-stamp-empty-${sectionName}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-400 border border-violet-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-violet-700 dark:text-violet-400 uppercase tracking-wide">Section Blueprint</span>
              <span className="text-sm text-muted-foreground">No blueprint configured for this section</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-violet-500/50 text-violet-700 dark:text-violet-400"
            onClick={() => setDialogOpen(true)}
            data-testid={`page-stamp-create-${sectionName}`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Stamp
          </Button>
        </div>
        <BlueprintDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultSectionName={sectionName}
          defaultSectionTitle={defaultTitle}
        />
      </>
    );
  }

  const config = statusConfig[blueprint.status] || statusConfig.in_development;
  const missingItems = blueprint.missingItems || [];
  const ideas = blueprint.ideas || [];
  const hasEta = blueprint.etaDate;
  const formattedEta = hasEta ? format(new Date(blueprint.etaDate!), "MMM d, yyyy") : null;

  return (
    <>
      <div 
        className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 backdrop-blur-sm border-2 border-violet-500/30 dark:border-violet-400/30 shadow-sm mb-6"
        data-testid={`page-stamp-${sectionName}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-400 border border-violet-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-violet-700 dark:text-violet-400 uppercase tracking-wide">Section Blueprint</span>
            <Badge className={`${config.color} border text-xs font-medium`} data-testid={`page-status-badge-${sectionName}`}>
              {config.label}
            </Badge>
            <span className="text-sm font-semibold text-foreground" data-testid={`page-section-title-${sectionName}`}>
              {blueprint.sectionTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {hasEta && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`page-eta-${sectionName}`}>
              <span className="uppercase font-medium">ETA Delivery</span>
              <span className="font-semibold text-foreground">{formattedEta}</span>
            </div>
          )}

          {missingItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-700 dark:text-red-400"
                  data-testid={`page-missing-trigger-${sectionName}`}
                >
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Missing ({missingItems.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Missing Items
                </h4>
                <ul className="space-y-1">
                  {missingItems.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-red-500 mt-1">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}

          {ideas.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-violet-700 dark:text-violet-400"
                  data-testid={`page-ideas-trigger-${sectionName}`}
                >
                  <Lightbulb className="w-3.5 h-3.5 mr-1" />
                  Ideas ({ideas.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-violet-500" />
                  Enhancement Ideas
                </h4>
                <ul className="space-y-1">
                  {ideas.map((idea, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-violet-500 mt-1">+</span>
                      {idea}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}

          {blueprint.notes && (
            <span className="text-xs text-muted-foreground italic max-w-[200px] truncate" data-testid={`page-notes-${sectionName}`}>
              {blueprint.notes}
            </span>
          )}

          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-violet-700 dark:text-violet-400"
              onClick={() => setDialogOpen(true)}
              data-testid={`page-stamp-edit-${sectionName}`}
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>
      <BlueprintDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        blueprint={blueprint}
      />
    </>
  );
}
