import { useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = "28rem",
}: DetailPanelProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="detail-panel-backdrop"
      />
      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full flex-col border-l border-border bg-background shadow-lg",
          "animate-in slide-in-from-right duration-200"
        )}
        style={{ width }}
        data-testid="detail-panel"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold font-outfit truncate">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-detail-panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="border-t border-border px-6 py-4">{footer}</div>
        )}
      </div>
    </>
  );
}
