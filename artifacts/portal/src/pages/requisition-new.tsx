import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, X, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type EmployeeProfile = {
  employeeCode: string | null;
  fullName: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  costCenter: string | null;
  costCenterAccountNumber: string | null;
  budgetOwnerCode: string | null;
  budgetOwnerName: string | null;
  directManagerCode: string | null;
  directManagerFullName: string | null;
};

type BudgetOwner = { code: string; name: string };

type PendingFile = {
  filename: string;
  fileType: string;
  fileSize: number;
  fileData: string; // base64 (without data: prefix)
};

const MAX_ATTACHMENT_TOTAL = 40 * 1024 * 1024; // 40 MB (server caps at 50 MB per payload)
const ACCEPT_TYPES = "application/pdf,image/jpeg,image/png";

export default function RequisitionNewPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIntranet = location.startsWith("/intranet");
  const basePath = isIntranet ? "/intranet/requisitions" : "/erp/procurement/requisitions";

  const { data: profile, isLoading: profileLoading } = useQuery<EmployeeProfile | null>({
    queryKey: ["/api/employee-profile"],
  });
  const { data: budgetOwners = [] } = useQuery<BudgetOwner[]>({
    queryKey: ["/api/budget-owners"],
  });

  const [form, setForm] = useState({
    requestTitle: "",
    description: "",
    justification: "",
    estimatedCostAed: "",
    requiredByDate: "",
    projectStartDate: "",
    vendorName: "",
    isBudgeted: false,
    budgetLineAccountCode: "",
    budgetOwnerId: "",
    budgetOwnerName: "",
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Auto-prefill from employee profile
  useEffect(() => {
    if (profile && !form.budgetOwnerId && profile.budgetOwnerCode) {
      setForm((f) => ({
        ...f,
        budgetOwnerId: profile.budgetOwnerCode ?? "",
        budgetOwnerName: profile.budgetOwnerName ?? "",
      }));
    }
  }, [profile]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Employee profile not loaded");
      const today = new Date().toISOString().split("T")[0];
      const body = {
        date: today,
        dateOfRequest: today,
        requestTitle: form.requestTitle,
        description: form.description,
        justification: form.justification,
        estimatedCostAed: Math.round(Number(form.estimatedCostAed) || 0),
        requiredByDate: form.requiredByDate,
        projectStartDate: form.projectStartDate || undefined,
        department: profile.department ?? "",
        requestedBy: profile.fullName ?? "",
        position: profile.position ?? undefined,
        vendorName: form.vendorName || undefined,
        isBudgeted: form.isBudgeted,
        budgetLineAccountCode: form.budgetLineAccountCode || undefined,
        budgetOwnerId: form.budgetOwnerId || undefined,
        budgetOwnerName: form.budgetOwnerName || undefined,
        requesterFullName: profile.fullName ?? undefined,
        requesterPosition: profile.position ?? undefined,
        requesterDepartment: profile.department ?? undefined,
        requesterCostCenter: profile.costCenter ?? undefined,
        requesterCostCenterAccountNumber: profile.costCenterAccountNumber ?? undefined,
        attachments: pendingFiles,
      };
      const res = await apiRequest("POST", "/api/requisitions", body);
      return await res.json();
    },
    onSuccess: (created: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions"] });
      toast({ title: "Requisition created", description: "Workflow started." });
      setLocation(`${basePath}/${created.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create requisition", description: err.message, variant: "destructive" });
    },
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of files) {
      const totalSoFar = pendingFiles.reduce((acc, p) => acc + p.fileSize, 0);
      if (totalSoFar + f.size > MAX_ATTACHMENT_TOTAL) {
        toast({ title: "Attachments too large", description: "Total > 40 MB limit", variant: "destructive" });
        return;
      }
      const b64 = await readAsBase64(f);
      setPendingFiles((prev) => [...prev, { filename: f.name, fileType: f.type, fileSize: f.size, fileData: b64 }]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) {
      toast({ title: "Profile not loaded", description: "Please wait or refresh.", variant: "destructive" });
      return;
    }
    if (!form.requestTitle.trim() || !form.description.trim() || !form.justification.trim()) {
      toast({ title: "Missing fields", description: "Title, description, and justification are required.", variant: "destructive" });
      return;
    }
    if (!form.estimatedCostAed || Number(form.estimatedCostAed) <= 0) {
      toast({ title: "Invalid cost", description: "Estimated cost must be > 0", variant: "destructive" });
      return;
    }
    if (!form.requiredByDate) {
      toast({ title: "Required by date is missing", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="text-lg font-semibold mb-2">Employee profile not found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your account has no matching record in the Employee Directory. Contact an admin to link your employee_code.
            </p>
            <Button asChild variant="outline">
              <Link href={basePath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Requisitions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Button asChild variant="ghost" size="sm" data-testid="button-back">
          <Link href={basePath}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>New Requisition (ARF)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Requester</Label>
                <Input value={profile.fullName || ""} disabled />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={profile.department || ""} disabled />
              </div>
              <div>
                <Label>Cost Center</Label>
                <Input value={profile.costCenter || ""} disabled />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={profile.position || ""} disabled />
              </div>
            </div>

            <div>
              <Label htmlFor="title">Request Title *</Label>
              <Input
                id="title"
                value={form.requestTitle}
                onChange={(e) => setForm({ ...form, requestTitle: e.target.value })}
                placeholder="Short summary of what you need"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="desc">Description *</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed item description, specs, quantity..."
                rows={4}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="just">Justification *</Label>
              <Textarea
                id="just"
                value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })}
                placeholder="Business reason for this purchase..."
                rows={3}
                data-testid="input-justification"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Estimated Cost (AED) *</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedCostAed}
                  onChange={(e) => setForm({ ...form, estimatedCostAed: e.target.value })}
                  data-testid="input-cost"
                />
              </div>
              <div>
                <Label htmlFor="vendor">Preferred Vendor (optional)</Label>
                <Input
                  id="vendor"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="required">Required By *</Label>
                <Input
                  id="required"
                  type="date"
                  value={form.requiredByDate}
                  onChange={(e) => setForm({ ...form, requiredByDate: e.target.value })}
                  data-testid="input-required-by"
                />
              </div>
              <div>
                <Label htmlFor="pstart">Project Start Date (optional)</Label>
                <Input
                  id="pstart"
                  type="date"
                  value={form.projectStartDate}
                  onChange={(e) => setForm({ ...form, projectStartDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Budget Owner</Label>
                <Select
                  value={form.budgetOwnerId}
                  onValueChange={(v) => {
                    const owner = budgetOwners.find((b) => b.code === v);
                    setForm({ ...form, budgetOwnerId: v, budgetOwnerName: owner?.name || "" });
                  }}
                >
                  <SelectTrigger data-testid="select-budget-owner">
                    <SelectValue placeholder="Select budget owner" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {budgetOwners.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bline">Budget Line / Account Code (optional)</Label>
                <Input
                  id="bline"
                  value={form.budgetLineAccountCode}
                  onChange={(e) => setForm({ ...form, budgetLineAccountCode: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="budgeted"
                checked={form.isBudgeted}
                onCheckedChange={(v) => setForm({ ...form, isBudgeted: v })}
              />
              <Label htmlFor="budgeted">This expense is already budgeted</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_TYPES}
              onChange={handleFiles}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-add-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add file (PDF / JPG / PNG)
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Up to 40 MB total. Current: {(pendingFiles.reduce((a, p) => a + p.fileSize, 0) / 1024 / 1024).toFixed(1)} MB
            </p>
            {pendingFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between border rounded-md p-2 text-sm">
                    <span>{f.filename} · {(f.fileSize / 1024).toFixed(0)} KB</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={basePath}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              "Submit Requisition"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      // Strip "data:xxx;base64," prefix to store raw base64 only
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
