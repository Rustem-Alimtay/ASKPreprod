import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { ManagedUser, AdminStats, ExternalService, AllowedSubmodules } from "@shared";
import { submoduleRegistry } from "@shared";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users, UserPlus, Shield, Activity, Loader2, Pencil, Trash2, Settings2, FileCheck, KeyRound, Copy, CheckCircle, Mail, MailX, Search, BookUser, UserCheck, UserX, UsersRound, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation, Link } from "wouter";

type FormMode = "create" | "edit";

interface UserFormData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  role: "superadmin" | "admin" | "finance" | "procurement" | "livery" | "others";
}

interface EmployeeLookupResult {
  id: string;
  employeeCode: string | number | null;
  fullName: string;
  email: string;
  position: string;
  department: string;
}

function UserServicesCell({ userId, enabledServices }: { userId: string; enabledServices: ExternalService[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: userServiceIds = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/admin/users", userId, "services"],
  });

  const updateServicesMutation = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/services`, { serviceIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "services"] });
      toast({ title: "Services updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update services", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleService = (serviceId: string, checked: boolean) => {
    const newServiceIds = checked
      ? [...userServiceIds, serviceId]
      : userServiceIds.filter(id => id !== serviceId);
    updateServicesMutation.mutate(newServiceIds);
  };

  const assignedCount = userServiceIds.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-services-${userId}`}>
          <Settings2 className="h-4 w-4" />
          <Badge variant="secondary" className="text-xs">{isLoading ? "-" : assignedCount}</Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Assigned Services</div>
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : enabledServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services enabled in system settings</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {enabledServices.map(service => {
                const isAssigned = userServiceIds.includes(service.id);
                return (
                  <div key={service.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`service-${userId}-${service.id}`}
                      checked={isAssigned}
                      onCheckedChange={(checked) => handleToggleService(service.id, checked as boolean)}
                      disabled={updateServicesMutation.isPending}
                      data-testid={`checkbox-service-${userId}-${service.id}`}
                    />
                    <Label htmlFor={`service-${userId}-${service.id}`} className="text-sm cursor-pointer font-medium">
                      {service.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserPagesCell({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: userSubmodules = {}, isLoading } = useQuery<AllowedSubmodules>({
    queryKey: ["/api/admin/users", userId, "submodules"],
  });

  const updateSubmodulesMutation = useMutation({
    mutationFn: async (allowedSubmodules: AllowedSubmodules) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/submodules`, { allowedSubmodules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "submodules"] });
      toast({ title: "Sub Services access updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update Sub Services access", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleSubmodule = (registryKey: string, submoduleKey: string, checked: boolean) => {
    const allSubKeys = submoduleRegistry[registryKey]?.map(s => s.key) || [];
    const current = userSubmodules[registryKey] || [];
    const currentIsEmpty = !userSubmodules[registryKey];

    let newSubs: string[];
    if (checked) {
      if (currentIsEmpty) {
        newSubs = allSubKeys;
      } else {
        newSubs = [...current, submoduleKey];
      }
    } else {
      if (currentIsEmpty) {
        newSubs = allSubKeys.filter(k => k !== submoduleKey);
      } else {
        newSubs = current.filter(k => k !== submoduleKey);
      }
    }

    const allChecked = allSubKeys.every(k => newSubs.includes(k));
    const newAllowed = { ...userSubmodules };
    if (allChecked) {
      delete newAllowed[registryKey];
    } else {
      newAllowed[registryKey] = newSubs;
    }
    updateSubmodulesMutation.mutate(newAllowed);
  };

  const isSubmoduleChecked = (registryKey: string, submoduleKey: string): boolean => {
    if (!userSubmodules[registryKey]) return true;
    return userSubmodules[registryKey].includes(submoduleKey);
  };

  const handleSelectAll = () => {
    updateSubmodulesMutation.mutate({});
  };

  const registryKeys = Object.keys(submoduleRegistry);
  const hasRestrictions = registryKeys.some(k => !!userSubmodules[k]);
  const serviceLabels: Record<string, string> = {
    erp: "ERP",
    equestrian: "Equestrian",
    projects: "Projects",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-pages-${userId}`}>
          <FileCheck className="h-4 w-4" />
          <Badge variant={hasRestrictions ? "default" : "secondary"} className="text-xs">
            {isLoading ? "-" : hasRestrictions ? "Custom" : "All"}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">Sub-Page Access</div>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleSelectAll} disabled={updateSubmodulesMutation.isPending} data-testid={`button-pages-all-${userId}`}>
              All
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : registryKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Sub Services configured</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {registryKeys.map(registryKey => {
                const submodules = submoduleRegistry[registryKey];
                return (
                  <div key={registryKey}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {serviceLabels[registryKey] || registryKey}
                    </div>
                    <div className="space-y-1 ml-1 border-l-2 border-muted pl-3">
                      {submodules.map(sub => (
                        <div key={sub.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`sub-${userId}-${registryKey}-${sub.key}`}
                            checked={isSubmoduleChecked(registryKey, sub.key)}
                            onCheckedChange={(checked) => handleToggleSubmodule(registryKey, sub.key, checked as boolean)}
                            disabled={updateSubmodulesMutation.isPending}
                            data-testid={`checkbox-sub-${userId}-${registryKey}-${sub.key}`}
                          />
                          <Label htmlFor={`sub-${userId}-${registryKey}-${sub.key}`} className="text-sm cursor-pointer">
                            {sub.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminDashboard() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    employeeCode: "",
    role: "others",
  });
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const [empSearchOpen, setEmpSearchOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 25;
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userSortColumn, setUserSortColumn] = useState<"user" | "employeeCode" | "role" | "status" | null>(null);
  const [userSortDirection, setUserSortDirection] = useState<"asc" | "desc">("asc");
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{ resetUrl: string; emailSent: boolean; userName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: currentUser, isLoading: currentUserLoading } = useQuery<ManagedUser>({
    queryKey: ["/api/me"],
    enabled: !!authUser,
  });

  const isAdminRole = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdminRole,
  });

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<ManagedUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdminRole,
  });

  const { data: enabledServices = [] } = useQuery<ExternalService[]>({
    queryKey: ["/api/services/enabled"],
    enabled: isAdminRole,
  });

  const { data: employeeLookupResults = [], isFetching: empSearching } = useQuery<EmployeeLookupResult[]>({
    queryKey: ["/api/admin/employee-directory/lookup", empSearchTerm],
    queryFn: async () => {
      if (!empSearchTerm.trim()) return [];
      const res = await fetch(`/api/admin/employee-directory/lookup?search=${encodeURIComponent(empSearchTerm)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdminRole && empSearchOpen && empSearchTerm.trim().length >= 2,
  });

  const handleUserSortToggle = (column: "user" | "employeeCode" | "role" | "status") => {
    if (userSortColumn === column) {
      setUserSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setUserSortColumn(column);
      setUserSortDirection("asc");
    }
    setUserPage(1);
  };

  const filteredAndSortedUsers = (() => {
    if (!users) return [];
    let result = [...users];
    if (userSearchTerm.trim()) {
      const term = userSearchTerm.toLowerCase();
      result = result.filter((u) =>
        (u.username?.toLowerCase() || "").includes(term) ||
        (u.firstName?.toLowerCase() || "").includes(term) ||
        (u.lastName?.toLowerCase() || "").includes(term) ||
        (u.email?.toLowerCase() || "").includes(term) ||
        (u.employeeCode?.toLowerCase() || "").includes(term)
      );
    }
    if (userSortColumn) {
      result.sort((a, b) => {
        let aVal = "";
        let bVal = "";
        if (userSortColumn === "user") {
          aVal = (a.username || "").toLowerCase();
          bVal = (b.username || "").toLowerCase();
        } else if (userSortColumn === "employeeCode") {
          aVal = (a.employeeCode || "").toLowerCase();
          bVal = (b.employeeCode || "").toLowerCase();
        } else if (userSortColumn === "role") {
          aVal = (a.role || "others").toLowerCase();
          bVal = (b.role || "others").toLowerCase();
        } else if (userSortColumn === "status") {
          aVal = a.isActive ? "active" : "inactive";
          bVal = b.isActive ? "active" : "inactive";
        }
        const cmp = aVal.localeCompare(bVal);
        return userSortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  })();

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "User created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "User updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, { isActive });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: variables.isActive ? "User activated" : "User deactivated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const syncEmployeesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sync-employees");
      return res.json();
    },
    onSuccess: (data: { created: number; skipped: number; updated: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      const parts = [`${data.created} created`, `${data.updated} accounts synced`, `${data.skipped} skipped`];
      toast({ title: "Sync complete", description: parts.join(", ") });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reset-password-link`);
      return res.json();
    },
    onSuccess: (data, userId) => {
      const user = users?.find(u => u.id === userId);
      setResetResult({
        resetUrl: data.resetUrl,
        emailSent: data.emailSent,
        userName: user?.username || "",
      });
      setCopied(false);
      setResetDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate reset link", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormData({ email: "", username: "", password: "", firstName: "", lastName: "", employeeCode: "", role: "others" });
    setEditingUser(null);
    setFormMode("create");
    setEmpSearchTerm("");
    setEmpSearchOpen(false);
  }

  function handleOpenCreate() {
    resetForm();
    setFormMode("create");
    setDialogOpen(true);
  }

  function handleOpenEdit(user: ManagedUser) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      password: "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      employeeCode: user.employeeCode || "",
      role: (user.role as "superadmin" | "admin" | "finance" | "procurement" | "livery" | "others") || "others",
    });
    setFormMode("edit");
    setDialogOpen(true);
  }

  function handleSelectEmployee(emp: EmployeeLookupResult) {
    const nameParts = emp.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    setFormData({
      ...formData,
      email: emp.email || formData.email,
      firstName,
      lastName,
      employeeCode: emp.employeeCode != null ? String(emp.employeeCode) : "",
    });
    setEmpSearchOpen(false);
    setEmpSearchTerm("");
    toast({ title: "Employee data imported", description: `${emp.fullName} - ${emp.email}` });
  }

  function validatePassword(password: string): string | null {
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&*-_)";
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formMode === "create") {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast({ title: passwordError, variant: "destructive" });
        return;
      }
      createUserMutation.mutate(formData);
    } else if (editingUser) {
      const { password, ...rest } = formData;
      if (password) {
        const passwordError = validatePassword(password);
        if (passwordError) {
          toast({ title: passwordError, variant: "destructive" });
          return;
        }
      }
      const updateData = password ? formData : rest;
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    }
  }

  function handleDeleteClick(user: ManagedUser) {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }

  function confirmDelete() {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  }

  function getRoleBadgeVariant(role: string) {
    switch (role) {
      case "superadmin":
        return "destructive";
      case "admin":
        return "default";
      case "finance":
      case "procurement":
      case "livery":
        return "secondary";
      default:
        return "outline";
    }
  }

  if (authLoading || currentUserLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Authentication Required</h1>
        <p className="text-muted-foreground">Please log in to access the admin panel.</p>
        <Button asChild data-testid="button-login">
          <Link href="/login">Log In</Link>
        </Button>
      </div>
    );
  }

  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "superadmin") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        <Button onClick={() => setLocation("/netsuite")} data-testid="button-go-back">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users and system settings</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-user">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalUsers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <BookUser className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-employees">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalEmployees || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-users">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.activeUsers || 0}
            </div>
          </CardContent>
        </Card>

        {stats?.roleDistribution?.map((role) => (
          <Card key={role.role}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium capitalize">{role.role}s</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-${role.role}-count`}>
                {role.count}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all users in the system</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncEmployeesMutation.mutate()}
              disabled={syncEmployeesMutation.isPending}
              data-testid="button-sync-employees"
            >
              {syncEmployeesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UsersRound className="mr-2 h-4 w-4" />}
              Sync from Employee Directory
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : usersError ? (
            <div className="py-8 text-center text-destructive">
              Failed to load users. Please try again.
            </div>
          ) : (
            <>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, email, or employee code..."
                value={userSearchTerm}
                onChange={(e) => {
                  setUserSearchTerm(e.target.value);
                  setUserPage(1);
                }}
                className="pl-9"
                data-testid="input-user-search"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleUserSortToggle("user")}
                      data-testid="button-sort-user"
                    >
                      User
                      {userSortColumn === "user" ? (
                        userSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleUserSortToggle("employeeCode")}
                      data-testid="button-sort-employee-code"
                    >
                      Employee Code
                      {userSortColumn === "employeeCode" ? (
                        userSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleUserSortToggle("role")}
                      data-testid="button-sort-role"
                    >
                      Role
                      {userSortColumn === "role" ? (
                        userSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleUserSortToggle("status")}
                      data-testid="button-sort-status"
                    >
                      Status
                      {userSortColumn === "status" ? (
                        userSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Sub Services</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedUsers.slice((userPage - 1) * usersPerPage, userPage * usersPerPage).map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.username}</span>
                        <span className="text-sm text-muted-foreground">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{user.employeeCode || "—"}</span>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role || "others")}>
                        {user.role || "others"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0"
                        disabled={user.id === currentUser?.id || toggleActiveMutation.isPending}
                        onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                        title={user.isActive ? "Click to deactivate" : "Click to activate"}
                        data-testid={`button-toggle-active-${user.id}`}
                      >
                        <Badge
                          variant={user.isActive ? "outline" : "destructive"}
                          className={`cursor-pointer flex items-center gap-1 ${user.isActive ? "border-green-500 text-green-600" : ""}`}
                        >
                          {user.isActive ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <UserServicesCell userId={user.id} enabledServices={enabledServices} />
                    </TableCell>
                    <TableCell>
                      <UserPagesCell userId={user.id} />
                    </TableCell>
                    <TableCell>
                      {user.lastActiveAt
                        ? new Date(user.lastActiveAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetPasswordMutation.mutate(user.id)}
                          disabled={resetPasswordMutation.isPending}
                          title="Reset Password"
                          data-testid={`button-reset-password-${user.id}`}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(user)}
                          disabled={user.id === currentUser?.id}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredAndSortedUsers.length > usersPerPage && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(userPage - 1) * usersPerPage + 1}–{Math.min(userPage * usersPerPage, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage(userPage - 1)}
                    data-testid="button-users-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{userPage} / {Math.ceil(filteredAndSortedUsers.length / usersPerPage)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage >= Math.ceil(filteredAndSortedUsers.length / usersPerPage)}
                    onClick={() => setUserPage(userPage + 1)}
                    data-testid="button-users-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Add New User" : "Edit User"}</DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Create a new user account with the specified role."
                : "Update the user's information and role."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
              <Popover open={empSearchOpen} onOpenChange={setEmpSearchOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full gap-2" data-testid="button-import-employee">
                    <BookUser className="h-4 w-4" />
                    Import from Employee Directory
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3" align="start">
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={empSearchTerm}
                        onChange={(e) => setEmpSearchTerm(e.target.value)}
                        className="pl-8"
                        autoFocus
                        data-testid="input-employee-search"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {empSearching ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : empSearchTerm.trim().length < 2 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters to search</p>
                      ) : employeeLookupResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
                      ) : (
                        <div className="space-y-1">
                          {employeeLookupResults.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              className="w-full text-left rounded-md px-3 py-2 hover:bg-accent transition-colors"
                              onClick={() => handleSelectEmployee(emp)}
                              data-testid={`button-select-employee-${emp.id}`}
                            >
                              <div className="font-medium text-sm">{emp.fullName}</div>
                              <div className="text-xs text-muted-foreground">{emp.email}{emp.position ? ` · ${emp.position}` : ""}{emp.department ? ` · ${emp.department}` : ""}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                required
                disabled={formMode === "edit"}
                data-testid="input-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="johndoe"
                required
                data-testid="input-user-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {formMode === "edit" && "(leave blank to keep current)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={formMode === "create" ? "Enter password" : "New password (optional)"}
                required={formMode === "create"}
                data-testid="input-user-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters, with uppercase letter, number, and special character (!@#$%^&*-_)
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-user-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as "superadmin" | "admin" | "finance" | "procurement" | "livery" | "others" })
                }
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="procurement">Procurement</SelectItem>
                  <SelectItem value="livery">Livery</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-form"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
                data-testid="button-submit-form"
              >
                {createUserMutation.isPending || updateUserMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {formMode === "create" ? "Create User" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.username}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
            <DialogDescription>
              Reset link generated for <span className="font-medium">{resetResult?.userName}</span>. This link expires in 24 hours.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                {resetResult.emailSent ? (
                  <>
                    <Mail className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Email sent to user successfully</span>
                  </>
                ) : (
                  <>
                    <MailX className="h-4 w-4 text-orange-500" />
                    <span className="text-muted-foreground">Email could not be sent. Share the link manually.</span>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reset Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={resetResult.resetUrl}
                    className="text-xs font-mono"
                    data-testid="input-admin-reset-link"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(resetResult.resetUrl);
                      setCopied(true);
                      toast({ title: "Link copied to clipboard" });
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    data-testid="button-copy-reset-link"
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} data-testid="button-close-reset-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboard;
