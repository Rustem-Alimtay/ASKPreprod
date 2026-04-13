import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  X,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProjectWithAssignments, ManagedUser, SpaceWithHierarchy } from "@shared";
import { useToast } from "@/hooks/use-toast";

type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
type ProjectPriority = "low" | "medium" | "high" | "critical";

const statusConfig: Record<ProjectStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  not_started: { label: "Not Started", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800", icon: Pause },
  in_progress: { label: "In Progress", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Clock },
  on_hold: { label: "On Hold", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", icon: AlertCircle },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", icon: X },
};

const priorityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};


export default function ProjectGroupPage() {
  const [, params] = useRoute("/projects/group/:groupId");
  const groupId = params?.groupId;
  const { toast } = useToast();

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectWithAssignments | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<ProjectStatus>("not_started");
  const [taskPriority, setTaskPriority] = useState<ProjectPriority>("medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");

  const { data: currentUser } = useQuery<ManagedUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: hierarchyData = [], isLoading } = useQuery<SpaceWithHierarchy[]>({
    queryKey: ["/api/spaces/hierarchy"],
  });

  const { data: usersData = [] } = useQuery<ManagedUser[]>({
    queryKey: ["/api/users/list"],
  });

  let projectGroup: any = null;
  let parentSpace: SpaceWithHierarchy | null = null;
  for (const space of hierarchyData) {
    const pg = space.projectGroups.find((pg: any) => pg.id === groupId);
    if (pg) {
      projectGroup = pg;
      parentSpace = space;
      break;
    }
  }

  const tasks: ProjectWithAssignments[] = projectGroup?.tasks || [];

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/projects", data);
      const created = await res.json();
      if (taskAssigneeId && taskAssigneeId !== "none" && created?.id) {
        try {
          await apiRequest("POST", `/api/projects/${created.id}/assignments`, { userId: taskAssigneeId });
        } catch (error) {
          console.error("Failed to assign user:", error);
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/hierarchy"] });
      closeTaskDialog();
      toast({ title: "Task created successfully" });
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/hierarchy"] });
      closeTaskDialog();
      toast({ title: "Task updated successfully" });
    },
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/hierarchy"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/hierarchy"] });
    },
  });

  const closeTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
    setTaskName("");
    setTaskDescription("");
    setTaskStatus("not_started");
    setTaskPriority("medium");
    setTaskDeadline("");
    setTaskStartDate("");
    setTaskAssigneeId("");
  };

  const openNewTask = () => {
    setEditingTask(null);
    setTaskName("");
    setTaskDescription("");
    setTaskStatus("not_started");
    setTaskPriority("medium");
    setTaskDeadline("");
    setTaskStartDate("");
    setTaskAssigneeId("");
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: ProjectWithAssignments) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || "");
    setTaskStatus(task.status as ProjectStatus);
    setTaskPriority(task.priority as ProjectPriority);
    setTaskDeadline(task.deadline || "");
    setTaskStartDate(task.startDate || "");
    setTaskAssigneeId("");
    setTaskDialogOpen(true);
  };

  const handleTaskSubmit = () => {
    if (!taskName.trim()) return;
    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        data: {
          name: taskName.trim(),
          description: taskDescription.trim() || undefined,
          status: taskStatus,
          priority: taskPriority,
          deadline: taskDeadline || undefined,
          startDate: taskStartDate || undefined,
        },
      });
    } else {
      createTaskMutation.mutate({
        name: taskName.trim(),
        description: taskDescription.trim() || undefined,
        projectGroupId: groupId,
        status: taskStatus,
        priority: taskPriority,
        deadline: taskDeadline || undefined,
        startDate: taskStartDate || undefined,
        createdBy: currentUser?.id || "system",
      });
    }
  };

  const getUserInitials = (user: any) => {
    if (!user) return "??";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.username?.substring(0, 2).toUpperCase() || "??";
  };

  const getAssignedUsers = (task: ProjectWithAssignments) => {
    return task.assignments || [];
  };

  const getTimelineStatus = (deadline: string | null | undefined) => {
    if (!deadline) return { text: "No deadline", color: "text-muted-foreground" };
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { text: `${Math.abs(daysLeft)} days overdue`, color: "text-red-600" };
    if (daysLeft <= 7) return { text: `${daysLeft} days left`, color: "text-orange-600" };
    return { text: `${daysLeft} days left`, color: "text-muted-foreground" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!projectGroup) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Project not found</h2>
        <p className="text-muted-foreground mb-4">The project group you're looking for doesn't exist.</p>
        <Link href="/projects/monday">
          <Button data-testid="button-back-to-projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/projects/monday">
            <Button size="icon" variant="ghost" data-testid="button-back-projects">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          {parentSpace && (
            <>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: parentSpace.color || '#6366f1' }} />
              <span className="text-sm text-muted-foreground">{parentSpace.name}</span>
              <span className="text-muted-foreground">/</span>
            </>
          )}
          <FolderOpen className="h-4 w-4" style={{ color: projectGroup.color || '#6366f1' }} />
          <h1 className="text-lg font-semibold font-outfit">{projectGroup.name}</h1>
          {projectGroup.color && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectGroup.color }} />
          )}
          <Badge variant="secondary" className="text-xs capitalize">{projectGroup.status}</Badge>
          <Badge variant="outline" className="text-xs">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </Badge>
        </div>
        <Button onClick={openNewTask} data-testid="button-new-task">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tasks.length === 0 ? (
          <div className="p-12 text-center border rounded-md">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-muted-foreground mb-4">Create your first task in this project.</p>
            <Button onClick={openNewTask} data-testid="button-create-first-task">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_120px_120px_100px_150px_80px] gap-2 px-4 py-3 text-xs font-medium text-muted-foreground border-b">
                <span>Task Name</span>
                <span>Assignee</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Deadline</span>
                <span></span>
              </div>
              {tasks.map((task) => {
                const timeline = getTimelineStatus(task.deadline);
                const assignedUsers = getAssignedUsers(task);

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[1fr_120px_120px_100px_150px_80px] gap-2 px-4 py-2.5 items-center border-b last:border-b-0 hover-elevate group"
                    data-testid={`task-row-${task.id}`}
                  >
                    <span
                      className="font-medium text-sm truncate cursor-pointer hover:underline"
                      onClick={() => openEditTask(task)}
                      data-testid={`task-name-${task.id}`}
                    >
                      {task.name}
                    </span>

                    <div className="flex -space-x-2">
                      {assignedUsers.slice(0, 3).map((assignment: any) => (
                        <Avatar key={assignment.id} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                            {getUserInitials(assignment.user)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {assignedUsers.length > 3 && (
                        <Avatar className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-[9px] bg-muted">
                            +{assignedUsers.length - 3}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {assignedUsers.length === 0 && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="cursor-pointer" data-testid={`task-status-${task.id}`}>
                          <Badge className={`${statusConfig[task.status as ProjectStatus]?.bgColor} border-0 text-xs`}>
                            {statusConfig[task.status as ProjectStatus]?.label}
                          </Badge>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" align="start">
                        <div className="space-y-1">
                          {(Object.entries(statusConfig) as [ProjectStatus, typeof statusConfig[ProjectStatus]][]).map(([key, cfg]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm hover-elevate"
                              onClick={() => updateStatusMutation.mutate({ id: task.id, data: { status: key } })}
                            >
                              <Badge className={`${cfg.bgColor} border-0 text-xs`}>{cfg.label}</Badge>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Badge className={`${priorityColors[task.priority]} border-0 text-xs capitalize`}>
                      {task.priority}
                    </Badge>

                    <span className={`text-xs ${timeline.color}`}>
                      {task.deadline ? format(new Date(task.deadline), "MMM d, yyyy") : "-"}
                    </span>

                    <div className="invisible group-hover:visible flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditTask(task)}
                        data-testid={`button-edit-task-${task.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            if (window.confirm(`Delete task "${task.name}"?`)) {
                              deleteTaskMutation.mutate(task.id);
                            }
                          }}
                          data-testid={`button-delete-task-${task.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={(open) => { if (!open) closeTaskDialog(); else setTaskDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-outfit">{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update task details." : `Create a new task in "${projectGroup.name}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task Name</Label>
              <Input
                placeholder="Enter task name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="mt-1"
                data-testid="input-task-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the task..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="mt-1 min-h-[80px]"
                data-testid="input-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as ProjectStatus)}>
                  <SelectTrigger className="mt-1" data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as ProjectPriority)}>
                  <SelectTrigger className="mt-1" data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger className="mt-1" data-testid="select-task-assignee">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No assignee</SelectItem>
                  {usersData.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.username}
                      {user.id === currentUser?.id ? " (me)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={taskStartDate}
                  onChange={(e) => setTaskStartDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-task-start-date"
                />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="mt-1"
                  data-testid="input-task-deadline"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTaskDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleTaskSubmit}
              disabled={!taskName.trim() || createTaskMutation.isPending || updateTaskMutation.isPending}
              data-testid="button-save-task"
            >
              {editingTask ? "Update" : "Create"} Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
