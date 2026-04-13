import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { SearchBar } from "../components/search-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Package, Webhook } from "lucide-react";
import type { Item } from "@shared/sm2";

export default function AdminSettingsPage() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [webhookUrl, setWebhookUrl] = useState("");
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/sm2/items"],
  });

  const { data: webhookData } = useQuery<{ url: string }>({
    queryKey: ["/api/sm2/settings/n8n-webhook"],
  });

  useEffect(() => {
    if (webhookData?.url !== undefined) {
      setWebhookUrl(webhookData.url);
    }
  }, [webhookData]);

  useEffect(() => {
    if (items.length > 0) {
      const ids = new Set<string>();
      items.forEach(item => {
        if (item.isLiveryPackage) ids.add(item.id);
      });
      setSelectedIds(ids);
    }
  }, [items]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/sm2/settings/livery-packages", { itemIds: Array.from(selectedIds) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/items"] });
      toast({ title: "Livery package configuration saved" });
    },
  });

  const saveWebhookMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/sm2/settings/n8n-webhook", { url: webhookUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sm2/settings/n8n-webhook"] });
      toast({ title: "N8N Webhook URL saved" });
    },
    onError: () => {
      toast({ title: "Failed to save webhook URL", variant: "destructive" });
    },
  });

  const filteredItems = items.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        description="Configure application settings"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              N8N Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="webhook-url">N8N Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://your-n8n-instance.com/webhook/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="mt-1"
                  data-testid="input-webhook-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The webhook URL where NetSuite SO JSON will be sent for processing
                </p>
              </div>
              <Button
                onClick={() => saveWebhookMutation.mutate()}
                disabled={saveWebhookMutation.isPending}
                data-testid="button-save-webhook"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Livery Packages
              </CardTitle>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-settings">
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <SearchBar
                placeholder="Search items..."
                value={search}
                onChange={setSearch}
                className="max-w-sm"
              />
            </div>

            {isLoading ? (
              <div className="text-muted-foreground">Loading items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No items found</div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedIds.has(item.id)
                        ? "bg-primary/5 border-primary/20"
                        : "border-border"
                    }`}
                    onClick={() => toggleItem(item.id)}
                    data-testid={`item-livery-toggle-${item.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      {item.department && (
                        <span className="text-sm text-muted-foreground ml-2">({item.department})</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.price ? `AED ${item.price}` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-sm text-muted-foreground">
              {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected as livery packages
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
