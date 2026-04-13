import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type SectionState = "normal" | "expanded" | "minimized";

interface MinimizedSection {
  id: string;
  title: string;
  icon?: LucideIcon;
  restore: () => void;
}

interface MinimizedContextType {
  minimizedSections: MinimizedSection[];
  addMinimized: (section: MinimizedSection) => void;
  removeMinimized: (id: string) => void;
}

const MinimizedContext = createContext<MinimizedContextType>({
  minimizedSections: [],
  addMinimized: () => {},
  removeMinimized: () => {},
});

export function useMinimizedSections() {
  return useContext(MinimizedContext);
}

export function MinimizedSectionsProvider({ children }: { children: ReactNode }) {
  const [minimizedSections, setMinimizedSections] = useState<MinimizedSection[]>([]);

  const addMinimized = useCallback((section: MinimizedSection) => {
    setMinimizedSections((prev) => {
      if (prev.find((s) => s.id === section.id)) return prev;
      return [...prev, section];
    });
  }, []);

  const removeMinimized = useCallback((id: string) => {
    setMinimizedSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <MinimizedContext.Provider value={{ minimizedSections, addMinimized, removeMinimized }}>
      {children}
    </MinimizedContext.Provider>
  );
}

export function MinimizedTaskbar() {
  const { minimizedSections } = useMinimizedSections();

  if (minimizedSections.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 border-t border-border bg-background/95 backdrop-blur-sm px-3 py-1.5"
      data-testid="minimized-taskbar"
    >
      {minimizedSections.map((section) => {
        const Icon = section.icon;
        return (
          <Button
            key={section.id}
            variant="ghost"
            size="sm"
            onClick={section.restore}
            className="gap-1.5 text-xs"
            data-testid={`taskbar-item-${section.id}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
            <span className="max-w-[120px] truncate">{section.title}</span>
          </Button>
        );
      })}
    </div>
  );
}

interface ExpandableSectionProps {
  id?: string;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultExpanded?: boolean;
  allowClose?: boolean;
  maxHeight?: string;
  className?: string;
}

export function ExpandableSection({
  id,
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
  allowClose = false,
  maxHeight,
  className,
}: ExpandableSectionProps) {
  const sectionId = id || title.toLowerCase().replace(/\s+/g, "-");
  const [state, setState] = useState<SectionState>("normal");
  const [isClosed, setIsClosed] = useState(false);
  const { addMinimized, removeMinimized } = useMinimizedSections();

  const handleExpand = useCallback(() => {
    removeMinimized(sectionId);
    setState("expanded");
  }, [sectionId, removeMinimized]);

  const handleMinimize = useCallback(() => {
    setState("minimized");
    addMinimized({
      id: sectionId,
      title,
      icon: Icon,
      restore: () => {
        removeMinimized(sectionId);
        setState("normal");
      },
    });
  }, [sectionId, title, Icon, addMinimized, removeMinimized]);

  const handleRestore = useCallback(() => {
    removeMinimized(sectionId);
    setState("normal");
  }, [sectionId, removeMinimized]);

  useEffect(() => {
    return () => {
      removeMinimized(sectionId);
    };
  }, [sectionId, removeMinimized]);

  if (isClosed) return null;

  if (state === "minimized") return null;

  if (state === "expanded") {
    return (
      <div
        className="flex flex-col border border-border rounded-md bg-background shadow-lg"
        style={{ minHeight: "70vh" }}
        data-testid="expandable-section-expanded"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 bg-muted/30 rounded-t-md">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <h3 className="text-sm font-semibold font-outfit">{title}</h3>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMinimize}
              title="Minimize to taskbar"
              data-testid="button-minimize-section"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRestore}
              title="Restore"
              data-testid="button-restore-section"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            {allowClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  removeMinimized(sectionId);
                  setState("normal");
                  setIsClosed(true);
                }}
                data-testid="button-close-section"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h3 className="text-lg font-semibold font-outfit">{title}</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            title="Minimize to taskbar"
            data-testid="button-minimize-section-inline"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExpand}
            title="Expand"
            data-testid="button-expand-section"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          {allowClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsClosed(true)}
              data-testid="button-close-section-inline"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div
        className={cn("rounded-md", maxHeight && "overflow-auto")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
