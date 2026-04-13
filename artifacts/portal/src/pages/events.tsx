import { UnderDevelopmentBanner } from "@/components/under-development-banner";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServicePageLayout } from "@/components/service-page-layout";
import { OtherModulesSection } from "@/components/other-modules-section";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { 
  Calendar, 
  Star, 
  Trophy, 
  Users, 
  ExternalLink,
  BarChart3,
  Sparkles,
  PartyPopper,
  MessageCircle,
  Mail,
  Phone,
  Send,
  UserCheck,
  Shield,
  FileText,
  Settings,
  ChevronRight,
  Crown,
  ClipboardList
} from "lucide-react";
// Inline WhatsApp icon (replaces 83MB react-icons package)
function SiWhatsapp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
import type { PageSectionWithTemplate } from "@shared";

const SERVICE_URL = "/events";

const upcomingEvents: { id: number; name: string; date: string; type: string; attendees: number; status: string }[] = [];

const communicationChannels = [
  { id: "whatsapp", name: "WhatsApp Business", status: "pending", icon: SiWhatsapp, iconBg: "bg-green-100 text-green-600 dark:bg-green-900/30", messages: 0 },
  { id: "email", name: "Email Campaigns", status: "pending", icon: Mail, iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30", messages: 0 },
  { id: "sms", name: "SMS Gateway", status: "pending", icon: Phone, iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/30", messages: 0 },
];

const messageTemplates: { id: number; name: string; type: string; category: string; uses: number }[] = [];

const recentCampaigns: { id: number; name: string; channel: string; sent: number; responded: number; pending: number; status: string }[] = [];

const moderationQueue: { id: number; type: string; from: string; message: string; time: string }[] = [];

const handleLaunchPlatinumList = () => {
  window.open("https://platinumlist.net", "_blank");
};

const handleLaunchPick6 = () => {
  window.open("https://racingeye.com/pick6", "_blank");
};

export default function EventsPage() {
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  function renderSection(section: PageSectionWithTemplate) {
    switch (section.title) {
      case "Events Overview":
        return (
          <>
            <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-4">
                  <div>
                    <p className="text-purple-100 text-sm">Upcoming Events</p>
                    <p className="text-3xl font-bold">0</p>
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm">This Month</p>
                    <p className="text-3xl font-bold">0</p>
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm">Total Attendees (YTD)</p>
                    <p className="text-3xl font-bold">0</p>
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm">Active Vendors</p>
                    <p className="text-3xl font-bold">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 mt-4">
              <Card className="hover-elevate cursor-pointer" onClick={handleLaunchPlatinumList} data-testid="card-platinum-list">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white">
                      <Star className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Platinum List</h3>
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Integrated</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Event ticketing and management platform. Sell tickets, manage guest lists, and track attendance.
                      </p>
                      <Button size="sm" data-testid="button-launch-platinum">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Launch Platform
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" onClick={handleLaunchPick6} data-testid="card-pick6">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <Trophy className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Pick6 by Racing Eye</h3>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Nominations</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Racing nominations and selections system. Manage horse racing events and participant registrations.
                      </p>
                      <Button size="sm" data-testid="button-launch-pick6">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Launch System
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        );

      case "Upcoming Events":
        return (
          <div className="space-y-4">
            {upcomingEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming events to display.</p>
            )}
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 rounded-lg border hover-elevate">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <PartyPopper className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">{event.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge variant="outline">{event.type}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{event.attendees} attendees</p>
                  </div>
                  <Badge className={event.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        );

      case "Communication Channels":
        return (
          <>
            <Card className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MessageCircle className="h-7 w-7" />
                  <div>
                    <h2 className="text-xl font-bold font-outfit">Communication Management</h2>
                    <p className="text-green-100 text-sm">WhatsApp Business, Email Campaigns & VIP Hospitality Invitations</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-green-100 text-sm">Active Channels</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-sm">Messages Sent (MTD)</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-sm">Response Rate</p>
                    <p className="text-2xl font-bold">0%</p>
                  </div>
                  <div>
                    <p className="text-green-100 text-sm">Pending Moderation</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3 mt-4">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                    <CardTitle className="text-lg font-outfit">Communication Channels</CardTitle>
                    <Button variant="ghost" size="sm" data-testid="button-channel-settings">
                      <Settings className="h-4 w-4 mr-1" />
                      Settings
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {communicationChannels.map((channel) => (
                        <div 
                          key={channel.id}
                          className="flex items-center gap-4 p-4 rounded-lg border hover-elevate"
                          data-testid={`channel-${channel.id}`}
                        >
                          <div className={`p-3 rounded-lg ${channel.iconBg}`}>
                            <channel.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{channel.name}</p>
                              <Badge className={channel.status === "connected" 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }>
                                {channel.status === "connected" ? "Connected" : "Setup Pending"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {channel.messages > 0 ? `${channel.messages.toLocaleString()} messages sent` : "Not configured"}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (channel.id === "whatsapp") {
                                setWhatsappDialogOpen(true);
                              }
                            }}
                            data-testid={`button-manage-${channel.id}`}
                          >
                            Manage
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-outfit flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-500" />
                      Moderation Queue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {moderationQueue.length === 0 && (
                        <p className="text-sm text-muted-foreground">No items in moderation queue.</p>
                      )}
                      {moderationQueue.map((item) => (
                        <div 
                          key={item.id}
                          className="p-3 rounded-lg border space-y-2"
                          data-testid={`moderation-${item.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{item.from}</p>
                              <p className="text-xs text-muted-foreground">{item.time}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">{item.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.message}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1" data-testid={`button-approve-${item.id}`}>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" data-testid={`button-view-${item.id}`}>
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-outfit flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-500" />
                      VIP Invitation Example
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                      <p className="text-sm font-medium">Annual Gala Dinner 2026</p>
                      <p className="text-xs text-muted-foreground">
                        You are cordially invited to our exclusive Annual Gala Dinner. Please confirm your attendance and any dietary requirements.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-rsvp-yes">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-rsvp-form">
                          <ClipboardList className="h-3 w-3 mr-1" />
                          RSVP Form
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Setup Procedure:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Connect WhatsApp Business API</li>
                        <li>Create guest contact groups</li>
                        <li>Design message templates</li>
                        <li>Link RSVP forms (JotForm)</li>
                        <li>Set moderation rules</li>
                        <li>Schedule automated sends</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-outfit">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-send-broadcast">
                        <Send className="h-4 w-4" />
                        Send Broadcast
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-manage-contacts">
                        <Users className="h-4 w-4" />
                        Manage Contact Groups
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-rsvp-reports">
                        <ClipboardList className="h-4 w-4" />
                        RSVP Reports
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-moderation-settings">
                        <Shield className="h-4 w-4" />
                        Moderation Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        );

      case "Message Templates":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg font-outfit">Message Templates</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-create-template">
                <FileText className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {messageTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No message templates to display.</p>
                )}
                {messageTemplates.map((template) => (
                  <div 
                    key={template.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {template.category === "VIP Hospitality" && (
                        <Crown className="h-4 w-4 text-amber-500" />
                      )}
                      {template.category !== "VIP Hospitality" && (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.type} • {template.uses} uses</p>
                      </div>
                    </div>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "Campaign Management":
        return (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg font-outfit">Recent Campaigns</CardTitle>
                <Button size="sm" data-testid="button-new-campaign">
                  <Send className="h-4 w-4 mr-1" />
                  New Campaign
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentCampaigns.length === 0 && (
                    <p className="text-sm text-muted-foreground">No campaigns to display.</p>
                  )}
                  {recentCampaigns.map((campaign) => (
                    <div 
                      key={campaign.id}
                      className="p-4 rounded-lg border hover-elevate"
                      data-testid={`campaign-${campaign.id}`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-muted-foreground">{campaign.channel}</p>
                        </div>
                        <Badge className={campaign.status === "active" 
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }>
                          {campaign.status === "active" ? "Active" : "Completed"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Sent</p>
                          <p className="font-medium">{campaign.sent}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Responded</p>
                          <p className="font-medium text-green-600">{campaign.responded}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-medium text-yellow-600">{campaign.pending}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Reports & Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button variant="outline" className="justify-start" data-testid="button-report-events">
                    <Calendar className="mr-2 h-4 w-4" />
                    Event Calendar Report
                  </Button>
                  <Button variant="outline" className="justify-start" data-testid="button-report-attendance">
                    <Users className="mr-2 h-4 w-4" />
                    Attendance Analytics
                  </Button>
                  <Button variant="outline" className="justify-start" data-testid="button-report-revenue">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Event Revenue Report
                  </Button>
                  <Button variant="outline" className="justify-start" data-testid="button-report-vendors">
                    <Trophy className="mr-2 h-4 w-4" />
                    Vendor Performance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <>
      <ServicePageLayout
        serviceUrl={SERVICE_URL}
        title="Events & Entertainment"
        subtitle="Event planning, communication channels, and campaign management"
        collaborationSection="events"
        externalLinks={[
          { label: "Launch Power BI", url: "https://app.powerbi.com", icon: BarChart3 },
          { label: "Launch PlatinumList", url: "https://platinumlist.net" },
        ]}
        renderSection={renderSection}
      >
      <UnderDevelopmentBanner />
        <OtherModulesSection />
      </ServicePageLayout>
      <WhatsAppDialog 
        open={whatsappDialogOpen} 
        onOpenChange={setWhatsappDialogOpen} 
      />
    </>
  );
}
