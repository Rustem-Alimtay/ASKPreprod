import { UnderDevelopmentBanner } from "@/components/under-development-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { 
  Users, 
  DollarSign, 
  Clock, 
  Ticket, 
  Plane, 
  Star, 
  UserPlus, 
  Wallet, 
  Users2, 
  Smartphone,
  ExternalLink,
  BarChart3
} from "lucide-react";
import type { PageSectionWithTemplate } from "@shared";

const SERVICE_URL = "/hr";

const hrModules = [
  {
    id: "people",
    name: "People Management",
    description: "Employee records, org chart, and team management",
    icon: Users,
    iconBg: "bg-blue-500",
    status: "Active",
  },
  {
    id: "payroll",
    name: "Payroll Management",
    description: "Salary processing, deductions, and payslips",
    icon: DollarSign,
    iconBg: "bg-green-500",
    status: "Active",
  },
  {
    id: "attendance",
    name: "Time Attendance",
    description: "Clock-in/out, timesheets, and overtime tracking",
    icon: Clock,
    iconBg: "bg-orange-500",
    status: "Active",
  },
  {
    id: "tickets",
    name: "Ticket Management",
    description: "HR service requests and issue tracking",
    icon: Ticket,
    iconBg: "bg-purple-500",
    status: "Active",
  },
  {
    id: "travel",
    name: "Business Trip",
    description: "Travel requests, approvals, and expense claims",
    icon: Plane,
    iconBg: "bg-cyan-500",
    status: "Active",
  },
  {
    id: "performance",
    name: "Performance Appraisal",
    description: "Reviews, goals, and performance tracking",
    icon: Star,
    iconBg: "bg-yellow-500",
    status: "Coming Soon",
  },
  {
    id: "recruitment",
    name: "Talent Acquisition",
    description: "Job postings, applications, and hiring workflow",
    icon: UserPlus,
    iconBg: "bg-pink-500",
    status: "Active",
  },
  {
    id: "budget",
    name: "Budget Control",
    description: "HR budgets, forecasting, and cost analysis",
    icon: Wallet,
    iconBg: "bg-indigo-500",
    status: "Active",
  },
  {
    id: "manpower",
    name: "Manpower",
    description: "Headcount planning and workforce analytics",
    icon: Users2,
    iconBg: "bg-teal-500",
    status: "Active",
  },
  {
    id: "selfservice",
    name: "Self Service (Web & Mobile)",
    description: "Employee portal for leaves, requests, and documents",
    icon: Smartphone,
    iconBg: "bg-rose-500",
    status: "Active",
  },
];

function renderSection(section: PageSectionWithTemplate) {
  switch (section.title) {
    case "HR Overview":
      return (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <p className="text-blue-100 text-sm">Total Employees</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Active Today</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">On Leave</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Open Positions</p>
                <p className="text-3xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case "HR Modules":
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {hrModules.map((module) => (
            <Card key={module.id} className="hover-elevate cursor-pointer" data-testid={`card-module-${module.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${module.iconBg} text-white shrink-0`}>
                    <module.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate">{module.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{module.description}</p>
                    <Badge 
                      variant="secondary" 
                      className={`mt-2 text-xs ${module.status === "Coming Soon" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}
                    >
                      {module.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );

    case "Recent Activity":
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">No recent activity to display.</p>
        </div>
      );

    case "Reports & Analytics":
      return (
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start" data-testid="button-report-headcount">
            <BarChart3 className="mr-2 h-4 w-4" />
            Headcount Report
          </Button>
          <Button variant="outline" className="w-full justify-start" data-testid="button-report-attendance">
            <Clock className="mr-2 h-4 w-4" />
            Attendance Summary
          </Button>
          <Button variant="outline" className="w-full justify-start" data-testid="button-report-payroll">
            <DollarSign className="mr-2 h-4 w-4" />
            Payroll Analytics
          </Button>
          <Button variant="outline" className="w-full justify-start" data-testid="button-report-turnover">
            <Users className="mr-2 h-4 w-4" />
            Turnover Analysis
          </Button>
        </div>
      );

    default:
      return null;
  }
}

export default function HRMSPage() {
  return (
    <ServicePageLayout
      serviceUrl={SERVICE_URL}
      title="Kayan HRMS"
      subtitle="Human Resources Management System"
      collaborationSection="hrms"
      externalLinks={[
        { label: "Launch Power BI", url: "https://app.powerbi.com", icon: BarChart3 },
        { label: "Launch HR System", url: "https://hrms.example.com", icon: ExternalLink },
      ]}
      renderSection={renderSection}
    >
      <UnderDevelopmentBanner />
      <OtherModulesSection />
    </ServicePageLayout>
  );
}
