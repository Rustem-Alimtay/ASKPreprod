import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

const SPACE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b"];

export function CreateSpaceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const { toast } = useToast();

  const createSpaceMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color: string }) => {
      const res = await apiRequest("POST", "/api/spaces", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/hierarchy"] });
      setOpen(false);
      setName("");
      setDescription("");
      setColor("#6366f1");
      toast({ title: "Space created successfully" });
    },
    onError: () => toast({ title: "Failed to create space", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    createSpaceMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="flex items-center justify-center h-5 w-5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setOpen(true); } }}
        data-testid="button-sidebar-new-space"
      >
        <Plus className="h-3.5 w-3.5" />
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setDescription(""); setColor("#6366f1"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-outfit">Create Space</DialogTitle>
            <DialogDescription>Spaces are department-level groupings for organizing projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Space Name</Label>
              <Input
                placeholder="Enter space name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                data-testid="input-sidebar-space-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the space..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[80px]"
                data-testid="input-sidebar-space-description"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SPACE_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`w-8 h-8 rounded-md cursor-pointer ring-offset-background transition-all ${color === c ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    data-testid={`swatch-sidebar-space-${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || createSpaceMutation.isPending}
              data-testid="button-sidebar-save-space"
            >
              Create Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
