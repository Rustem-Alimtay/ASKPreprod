import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GanttChart,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import type { ProjectWithAssignments, SpaceWithHierarchy } from "@shared";
import { statusConfig, priorityColors } from "@/lib/project-config";
import type { ProjectStatus, ProjectPriority } from "@/lib/project-config";

interface ProjectGanttViewProps {
  projects: ProjectWithAssignments[];
  spacesHierarchy: SpaceWithHierarchy[];
  isLoading: boolean;
  onProjectClick: (p: ProjectWithAssignments) => void;
}

export function ProjectGanttView({ projects, spacesHierarchy, isLoading, onProjectClick }: ProjectGanttViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const totalDays = 28;

  const pgLookup = useMemo(() => {
    const lookup: Record<string, { name: string; color: string; spaceName: string }> = {};
    spacesHierarchy.forEach(space => {
      space.projectGroups.forEach(pg => {
        lookup[pg.id] = { name: pg.name, color: pg.color || "#6366f1", spaceName: space.name };
      });
    });
    return lookup;
  }, [spacesHierarchy]);

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7 - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const dayLabels = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        short: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.getDate(),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: d.getTime() === today.getTime(),
        fullDate: d,
      };
    });
  }, [startDate]);

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + totalDays);
    return d;
  }, [startDate]);

  const parseLocalDate = (dateStr: string) => {
    const parts = dateStr.split(/[-T]/);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1));
  };

  const getBarPosition = (taskStartDate: string | null, taskDeadline: string | null) => {
    const tStart = taskStartDate ? parseLocalDate(taskStartDate) : null;
    const tEnd = taskDeadline ? parseLocalDate(taskDeadline) : null;

    if (!tStart && !tEnd) return null;

    const effectiveStart = tStart || tEnd!;
    const effectiveEndRaw = tEnd || new Date(effectiveStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const effectiveEnd = new Date(effectiveEndRaw);
    effectiveEnd.setHours(23, 59, 59, 999);

    const rangeMs = endDate.getTime() - startDate.getTime();
    const leftMs = effectiveStart.getTime() - startDate.getTime();
    const rightMs = effectiveEnd.getTime() - startDate.getTime();

    const leftPct = (leftMs / rangeMs) * 100;
    const rightPct = (rightMs / rangeMs) * 100;

    const clampedLeft = Math.max(0, leftPct);
    const clampedRight = Math.min(100, rightPct);
    const width = clampedRight - clampedLeft;

    if (width <= 0) return null;

    const clippedLeft = leftPct < 0;
    const clippedRight = rightPct > 100;

    const startLabel = effectiveStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = effectiveEndRaw.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return { left: clampedLeft, width: Math.max(2, width), clippedLeft, clippedRight, startLabel, endLabel };
  };

  const getProgressPercent = (status: string) => {
    switch (status) {
      case "completed": return 100;
      case "in_progress": return 50;
      case "on_hold": return 30;
      case "cancelled": return 100;
      default: return 0;
    }
  };

  const getBarColor = (status: string, priority: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in_progress": return "bg-blue-500";
      case "on_hold": return "bg-orange-500";
      case "cancelled": return "bg-red-400";
      default:
        if (priority === "critical") return "bg-red-400";
        if (priority === "high") return "bg-orange-400";
        return "bg-slate-400";
    }
  };

  const todayIndex = dayLabels.findIndex(d => d.isToday);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aStart = a.startDate ? parseLocalDate(a.startDate).getTime() : (a.deadline ? parseLocalDate(a.deadline).getTime() : Infinity);
      const bStart = b.startDate ? parseLocalDate(b.startDate).getTime() : (b.deadline ? parseLocalDate(b.deadline).getTime() : Infinity);
      return aStart - bStart;
    });
  }, [projects]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="p-12 text-center">
        <GanttChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No tasks to display</h3>
        <p className="text-muted-foreground">Create tasks with start dates and deadlines to see them in the Gantt chart.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="tuesday-gantt-view">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" /> Completed
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> In Progress
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" /> On Hold
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" /> Not Started
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Cancelled
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-gantt-prev-week">
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} data-testid="button-gantt-today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-gantt-next-week">
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div className="flex border-b sticky top-0 bg-background z-10">
                <div className="w-[280px] flex-shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground border-r bg-muted/30">
                  Task
                </div>
                <div className="flex-1 flex">
                  {dayLabels.map((day, i) => (
                    <div
                      key={i}
                      className={`flex-1 text-center py-1.5 text-[10px] border-r last:border-r-0 ${day.isWeekend ? "bg-muted/40" : ""} ${day.isToday ? "bg-primary/10" : ""}`}
                    >
                      <div className="font-medium text-muted-foreground">{day.short}</div>
                      <div className={`font-bold ${day.isToday ? "text-primary" : ""}`}>{day.date}</div>
                      {(i === 0 || day.date === 1) && (
                        <div className="text-muted-foreground">{day.month}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {sortedProjects.map((project) => {
                const bar = getBarPosition(project.startDate, project.deadline);
                const progress = getProgressPercent(project.status);
                const barColor = getBarColor(project.status, project.priority);
                const pgInfo = (project as any).projectGroupId ? pgLookup[(project as any).projectGroupId] : null;
                const StatusIcon = statusConfig[project.status as ProjectStatus]?.icon;

                return (
                  <div
                    key={project.id}
                    className="flex border-b last:border-b-0 hover-elevate cursor-pointer group"
                    onClick={() => onProjectClick(project)}
                    data-testid={`gantt-task-${project.id}`}
                  >
                    <div className="w-[280px] flex-shrink-0 px-4 py-2.5 border-r flex items-center gap-2">
                      {pgInfo && (
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pgInfo.color }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{project.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {pgInfo ? `${pgInfo.spaceName} / ${pgInfo.name}` : "Unassigned"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {StatusIcon && (
                          <StatusIcon className={`h-3 w-3 ${statusConfig[project.status as ProjectStatus]?.color}`} />
                        )}
                        <Badge className={`${priorityColors[project.priority as ProjectPriority]} border-0 text-[9px] px-1`}>
                          {project.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-1 flex relative">
                      {dayLabels.map((day, i) => (
                        <div
                          key={i}
                          className={`flex-1 border-r last:border-r-0 ${day.isWeekend ? "bg-muted/20" : ""} ${day.isToday ? "bg-primary/5" : ""}`}
                        />
                      ))}
                      {todayIndex >= 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-primary/40 z-[5]"
                          style={{ left: `${((todayIndex + 0.5) / totalDays) * 100}%` }}
                        />
                      )}
                      {bar ? (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-6 overflow-hidden ${bar.clippedLeft ? "rounded-r-md" : bar.clippedRight ? "rounded-l-md" : "rounded-md"}`}
                          style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                        >
                          <div className={`h-full w-full ${barColor} opacity-20`} />
                          <div
                            className={`absolute left-0 top-0 h-full ${barColor} transition-all`}
                            style={{ width: `${progress}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium z-10 mix-blend-normal whitespace-nowrap px-1">
                            {bar.startLabel} — {bar.endLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">No dates set</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
