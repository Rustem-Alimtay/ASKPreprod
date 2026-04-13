import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SubSection {
  id: string;
  title: string;
  icon?: LucideIcon;
  isEnabled?: boolean;
}

interface ServiceSubSidebarProps {
  sections: SubSection[];
  activeSection: string | null;
  onSectionClick: (id: string) => void;
  className?: string;
}

export function ServiceSubSidebar({
  sections,
  activeSection,
  onSectionClick,
  className,
}: ServiceSubSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const enabledSections = sections.filter((s) => s.isEnabled !== false);

  if (enabledSections.length === 0) return null;

  return (
    <div
      className={cn(
        "flex-shrink-0 border-r border-border bg-muted/20 transition-all duration-200 relative",
        collapsed ? "w-10" : "w-48",
        className
      )}
      data-testid="service-sub-sidebar"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapse}
        className="absolute -right-3 top-3 z-10 h-6 w-6 rounded-full border border-border bg-background shadow-sm"
        data-testid="button-toggle-sub-sidebar"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
      <div className="flex flex-col gap-0.5 p-2 pt-3">
        {enabledSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <Button
              key={section.id}
              variant="ghost"
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "justify-start text-xs gap-2",
                collapsed && "justify-center px-0",
                isActive && "bg-primary/10 text-primary"
              )}
              title={collapsed ? section.title : undefined}
              data-testid={`subsection-${section.id}`}
            >
              {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
              {!collapsed && (
                <span className="truncate">{section.title}</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
