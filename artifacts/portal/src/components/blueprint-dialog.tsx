import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertBlueprintSchema } from "@shared";
import type { CollaborationBlueprint, InsertBlueprint } from "@shared";

const blueprintFormSchema = insertBlueprintSchema.extend({
  sectionName: z.string().min(1, "Section is required"),
  sectionTitle: z.string().min(1, "Title is required"),
  missingItems: z.string().optional(),
  ideas: z.string().optional(),
});

type BlueprintFormValues = z.infer<typeof blueprintFormSchema>;

const blueprintStatusOptions = [
  { value: "in_development", label: "In Development" },
  { value: "review", label: "In Review" },
  { value: "live", label: "Live" },
  { value: "enhancement_needed", label: "Enhancement Needed" },
];

const portalSections = [
  { name: "dashboard", title: "Dashboard" },
  { name: "business_units", title: "Business Units" },
  { name: "erp", title: "Finance" },
  { name: "hrms", title: "HRMS" },
  { name: "customer_db", title: "Customer Database" },
  { name: "asset_lease", title: "Asset & Lease" },
  { name: "events", title: "Events & Entertainment" },
  { name: "media_marketing", title: "Media & Marketing" },
  { name: "intranet", title: "AKS Request Center" },
  { name: "projects", title: "Projects" },
];

interface BlueprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blueprint?: CollaborationBlueprint | null;
  defaultSectionName?: string;
  defaultSectionTitle?: string;
}

export function BlueprintDialog({
  open,
  onOpenChange,
  blueprint,
  defaultSectionName,
  defaultSectionTitle,
}: BlueprintDialogProps) {
  const { toast } = useToast();
  const isEditing = !!blueprint;

  const form = useForm<BlueprintFormValues>({
    resolver: zodResolver(blueprintFormSchema),
    defaultValues: {
      sectionName: defaultSectionName || "",
      sectionTitle: defaultSectionTitle || "",
      status: "in_development",
      etaDate: "",
      notes: "",
      missingItems: "",
      ideas: "",
    },
  });

  useEffect(() => {
    if (blueprint) {
      form.reset({
        sectionName: blueprint.sectionName,
        sectionTitle: blueprint.sectionTitle,
        status: blueprint.status as "in_development" | "review" | "live" | "enhancement_needed",
        etaDate: blueprint.etaDate ? format(new Date(blueprint.etaDate), "yyyy-MM-dd") : "",
        notes: blueprint.notes || "",
        missingItems: blueprint.missingItems?.join("\n") || "",
        ideas: blueprint.ideas?.join("\n") || "",
      });
    } else {
      form.reset({
        sectionName: defaultSectionName || "",
        sectionTitle: defaultSectionTitle || "",
        status: "in_development",
        etaDate: "",
        notes: "",
        missingItems: "",
        ideas: "",
      });
    }
  }, [blueprint, open, defaultSectionName, defaultSectionTitle]);

  const createMutation = useMutation({
    mutationFn: (data: InsertBlueprint) => apiRequest("POST", "/api/blueprints", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
      onOpenChange(false);
      toast({ title: "Blueprint created successfully" });
    },
    onError: () => toast({ title: "Failed to create blueprint", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertBlueprint> }) =>
      apiRequest("PATCH", `/api/blueprints/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blueprints"] });
      onOpenChange(false);
      toast({ title: "Blueprint updated successfully" });
    },
    onError: () => toast({ title: "Failed to update blueprint", variant: "destructive" }),
  });

  const handleSubmit = (values: BlueprintFormValues) => {
    const data: InsertBlueprint = {
      sectionName: values.sectionName,
      sectionTitle: values.sectionTitle,
      status: values.status,
      etaDate: values.etaDate || null,
      notes: values.notes || null,
      missingItems: values.missingItems ? values.missingItems.split("\n").filter(Boolean) : [],
      ideas: values.ideas ? values.ideas.split("\n").filter(Boolean) : [],
    };

    if (isEditing && blueprint) {
      updateMutation.mutate({ id: blueprint.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Create"} Collaboration Stamp</DialogTitle>
          <DialogDescription>
            Configure status, ETA, and notes for this section
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sectionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section ID</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isEditing || !!defaultSectionName}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-section-name">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {portalSections.map((section) => (
                          <SelectItem key={section.name} value={section.name}>
                            {section.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sectionTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Dashboard"
                        data-testid="input-section-title"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {blueprintStatusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="etaDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ETA Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-eta-date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional context or description"
                      rows={2}
                      data-testid="input-notes"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="missingItems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Missing Items (one per line)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="API integration&#10;User authentication&#10;..."
                      rows={3}
                      data-testid="input-missing-items"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ideas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enhancement Ideas (one per line)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add charts&#10;Mobile responsive&#10;..."
                      rows={3}
                      data-testid="input-ideas"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="button-submit-blueprint">
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
