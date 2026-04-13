import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { 
  CircleDot, 
  Home, 
  GraduationCap, 
  Heart, 
  Stethoscope,
  ExternalLink,
  BarChart3,
  Calendar,
  Users,
  DollarSign,
  Warehouse,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Search,
  Filter,
  Plus,
  GanttChart,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import type { PageSectionWithTemplate } from "@shared";

const sectionRouteMap: Record<string, string> = {
  "/equestrian/stable-assets": "Stable Assets Manager",
};

const SERVICE_URL = "/equestrian";

const stables: { id: number; name: string; capacity: number; occupied: number; status: string }[] = [];

const ridingClasses: { id: number; name: string; instructor: string; students: number; time: string }[] = [];

const therapySchedule: { id: number; patient: string; therapy: string; horse: string; time: string }[] = [];

const stableAssets: { id: number; name: string; category: string; location: string; condition: string; lastInspection: string; value: number }[] = [];

const assetCategories = [
  { name: "Tack", count: 0, icon: CircleDot, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { name: "Equipment", count: 0, icon: Wrench, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { name: "Medical", count: 0, icon: Stethoscope, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
  { name: "Transport", count: 0, icon: Package, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { name: "Training", count: 0, icon: GraduationCap, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  { name: "Facility", count: 0, icon: Warehouse, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
];

function getConditionBadge(condition: string) {
  switch (condition) {
    case "Excellent":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"><CheckCircle2 className="h-3 w-3 mr-1" />{condition}</Badge>;
    case "Good":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0"><CheckCircle2 className="h-3 w-3 mr-1" />{condition}</Badge>;
    case "Fair":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0"><Clock className="h-3 w-3 mr-1" />{condition}</Badge>;
    case "Needs Repair":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"><AlertTriangle className="h-3 w-3 mr-1" />{condition}</Badge>;
    default:
      return <Badge variant="secondary">{condition}</Badge>;
  }
}

interface GanttTask {
  id: string;
  name: string;
  assignee: string;
  status: "done" | "in_progress" | "not_started" | "overdue";
  startDay: number;
  duration: number;
  color: string;
  progress: number;
}

const ganttTasks: GanttTask[] = [];

function getStatusBadge(status: GanttTask["status"]) {
  switch (status) {
    case "done": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px]">Done</Badge>;
    case "in_progress": return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-[10px]">Working</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">Overdue</Badge>;
    case "not_started": return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  }
}

function StableGanttChart() {
  const [weekOffset, setWeekOffset] = useState(0);
  const totalDays = 14;

  const dayLabels = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return {
        short: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.getDate(),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: i === 0 && weekOffset === 0,
      };
    });
  }, [weekOffset]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <GanttChart className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Maintenance Schedule</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" /> Done
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> In Progress
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Overdue
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" /> Pending
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-gantt-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} data-testid="button-gantt-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-gantt-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex border-b">
              <div className="w-[260px] flex-shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground border-r bg-muted/30">
                Task
              </div>
              <div className="flex-1 flex">
                {dayLabels.map((day, i) => (
                  <div
                    key={i}
                    className={`flex-1 text-center py-2 text-[10px] border-r last:border-r-0 ${day.isWeekend ? "bg-muted/40" : ""} ${day.isToday ? "bg-primary/10" : ""}`}
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

            {ganttTasks.map((task) => (
              <div key={task.id} className="flex border-b last:border-b-0 hover-elevate group" data-testid={`gantt-row-${task.id}`}>
                <div className="w-[260px] flex-shrink-0 px-4 py-2.5 border-r flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.name}</p>
                    <p className="text-[10px] text-muted-foreground">{task.assignee}</p>
                  </div>
                  {getStatusBadge(task.status)}
                </div>
                <div className="flex-1 flex relative">
                  {dayLabels.map((day, i) => (
                    <div
                      key={i}
                      className={`flex-1 border-r last:border-r-0 ${day.isWeekend ? "bg-muted/20" : ""} ${day.isToday ? "bg-primary/5" : ""}`}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center overflow-hidden"
                    style={{
                      left: `${(task.startDay / totalDays) * 100}%`,
                      width: `${(task.duration / totalDays) * 100}%`,
                    }}
                  >
                    <div className={`h-full w-full ${task.color} rounded-md opacity-20`} />
                    <div
                      className={`absolute left-0 top-0 h-full ${task.color} rounded-md transition-all`}
                      style={{ width: `${task.progress}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground dark:text-white mix-blend-normal z-10">
                      {task.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RenderEquestrianSection({ section }: { section: PageSectionWithTemplate }) {
  const [activeTab, setActiveTab] = useState("livery");
  const [assetFilter, setAssetFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleLaunchEzyVet = () => {
    window.open("https://ezyvet.com", "_blank");
  };

  switch (section.title) {
    case "Equestrian Overview":
      return (
        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-4">
                <div>
                  <p className="text-emerald-100 text-sm">Total Horses</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Stables Occupied</p>
                  <p className="text-3xl font-bold">0/0</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Monthly Revenue</p>
                  <p className="text-3xl font-bold">$0</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Active Members</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full max-w-3xl">
              <TabsTrigger value="livery" data-testid="tab-livery">
                <Home className="mr-2 h-4 w-4" />
                Livery
              </TabsTrigger>
              <TabsTrigger value="stable" data-testid="tab-stable">
                <CircleDot className="mr-2 h-4 w-4" />
                Stable Mgmt
              </TabsTrigger>
              <TabsTrigger value="riding" data-testid="tab-riding">
                <GraduationCap className="mr-2 h-4 w-4" />
                Riding School
              </TabsTrigger>
              <TabsTrigger value="therapy" data-testid="tab-therapy">
                <Heart className="mr-2 h-4 w-4" />
                Therapeutic
              </TabsTrigger>
              <TabsTrigger value="vet" data-testid="tab-vet">
                <Stethoscope className="mr-2 h-4 w-4" />
                Vet Services
              </TabsTrigger>
            </TabsList>

            <TabsContent value="livery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Livery Services Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Full Livery</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Part Livery</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">DIY Livery</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    Full livery includes daily feeding, turnout, grooming, and exercise. Part livery provides basic care with owner responsibilities for exercise.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stable" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stable Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stables.map((stable) => (
                      <Card key={stable.id} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{stable.name}</h4>
                            <Badge variant={stable.status === "Full" ? "destructive" : "secondary"}>
                              {stable.status}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold">{stable.occupied}/{stable.capacity}</p>
                          <p className="text-sm text-muted-foreground">Stalls occupied</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="riding" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Today's Classes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ridingClasses.map((cls) => (
                      <div key={cls.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <GraduationCap className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{cls.name}</p>
                            <p className="text-sm text-muted-foreground">Instructor: {cls.instructor}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{cls.time}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">{cls.students} students</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="therapy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Therapeutic Center</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 text-center">
                      <Heart className="h-8 w-8 text-pink-500 mx-auto mb-2" />
                      <p className="font-medium">Hippotherapy</p>
                      <p className="text-sm text-muted-foreground">Medical treatment</p>
                    </div>
                    <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-center">
                      <Users className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <p className="font-medium">Therapeutic Riding</p>
                      <p className="text-sm text-muted-foreground">Recreational therapy</p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                      <Calendar className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="font-medium">Equine-Assisted</p>
                      <p className="text-sm text-muted-foreground">Mental health support</p>
                    </div>
                  </div>
                  <h4 className="font-medium mb-3">Today's Sessions</h4>
                  <div className="space-y-3">
                    {therapySchedule.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{session.patient}</p>
                          <p className="text-sm text-muted-foreground">{session.therapy} with {session.horse}</p>
                        </div>
                        <Badge>{session.time}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vet" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-lg">Veterinary Services</CardTitle>
                  <Button onClick={handleLaunchEzyVet} data-testid="button-launch-ezyvet">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Launch EZYVET
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-green-600">0</p>
                      <p className="text-sm text-muted-foreground">Healthy Horses</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-yellow-600">0</p>
                      <p className="text-sm text-muted-foreground">Under Treatment</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-blue-600">0</p>
                      <p className="text-sm text-muted-foreground">Scheduled Checkups</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" data-testid="button-medical-records">
                      <Stethoscope className="mr-2 h-4 w-4" />
                      View Medical Records
                    </Button>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-vaccination">
                      <Calendar className="mr-2 h-4 w-4" />
                      Vaccination Schedule
                    </Button>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-vet-expenses">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Vet Expenses Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="space-y-4" data-testid="section-quick-stats">
            <h3 className="text-lg font-semibold font-outfit flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Quick Stats
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="stat-active-members">0</p>
                      <p className="text-sm text-muted-foreground">Active Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="stat-monthly-revenue">$0</p>
                      <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
                      <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="stat-lessons-this-month">0</p>
                      <p className="text-sm text-muted-foreground">Lessons This Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30">
                      <Heart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="stat-therapy-sessions">0</p>
                      <p className="text-sm text-muted-foreground">Therapy Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-3">Occupancy Rate</h4>
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-occupancy">0%</p>
                    <p className="text-sm text-muted-foreground mb-1">0/0 stalls</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "0%" }} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-3">Vet Health Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Healthy</span>
                      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" data-testid="stat-healthy">0</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Under Treatment</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0" data-testid="stat-treatment">0</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Checkups Due</span>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0" data-testid="stat-checkups">0</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-3">Today's Schedule</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Riding Classes</span>
                      <span className="text-sm font-medium" data-testid="stat-classes-today">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Therapy Sessions</span>
                      <span className="text-sm font-medium" data-testid="stat-therapy-today">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vet Appointments</span>
                      <span className="text-sm font-medium" data-testid="stat-vet-today">0</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );

    case "Stable Assets Manager": {
      const filteredAssets = stableAssets.filter((asset) => {
        const matchesCategory = assetFilter === "all" || asset.category === assetFilter;
        const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || asset.location.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      });
      const totalValue = stableAssets.reduce((sum, a) => sum + a.value, 0);
      const needsRepair = stableAssets.filter((a) => a.condition === "Needs Repair").length;
      const excellent = stableAssets.filter((a) => a.condition === "Excellent").length;

      return (
        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-slate-700 to-slate-800 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Warehouse className="h-6 w-6" />
                <h2 className="text-xl font-semibold font-outfit">Stable Assets Manager</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-4">
                <div>
                  <p className="text-slate-300 text-sm">Total Assets</p>
                  <p className="text-3xl font-bold" data-testid="stat-total-assets">0</p>
                </div>
                <div>
                  <p className="text-slate-300 text-sm">Total Value</p>
                  <p className="text-3xl font-bold" data-testid="stat-total-value">${(totalValue / 1000).toFixed(0)}K</p>
                </div>
                <div>
                  <p className="text-slate-300 text-sm">Excellent Condition</p>
                  <p className="text-3xl font-bold text-green-400" data-testid="stat-excellent">{excellent}</p>
                </div>
                <div>
                  <p className="text-slate-300 text-sm">Needs Repair</p>
                  <p className="text-3xl font-bold text-red-400" data-testid="stat-needs-repair">{needsRepair}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {assetCategories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <Card
                  key={cat.name}
                  className={`hover-elevate cursor-pointer ${assetFilter === cat.name ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setAssetFilter(assetFilter === cat.name ? "all" : cat.name)}
                  data-testid={`card-category-${cat.name.toLowerCase()}`}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${cat.color} mb-2`}>
                      <CatIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-lg font-bold">{cat.count}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <StableGanttChart />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-lg">Asset Inventory</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                    data-testid="input-search-assets"
                  />
                </div>
                {assetFilter !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setAssetFilter("all")} data-testid="button-clear-filter">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    {assetFilter}
                    <span className="ml-1 text-muted-foreground">x</span>
                  </Button>
                )}
                <Button data-testid="button-add-asset">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Asset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Asset Name</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Category</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Location</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Condition</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">Last Inspection</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id} className="border-b last:border-0 hover-elevate" data-testid={`row-asset-${asset.id}`}>
                        <td className="py-3 pr-4 font-medium">{asset.name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary">{asset.category}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{asset.location}</td>
                        <td className="py-3 pr-4">{getConditionBadge(asset.condition)}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{asset.lastInspection}</td>
                        <td className="py-3 pr-4 text-right font-medium">${asset.value.toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredAssets.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No assets found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming inspections</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Repair Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">No repair requests</p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function renderSection(section: PageSectionWithTemplate) {
  return <RenderEquestrianSection section={section} />;
}

export default function EquestrianPage() {
  const [location] = useLocation();
  const activeSectionTitle = sectionRouteMap[location] || null;
  const isOverview = !activeSectionTitle;

  const filterSection = (section: PageSectionWithTemplate) => {
    if (!activeSectionTitle) return true;
    return section.title === activeSectionTitle;
  };

  return (
    <ServicePageLayout
      serviceUrl={SERVICE_URL}
      title={isOverview ? "Equestrian" : ""}
      subtitle={isOverview ? "Complete management of riding school, livery, and veterinary services" : ""}
      collaborationSection="equestrian"
      renderSection={renderSection}
      sectionFilter={filterSection}
    >
      <OtherModulesSection />
    </ServicePageLayout>
  );
}
