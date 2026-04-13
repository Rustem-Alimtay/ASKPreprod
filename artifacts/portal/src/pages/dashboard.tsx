import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { DetailPanel } from "@/components/detail-panel";
import { 
  User,
  Wrench,
  Monitor,
  Zap,
  FileText,
  Calendar,
  ExternalLink
} from "lucide-react";

interface IntranetItem {
  id: number;
  title: string;
  date: string;
  preview: string;
  dotColor: string;
  body: string;
  author: string;
}

const intranetUpdates: IntranetItem[] = [];

const quickLinks = [
  { title: "IT Support", icon: Monitor, url: "/intranet?newTicket=it_support" },
  { title: "Digital Transformation", icon: Zap, url: "/intranet?newTicket=digital_transformation" },
  { title: "Requisition ARF", icon: FileText, url: "/intranet/requisitions" },
];

const serviceColors = [
  "bg-blue-600", "bg-teal-500", "bg-yellow-500", "bg-indigo-500",
  "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
];

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedUpdate, setSelectedUpdate] = useState<IntranetItem | null>(null);
  
  const firstName = user?.firstName || user?.username || "User";

  const { data: enabledServices = [], isLoading: servicesLoading } = useQuery<any[]>({
    queryKey: ["/api/services/enabled"],
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute right-0 top-0 text-[200px] font-bold text-white/5 tracking-tighter leading-none select-none">
            UNIFIED
          </div>
        </div>
        
        <div className="relative z-10">
          <Badge className="bg-primary/20 text-primary border-0 mb-3">
            Welcome back, {firstName}
          </Badge>
          
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-1 font-outfit">
            Enterprise Operations
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3 font-outfit">
            Unified Portal
          </h2>
          
          <p className="text-slate-300 max-w-xl mb-5 text-sm">
            Access all business operational units, BI tools, and support systems
            from a single centralized hub.
          </p>
          
          <Link href="/settings">
            <Button 
              variant="outline" 
              className="bg-transparent border-slate-600 text-white hover:bg-slate-700"
              data-testid="button-view-profile"
            >
              <User className="h-4 w-4 mr-2" />
              View Profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-10 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <h3 className="text-lg font-semibold font-outfit">Business Applications</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servicesLoading ? (
                  <>
                    {[1,2,3,4].map(i => (
                      <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
                    ))}
                  </>
                ) : enabledServices.map((svc: any, idx: number) => (
                  <Link key={svc.id} href={svc.url || "#"}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`app-card-${svc.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-md ${serviceColors[idx % serviceColors.length]} text-white text-sm font-bold flex-shrink-0`}>
                            {svc.name?.charAt(0) || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold">{svc.name}</h4>
                              <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                                Active
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{svc.description || svc.category || "Business module"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-base font-semibold font-outfit mb-1">Intranet Updates</h3>
                <p className="text-xs text-muted-foreground mb-4">Latest news and announcements</p>
                
                <div className="space-y-1">
                  {intranetUpdates.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-updates">No updates yet</p>
                  ) : intranetUpdates.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-2.5 -mx-1 rounded-md hover-elevate cursor-pointer"
                      onClick={() => setSelectedUpdate(item)}
                      data-testid={`intranet-item-${item.id}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${item.dotColor} mt-1.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.date}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.preview}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Quick Links</h3>
                </div>
                
                <div className="space-y-1">
                  {quickLinks.map((link) => (
                    <Link key={link.title} href={link.url}>
                      <div
                        className="flex items-center gap-3 p-2.5 -mx-1 rounded-md hover-elevate cursor-pointer"
                        data-testid={`quick-link-${link.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <link.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{link.title}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DetailPanel
        isOpen={!!selectedUpdate}
        onClose={() => setSelectedUpdate(null)}
        title={selectedUpdate?.title || ""}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedUpdate(null)} data-testid="button-close-update">
              Close
            </Button>
          </div>
        }
      >
        {selectedUpdate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${selectedUpdate.dotColor}`} />
              <span className="text-xs text-muted-foreground">{selectedUpdate.date}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              By {selectedUpdate.author}
            </p>
            <div className="border-t border-border pt-4">
              <p className="text-sm leading-relaxed">{selectedUpdate.body}</p>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}
