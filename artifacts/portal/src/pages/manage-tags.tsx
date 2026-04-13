import { OtherModulesSection } from "@/components/other-modules-section";
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Pencil, Trash2, Tag } from "lucide-react";

type ProjectTag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
};

export default function ManageTagsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null);
  const [tagName, setTagName] = useState("");

  const { data: tags = [], isLoading } = useQuery<ProjectTag[]>({
    queryKey: ["/api/project-tags"],
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiRequest("POST", "/api/project-tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-tags"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Tag created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: error?.message || "Failed to create tag", 
        variant: "destructive" 
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      apiRequest("PATCH", `/api/project-tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-tags"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Tag updated successfully" });
    },
    onError: () => toast({ title: "Failed to update tag", variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/project-tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-tags"] });
      toast({ title: "Tag deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete tag", variant: "destructive" }),
  });

  const resetForm = () => {
    setTagName("");
    setEditingTag(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tag: ProjectTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!tagName.trim()) return;

    if (editingTag) {
      updateTagMutation.mutate({ 
        id: editingTag.id, 
        data: { name: tagName } 
      });
    } else {
      createTagMutation.mutate({ name: tagName });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-outfit">Manage Tags</h1>
          <p className="text-muted-foreground">Create and manage task tags</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags
          </CardTitle>
          <Button onClick={openCreateDialog} data-testid="button-create-tag">
            <Plus className="h-4 w-4 mr-2" />
            New Tag
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading tags...</p>
          ) : tags.length === 0 ? (
            <p className="text-muted-foreground">No tags created yet. Click "New Tag" to create one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(tag.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(tag)}
                          data-testid={`button-edit-tag-${tag.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTagMutation.mutate(tag.id)}
                          data-testid={`button-delete-tag-${tag.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Edit Tag" : "Create New Tag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
                data-testid="input-tag-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!tagName.trim() || createTagMutation.isPending || updateTagMutation.isPending}
              data-testid="button-submit-tag"
            >
              {editingTag ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OtherModulesSection />
    </div>
  );
}
