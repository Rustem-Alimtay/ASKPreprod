import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as AllLucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Search, Plus, Info, Check, X, Loader2 } from "lucide-react";
import { resolveIconOrNull, registerIcon } from "@/lib/icon-resolver";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IconLibraryEntry, ExternalService } from "@shared";

function getIconComponent(name: string): LucideIcon | undefined {
  const fromRegistry = resolveIconOrNull(name);
  if (fromRegistry) return fromRegistry;
  const fromLucide = (AllLucideIcons as Record<string, unknown>)[name];
  if (fromLucide && typeof fromLucide === "function") return fromLucide as LucideIcon;
  return undefined;
}

function getIconForDisplay(name: string): LucideIcon | undefined {
  return getIconComponent(name);
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  currentServiceId?: string;
}

export function IconPicker({ value, onChange, currentServiceId }: IconPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addIconOpen, setAddIconOpen] = useState(false);
  const [newIconForm, setNewIconForm] = useState({
    name: "",
    label: "",
    category: "custom",
    description: "",
  });
  const { toast } = useToast();

  const { data: icons = [], isLoading: iconsLoading } = useQuery<IconLibraryEntry[]>({
    queryKey: ["/api/icons"],
  });

  const { data: services = [] } = useQuery<ExternalService[]>({
    queryKey: ["/api/admin/services"],
  });

  const usedIconNames = useMemo(() => {
    const used = new Set<string>();
    services.forEach((s) => {
      if (s.icon && s.id !== currentServiceId) {
        used.add(s.icon);
      }
    });
    return used;
  }, [services, currentServiceId]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    icons.forEach((icon) => cats.add(icon.category));
    return Array.from(cats).sort();
  }, [icons]);

  const filteredIcons = useMemo(() => {
    let filtered = icons;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (icon) =>
          icon.name.toLowerCase().includes(q) ||
          icon.label.toLowerCase().includes(q) ||
          (icon.description && icon.description.toLowerCase().includes(q)) ||
          icon.category.toLowerCase().includes(q)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter((icon) => icon.category === selectedCategory);
    }
    return filtered;
  }, [icons, search, selectedCategory]);

  const groupedIcons = useMemo(() => {
    const groups: Record<string, IconLibraryEntry[]> = {};
    filteredIcons.forEach((icon) => {
      if (!groups[icon.category]) groups[icon.category] = [];
      groups[icon.category].push(icon);
    });
    return groups;
  }, [filteredIcons]);

  const addIconMutation = useMutation({
    mutationFn: async (data: typeof newIconForm) => {
      const res = await apiRequest("POST", "/api/admin/icons", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/icons"] });
      toast({ title: "Icon added to library" });
      setAddIconOpen(false);
      setNewIconForm({ name: "", label: "", category: "custom", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add icon", description: error.message, variant: "destructive" });
    },
  });

  function handleAddIcon(e: React.FormEvent) {
    e.preventDefault();
    if (!newIconForm.name || !newIconForm.label) return;
    const IconComp = getIconComponent(newIconForm.name);
    if (!IconComp) {
      toast({
        title: "Invalid icon name",
        description: `"${newIconForm.name}" is not a valid Lucide icon. Use PascalCase names like "Globe", "Shield", "Rocket".`,
        variant: "destructive",
      });
      return;
    }
    registerIcon(newIconForm.name, IconComp);
    addIconMutation.mutate(newIconForm);
  }

  if (iconsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="pl-9"
            data-testid="input-icon-search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddIconOpen(true)}
          data-testid="button-add-custom-icon"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add New
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          data-testid="button-category-all"
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            type="button"
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            className="capitalize"
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            data-testid={`button-category-${cat}`}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="max-h-[280px] overflow-y-auto border rounded-md p-2 space-y-3">
        {Object.keys(groupedIcons).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No icons found</p>
        ) : (
          Object.entries(groupedIcons)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryIcons]) => (
              <div key={category}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  {category}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {categoryIcons.map((icon) => {
                    const IconComp = getIconComponent(icon.name);
                    const isUsed = usedIconNames.has(icon.name);
                    const isSelected = value === icon.name;

                    return (
                      <Tooltip key={icon.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={isUsed}
                            onClick={() => {
                              if (!isUsed) {
                                onChange(isSelected ? "" : icon.name);
                              }
                            }}
                            className={`
                              relative flex flex-col items-center justify-center p-2 rounded-md transition-colors
                              ${isSelected
                                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                                : isUsed
                                  ? "opacity-30 cursor-not-allowed bg-muted"
                                  : "hover-elevate cursor-pointer"
                              }
                            `}
                            data-testid={`icon-pick-${icon.name}`}
                          >
                            {IconComp ? (
                              <IconComp className="h-5 w-5" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">{icon.name.substring(0, 3)}</span>
                            )}
                            {isUsed && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <X className="h-3 w-3 text-muted-foreground/60" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-0.5 right-0.5">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <p className="font-medium">{icon.label}</p>
                          {icon.description && (
                            <p className="text-xs text-muted-foreground">{icon.description}</p>
                          )}
                          {isUsed && (
                            <p className="text-xs text-destructive mt-1">Already used by another service</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{icon.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>

      {value && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {(() => {
            const SelectedIcon = getIconComponent(value);
            return SelectedIcon ? <SelectedIcon className="h-4 w-4" /> : null;
          })()}
          <span>Selected: <span className="font-mono text-foreground">{value}</span></span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            data-testid="button-clear-icon"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={addIconOpen} onOpenChange={setAddIconOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Icon</DialogTitle>
            <DialogDescription>
              Add a new Lucide icon to the library. Use the exact PascalCase name from the Lucide icon set.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddIcon} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-icon-name">Icon Name (Lucide PascalCase)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-icon-name"
                  value={newIconForm.name}
                  onChange={(e) => setNewIconForm({ ...newIconForm, name: e.target.value })}
                  placeholder="e.g. Clipboard, FileText, Monitor"
                  required
                  data-testid="input-new-icon-name"
                />
                {newIconForm.name && (() => {
                  const Preview = getIconComponent(newIconForm.name);
                  return Preview ? (
                    <div className="flex items-center justify-center h-9 w-9 border rounded-md bg-muted">
                      <Preview className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-9 w-9 border rounded-md border-destructive/50 bg-destructive/5">
                      <X className="h-4 w-4 text-destructive" />
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Use the exact Lucide icon name in PascalCase. Examples: Globe, Shield, Rocket, FileText, Monitor, Clipboard, Bell, Lock, Wifi, Cloud.
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-icon-label">Display Label</Label>
              <Input
                id="new-icon-label"
                value={newIconForm.label}
                onChange={(e) => setNewIconForm({ ...newIconForm, label: e.target.value })}
                placeholder="e.g. Clipboard"
                required
                data-testid="input-new-icon-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-icon-category">Category</Label>
              <Input
                id="new-icon-category"
                value={newIconForm.category}
                onChange={(e) => setNewIconForm({ ...newIconForm, category: e.target.value })}
                placeholder="e.g. general, business, technology"
                data-testid="input-new-icon-category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-icon-description">Description</Label>
              <Input
                id="new-icon-description"
                value={newIconForm.description}
                onChange={(e) => setNewIconForm({ ...newIconForm, description: e.target.value })}
                placeholder="Brief description of when to use this icon"
                data-testid="input-new-icon-description"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddIconOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddIcon}
              disabled={addIconMutation.isPending || !newIconForm.name || !newIconForm.label}
              data-testid="button-save-new-icon"
            >
              {addIconMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
