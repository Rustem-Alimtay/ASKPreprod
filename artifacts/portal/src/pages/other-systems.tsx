import { OtherModulesSection } from "@/components/other-modules-section";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, Calendar, ChevronRight } from "lucide-react";

export default function OtherSystemsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white">
        <h1 className="mb-2 text-3xl font-bold">Other Systems</h1>
        <p className="text-indigo-100">
          Access specialized modules for veterinary services and project management.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/veterinary" data-testid="link-veterinary">
          <Card className="cursor-pointer hover-elevate h-full" data-testid="card-veterinary">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <Stethoscope className="h-7 w-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Veterinary</CardTitle>
                  <CardDescription>Equine Medical Records</CardDescription>
                </div>
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Digital health record system for the club's horses including medical history, 
                vaccination tracking, and service records.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  Medical History
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                  Vaccinations
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-400">
                  Service Records
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects" data-testid="link-projects">
          <Card className="cursor-pointer hover-elevate h-full" data-testid="card-projects">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <Calendar className="h-7 w-7 text-orange-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Projects</CardTitle>
                  <CardDescription>Monday.com Integration</CardDescription>
                </div>
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Project management interface with status tracking, timeline management, 
                and team task ownership in a Monday.com-style board view.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                  Status Tracking
                </span>
                <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                  Timelines
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                  Task Ownership
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
      <OtherModulesSection />
    </div>
  );
}
