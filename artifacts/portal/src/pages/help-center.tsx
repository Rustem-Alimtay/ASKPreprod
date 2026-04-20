import { OtherModulesSection } from "@/components/other-modules-section";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  BookOpen, 
  FileText, 
  Search, 
  Ticket, 
  Database, 
  Users, 
  Truck,
  Loader2,
  ExternalLink,
  Download
} from "lucide-react";
import type { FaqEntry, UserManual } from "@shared";

const categoryLabels: Record<string, string> = {
  general: "General",
  netsuite: "NetSuite Integration",
  hr: "HR System",
  livery: "Livery Tracking",
  account: "Account & Access",
  troubleshooting: "Troubleshooting",
};

const categoryIcons: Record<string, any> = {
  general: HelpCircle,
  netsuite: Database,
  hr: Users,
  livery: Truck,
  account: Users,
  troubleshooting: HelpCircle,
};

export default function HelpCenterPage() {
  const [faqSearch, setFaqSearch] = useState("");

  const { data: faqEntries = [], isLoading: faqLoading } = useQuery<FaqEntry[]>({
    queryKey: ["/api/help/faq"],
  });

  const { data: manuals = [], isLoading: manualsLoading } = useQuery<UserManual[]>({
    queryKey: ["/api/help/manuals"],
  });

  const filteredFaq = faqEntries.filter(
    (entry) =>
      entry.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      entry.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const faqByCategory = filteredFaq.reduce((acc, entry) => {
    if (!acc[entry.category]) {
      acc[entry.category] = [];
    }
    acc[entry.category].push(entry);
    return acc;
  }, {} as Record<string, FaqEntry[]>);

  const manualsByCategory = manuals.reduce((acc, manual) => {
    if (!acc[manual.category]) {
      acc[manual.category] = [];
    }
    acc[manual.category].push(manual);
    return acc;
  }, {} as Record<string, UserManual[]>);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Help Center</h1>
          <p className="text-muted-foreground">
            Find answers, documentation, and support resources
          </p>
        </div>
        <Link href="/tickets">
          <Button data-testid="button-submit-ticket">
            <Ticket className="mr-2 h-4 w-4" />
            Submit a Ticket
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList data-testid="help-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <HelpCircle className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="faq" data-testid="tab-faq">
            <BookOpen className="mr-2 h-4 w-4" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="manuals" data-testid="tab-manuals">
            <FileText className="mr-2 h-4 w-4" />
            User Manuals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to the Data Integration Portal</CardTitle>
              <CardDescription>
                Your unified dashboard for managing enterprise data across multiple systems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                This portal provides a centralized interface for viewing and managing data from three 
                key business systems: NetSuite (financial data), HR (employee management), and 
                Livery (delivery tracking). All data is synchronized regularly to ensure you have 
                access to the most current information.
              </p>
              
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="hover-elevate">
                  <CardHeader className="pb-2">
                    <Database className="h-8 w-8 text-primary" />
                    <CardTitle className="text-lg">NetSuite Integration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Access financial data including revenue metrics, transactions, 
                      customer information, and real-time synchronization status.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardHeader className="pb-2">
                    <Users className="h-8 w-8 text-primary" />
                    <CardTitle className="text-lg">HR System</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      View employee data, department statistics, leave management, 
                      and organizational metrics from your HR platform.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardHeader className="pb-2">
                    <Truck className="h-8 w-8 text-primary" />
                    <CardTitle className="text-lg">Livery Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Monitor deliveries, track shipment status, and view 
                      logistics performance across your delivery network.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <Link href="/intranet">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-goto-intranet">
                    <Database className="mr-2 h-4 w-4" />
                    Go to Portal
                  </Button>
                </Link>
                <Link href="/tickets">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-view-tickets">
                    <Ticket className="mr-2 h-4 w-4" />
                    View My Tickets
                  </Button>
                </Link>
                <Link href="/tickets/new">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-report-issue">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Report an Issue
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Search our knowledge base for answers to common questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search FAQ..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-faq-search"
                />
              </div>

              {faqLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : Object.keys(faqByCategory).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {faqSearch ? "No FAQ entries match your search" : "No FAQ entries available yet"}
                </div>
              ) : (
                Object.entries(faqByCategory).map(([category, entries]) => {
                  const Icon = categoryIcons[category] || HelpCircle;
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">{categoryLabels[category] || category}</h3>
                        <Badge variant="secondary">{entries.length}</Badge>
                      </div>
                      <Accordion type="single" collapsible className="w-full">
                        {entries.map((entry) => (
                          <AccordionItem key={entry.id} value={entry.id}>
                            <AccordionTrigger data-testid={`faq-question-${entry.id}`}>
                              {entry.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {entry.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manuals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Manuals & Documentation</CardTitle>
              <CardDescription>
                Step-by-step guides and documentation for using the portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {manualsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : Object.keys(manualsByCategory).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No user manuals available yet
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(manualsByCategory).map(([category, categoryManuals]) => {
                    const Icon = categoryIcons[category] || FileText;
                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{categoryLabels[category] || category}</h3>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {categoryManuals.map((manual) => (
                            <Card key={manual.id} className="hover-elevate">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">{manual.title}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="mb-3 text-sm text-muted-foreground">
                                  {manual.description}
                                </p>
                                <div className="flex gap-2">
                                  {manual.content && (
                                    <Button size="sm" variant="outline" data-testid={`button-view-manual-${manual.id}`}>
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                      View
                                    </Button>
                                  )}
                                  {manual.fileUrl && (
                                    <Button size="sm" variant="outline" data-testid={`button-download-manual-${manual.id}`}>
                                      <Download className="mr-1 h-3 w-3" />
                                      Download
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <OtherModulesSection />
    </div>
  );
}
