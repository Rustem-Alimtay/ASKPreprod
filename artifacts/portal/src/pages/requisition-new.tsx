import { OtherModulesSection } from "@/components/other-modules-section";
import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Upload, X, FileText, Image, Loader2, AlertCircle, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Department } from "@shared";

interface BudgetOwner {
  id: string;
  name: string;
  departmentIds: number[];
}

interface AttachmentFile {
  file: File;
  preview: string;
}

interface EmployeeProfile {
  full_name: string | null;
  position: string | null;
  department_english: string | null;
  cost_center: string | null;
  cost_center_account_number: string | null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const todayStr = new Date().toISOString().slice(0, 10);

export default function RequisitionNewPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isIntranet = location.startsWith("/intranet");
  const defaultBack = isIntranet ? "/intranet/requisitions" : "/erp/procurement";
  const returnTo = new URLSearchParams(window.location.search).get("from") || defaultBack;

  const { data: employeeProfile, isLoading: isLoadingProfile, isError: isProfileError, error: profileError } = useQuery<EmployeeProfile | null>({
    queryKey: ["/api/employee-profile"],
    queryFn: async () => {
      const res = await fetch("/api/employee-profile", { credentials: "include" });
      if (res.status === 404) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Employee profile endpoint not available. The application may need to be redeployed.");
      }
      if (!res.ok) throw new Error("Failed to fetch employee profile");
      return res.json();
    },
    retry: false,
  });

  const { data: activeDepartments = [], isLoading: isLoadingDepts, isError: isDeptsError } = useQuery<Department[]>({
    queryKey: ["/api/departments", { active: "true" }],
    queryFn: async () => {
      const res = await fetch("/api/departments?active=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
  });

  const { data: budgetOwners = [], isLoading: isLoadingBudgetOwners } = useQuery<BudgetOwner[]>({
    queryKey: ["/api/budget-owners"],
    queryFn: async () => {
      const res = await fetch("/api/budget-owners", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch budget owners");
      return res.json();
    },
  });

  const [budgetOwnerDropdownOpen, setBudgetOwnerDropdownOpen] = useState(false);
  const [selectedBudgetOwner, setSelectedBudgetOwner] = useState<BudgetOwner | null>(null);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);

  const profileNotFound = !isLoadingProfile && !isProfileError && employeeProfile === null;

  const [form, setForm] = useState({
    date: todayStr,
    requestTitle: "",
    department: "",
    requestedBy: "",
    position: "",
    dateOfRequest: todayStr,
    description: "",
    justification: "",
    estimatedCostAed: "",
    budgetLineAccountCode: "",
    isBudgeted: "",
    vendorName: "",
    requiredByDate: "",
    projectStartDate: "",
    budgetOwnerId: "",
    budgetOwnerName: "",
  });

  const filteredDepartments = selectedBudgetOwner
    ? activeDepartments.filter((dept) => selectedBudgetOwner.departmentIds.includes(dept.internalId))
    : [];

  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.requestTitle.trim()) e.requestTitle = "Request Title is required";
    if (!form.department.trim()) e.department = "Department is required";
    if ((profileNotFound || isProfileError) && !form.requestedBy.trim()) e.requestedBy = "Requested By is required";
    if (!form.dateOfRequest) e.dateOfRequest = "Date of Request is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.justification.trim()) e.justification = "Justification is required";
    if (!form.estimatedCostAed || Number(form.estimatedCostAed) <= 0) e.estimatedCostAed = "Estimated Cost is required and must be > 0";
    if (!form.isBudgeted) e.isBudgeted = "Please select Yes or No";
    if (!form.requiredByDate) e.requiredByDate = "Required By Date is required";
    if (!form.date) e.date = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const attachmentData = await Promise.all(
        attachments.map(async (a) => ({
          filename: a.file.name,
          fileType: a.file.type,
          fileSize: a.file.size,
          fileData: await toBase64(a.file),
        }))
      );

      const requestedBy = employeeProfile?.full_name || form.requestedBy;

      await apiRequest("POST", "/api/requisitions", {
        ...form,
        requestedBy,
        estimatedCostAed: Math.round(Number(form.estimatedCostAed) * 100),
        isBudgeted: form.isBudgeted === "yes",
        status: "Submitted",
        requesterFullName: employeeProfile?.full_name || null,
        requesterPosition: employeeProfile?.position || null,
        requesterDepartment: employeeProfile?.department_english || null,
        requesterCostCenter: employeeProfile?.cost_center || null,
        requesterCostCenterAccountNumber: employeeProfile?.cost_center_account_number != null ? String(employeeProfile.cost_center_account_number) : null,
        attachments: attachmentData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requisitions"] });
      toast({ title: "Request submitted", description: "Your approval request form has been submitted successfully." });
      navigate(returnTo);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      submitMutation.mutate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f =>
      ["image/jpeg", "image/png", "application/pdf"].includes(f.type)
    );
    if (valid.length < files.length) {
      toast({ title: "Invalid files skipped", description: "Only JPG, PNG, and PDF files are accepted.", variant: "destructive" });
    }
    setAttachments((prev) => [
      ...prev,
      ...valid.map((file) => ({ file, preview: file.name })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)} data-testid="button-back-list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-outfit" data-testid="text-form-title">Approval Request Form</h1>
          <p className="text-muted-foreground">Submit a new procurement requisition</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} data-testid="input-date" />
              {errors.date && <p className="text-xs text-destructive" data-testid="error-date">{errors.date}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">1. Requester Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoadingProfile ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4" data-testid="loading-employee-profile">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading your employee profile...</span>
              </div>
            ) : isProfileError ? (
              <div className="flex items-start gap-2 p-4 rounded-lg border border-destructive/50 bg-destructive/10" data-testid="employee-profile-error">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{profileError?.message || "Failed to load your employee profile."} You can still submit the form manually.</p>
              </div>
            ) : profileNotFound ? (
              <div className="flex items-start gap-2 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="employee-profile-not-found">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">Your employee profile was not found in the directory. Please contact your administrator.</p>
              </div>
            ) : employeeProfile ? (
              <div className="space-y-4" data-testid="employee-profile-info">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name</Label>
                    <Input value={employeeProfile.full_name || ""} disabled className="bg-muted text-muted-foreground" data-testid="input-requester-full-name" />
                  </div>
                  <div className="space-y-1">
                    <Label>Position</Label>
                    <Input value={employeeProfile.position || ""} disabled className="bg-muted text-muted-foreground" data-testid="input-requester-position" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Department</Label>
                    <Input value={employeeProfile.department_english || ""} disabled className="bg-muted text-muted-foreground" data-testid="input-requester-department" />
                  </div>
                  <div className="space-y-1">
                    <Label>Cost Center</Label>
                    <Input value={employeeProfile.cost_center || ""} disabled className="bg-muted text-muted-foreground" data-testid="input-requester-cost-center" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Cost Center - Account Number</Label>
                  <Input value={employeeProfile.cost_center_account_number != null ? String(employeeProfile.cost_center_account_number) : ""} disabled className="bg-muted text-muted-foreground" data-testid="input-requester-cost-center-account" />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">2. Request Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="requestTitle">Request Title *</Label>
              <Input id="requestTitle" value={form.requestTitle} onChange={(e) => update("requestTitle", e.target.value)} placeholder="Enter request title" data-testid="input-request-title" />
              {errors.requestTitle && <p className="text-xs text-destructive" data-testid="error-request-title">{errors.requestTitle}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="budgetOwner">Budget Owner</Label>
                <Popover open={budgetOwnerDropdownOpen} onOpenChange={setBudgetOwnerDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="budgetOwner"
                      variant="outline"
                      role="combobox"
                      aria-expanded={budgetOwnerDropdownOpen}
                      aria-label="Select budget owner"
                      disabled={isLoadingBudgetOwners}
                      className="w-full justify-between font-normal"
                      data-testid="input-budget-owner"
                    >
                      {isLoadingBudgetOwners ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading budget owners...</span>
                      ) : (
                        selectedBudgetOwner?.name || "Select budget owner..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search budget owners..." data-testid="input-budget-owner-search" />
                      <CommandList>
                        <CommandEmpty>No budget owner found.</CommandEmpty>
                        <CommandGroup>
                          {budgetOwners.map((owner) => (
                            <CommandItem
                              key={owner.id}
                              value={owner.name}
                              onSelect={() => {
                                if (selectedBudgetOwner?.id === owner.id) {
                                  setSelectedBudgetOwner(null);
                                  setForm((prev) => ({ ...prev, budgetOwnerId: "", budgetOwnerName: "", department: "" }));
                                } else {
                                  setSelectedBudgetOwner(owner);
                                  setForm((prev) => ({ ...prev, budgetOwnerId: owner.id, budgetOwnerName: owner.name, department: "" }));
                                }
                                setBudgetOwnerDropdownOpen(false);
                                if (errors.department) setErrors((prev) => ({ ...prev, department: "" }));
                              }}
                              data-testid={`option-budget-owner-${owner.id}`}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedBudgetOwner?.id === owner.id ? "opacity-100" : "opacity-0")} />
                              {owner.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="department">Department *</Label>
                <Popover open={deptDropdownOpen} onOpenChange={setDeptDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="department"
                      variant="outline"
                      role="combobox"
                      aria-expanded={deptDropdownOpen}
                      aria-label="Select department"
                      disabled={isLoadingDepts}
                      className="w-full justify-between font-normal"
                      data-testid="input-department"
                    >
                      {isLoadingDepts ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading departments...</span>
                      ) : (
                        form.department || "Select department..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search departments..." data-testid="input-department-search" />
                      <CommandList>
                        <CommandEmpty>No department found.</CommandEmpty>
                        <CommandGroup>
                          {filteredDepartments.map((dept) => (
                            <CommandItem
                              key={dept.internalId}
                              value={dept.name}
                              onSelect={() => {
                                update("department", dept.name);
                                setDeptDropdownOpen(false);
                              }}
                              data-testid={`option-department-${dept.internalId}`}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.department === dept.name ? "opacity-100" : "opacity-0")} />
                              {dept.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {isDeptsError && <p className="text-xs text-destructive" data-testid="error-department-load">Failed to load departments. Please refresh the page.</p>}
                {errors.department && <p className="text-xs text-destructive" data-testid="error-department">{errors.department}</p>}
              </div>
              {(profileNotFound || isProfileError) && (
                <div className="space-y-1">
                  <Label htmlFor="requestedBy">Requested By *</Label>
                  <Input id="requestedBy" value={form.requestedBy} onChange={(e) => update("requestedBy", e.target.value)} placeholder="Full name" data-testid="input-requested-by" />
                  {errors.requestedBy && <p className="text-xs text-destructive" data-testid="error-requested-by">{errors.requestedBy}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="position">Position</Label>
                <Input id="position" value={form.position} onChange={(e) => update("position", e.target.value)} placeholder="Job title" data-testid="input-position" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateOfRequest">Date of Request *</Label>
                <Input id="dateOfRequest" type="date" value={form.dateOfRequest} onChange={(e) => update("dateOfRequest", e.target.value)} data-testid="input-date-of-request" />
                {errors.dateOfRequest && <p className="text-xs text-destructive" data-testid="error-date-of-request">{errors.dateOfRequest}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">3. Description of Request</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label htmlFor="description">Please provide a detailed explanation of what is being requested *</Label>
              <Textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} placeholder="Describe the request in detail..." data-testid="input-description" />
              {errors.description && <p className="text-xs text-destructive" data-testid="error-description">{errors.description}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">4. Justification / Business Need</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label htmlFor="justification">Justification *</Label>
              <Textarea id="justification" value={form.justification} onChange={(e) => update("justification", e.target.value)} rows={4} placeholder="Explain the business need and justification..." data-testid="input-justification" />
              {errors.justification && <p className="text-xs text-destructive" data-testid="error-justification">{errors.justification}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">5. Budget Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="estimatedCostAed">Estimated Cost (AED) *</Label>
                <Input id="estimatedCostAed" type="number" step="0.01" min="0" value={form.estimatedCostAed} onChange={(e) => update("estimatedCostAed", e.target.value)} placeholder="0.00" data-testid="input-estimated-cost" />
                {errors.estimatedCostAed && <p className="text-xs text-destructive" data-testid="error-estimated-cost">{errors.estimatedCostAed}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="budgetLineAccountCode">Budget Line / Account Code (if applicable)</Label>
                <Input id="budgetLineAccountCode" value={form.budgetLineAccountCode} onChange={(e) => update("budgetLineAccountCode", e.target.value)} placeholder="e.g., ACC-1234" data-testid="input-budget-line" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Is this budgeted? *</Label>
              <RadioGroup value={form.isBudgeted} onValueChange={(v) => update("isBudgeted", v)} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="budgeted-yes" data-testid="radio-budgeted-yes" />
                  <Label htmlFor="budgeted-yes" className="font-normal">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="budgeted-no" data-testid="radio-budgeted-no" />
                  <Label htmlFor="budgeted-no" className="font-normal">No</Label>
                </div>
              </RadioGroup>
              {errors.isBudgeted && <p className="text-xs text-destructive" data-testid="error-is-budgeted">{errors.isBudgeted}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="vendorName">Vendor Name (if applicable)</Label>
              <Input id="vendorName" value={form.vendorName} onChange={(e) => update("vendorName", e.target.value)} placeholder="Vendor or supplier name" data-testid="input-vendor-name" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">6. Supporting Documents</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-area"
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload files</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF accepted</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30" data-testid={`attachment-${i}`}>
                    {att.file.type === "application/pdf" ? (
                      <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : (
                      <Image className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(att.file.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAttachment(i)} data-testid={`button-remove-attachment-${i}`}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">7. Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="requiredByDate">Required By Date *</Label>
                <Input id="requiredByDate" type="date" value={form.requiredByDate} onChange={(e) => update("requiredByDate", e.target.value)} data-testid="input-required-by-date" />
                {errors.requiredByDate && <p className="text-xs text-destructive" data-testid="error-required-by-date">{errors.requiredByDate}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="projectStartDate">Project / Activity Start Date (if applicable)</Label>
                <Input id="projectStartDate" type="date" value={form.projectStartDate} onChange={(e) => update("projectStartDate", e.target.value)} data-testid="input-project-start-date" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(returnTo)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={submitMutation.isPending} data-testid="button-submit">
            {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </div>
      </form>
      <OtherModulesSection />
    </div>
  );
}
