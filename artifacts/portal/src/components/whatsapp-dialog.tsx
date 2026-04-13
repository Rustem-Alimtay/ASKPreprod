import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Users, 
  FileText, 
  Settings, 
  Plus, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MessageSquare,
  Crown,
  Calendar,
  Trash2
} from "lucide-react";
// Inline WhatsApp icon (replaces 83MB react-icons package)
function SiWhatsapp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const contactGroups = [
  { id: "vip-guests", name: "VIP Guests", count: 45, description: "High-value guests and patrons" },
  { id: "corporate", name: "Corporate Clients", count: 120, description: "Business partners and sponsors" },
  { id: "members", name: "Club Members", count: 350, description: "Registered members" },
  { id: "media", name: "Media & Press", count: 28, description: "Journalists and influencers" },
];

const messageTemplates = [
  { id: "vip-invite", name: "VIP Event Invitation", category: "Hospitality", variables: ["guest_name", "event_name", "event_date", "venue"] },
  { id: "rsvp-request", name: "RSVP Request", category: "General", variables: ["guest_name", "event_name", "rsvp_link"] },
  { id: "reminder", name: "Event Reminder", category: "Automated", variables: ["guest_name", "event_name", "event_date", "time"] },
  { id: "thank-you", name: "Post-Event Thank You", category: "Follow-up", variables: ["guest_name", "event_name"] },
];

const recentMessages = [
  { id: 1, template: "VIP Event Invitation", recipients: 45, sent: "2 hours ago", status: "delivered" },
  { id: 2, template: "RSVP Request", recipients: 120, sent: "1 day ago", status: "delivered" },
  { id: 3, template: "Event Reminder", recipients: 200, sent: "3 days ago", status: "delivered" },
];

export function WhatsAppDialog({ open, onOpenChange }: WhatsAppDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("send");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const getTotalRecipients = () => {
    return contactGroups
      .filter(g => selectedGroups.includes(g.id))
      .reduce((sum, g) => sum + g.count, 0);
  };

  const handleSendMessage = () => {
    if (!selectedTemplate && !customMessage) {
      toast({
        title: "Missing content",
        description: "Please select a template or write a custom message.",
        variant: "destructive"
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one contact group.",
        variant: "destructive"
      });
      return;
    }

    const action = isScheduled ? "scheduled" : "sent";
    toast({
      title: `Message ${action} successfully`,
      description: `Your message will be ${action} to ${getTotalRecipients()} recipients.`,
    });

    setSelectedTemplate("");
    setSelectedGroups([]);
    setCustomMessage("");
    setScheduledDate("");
    setScheduledTime("");
    setIsScheduled(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-outfit">
            <SiWhatsapp className="h-6 w-6 text-green-500" />
            WhatsApp Business Management
          </DialogTitle>
          <DialogDescription>
            Send messages, manage templates, and configure your WhatsApp Business account
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="send" className="gap-2" data-testid="tab-send">
              <Send className="h-4 w-4" />
              Send Message
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2" data-testid="tab-groups">
              <Users className="h-4 w-4" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Send Message Tab */}
          <TabsContent value="send" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Message Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="mt-1.5" data-testid="select-template">
                      <SelectValue placeholder="Select a template or write custom" />
                    </SelectTrigger>
                    <SelectContent>
                      {messageTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            {template.category === "Hospitality" && <Crown className="h-3 w-3 text-amber-500" />}
                            {template.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Custom Message (Optional)</Label>
                  <Textarea 
                    placeholder="Write a custom message or personalize the template..."
                    className="mt-1.5 min-h-[120px]"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    data-testid="input-custom-message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {"{guest_name}"}, {"{event_name}"}, {"{event_date}"} for personalization
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="schedule" 
                    checked={isScheduled}
                    onCheckedChange={(checked) => setIsScheduled(checked === true)}
                    data-testid="checkbox-schedule"
                  />
                  <Label htmlFor="schedule" className="text-sm">Schedule for later</Label>
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Date</Label>
                      <Input 
                        type="date" 
                        className="mt-1.5"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        data-testid="input-schedule-date"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Time</Label>
                      <Input 
                        type="time" 
                        className="mt-1.5"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        data-testid="input-schedule-time"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium">Select Recipients</Label>
                <div className="space-y-2">
                  {contactGroups.map((group) => (
                    <div 
                      key={group.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedGroups.includes(group.id) 
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleGroupToggle(group.id)}
                      data-testid={`group-${group.id}`}
                    >
                      <Checkbox 
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => handleGroupToggle(group.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                      <Badge variant="secondary">{group.count}</Badge>
                    </div>
                  ))}
                </div>

                {selectedGroups.length > 0 && (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Recipients</span>
                      <span className="text-lg font-bold text-green-600">{getTotalRecipients()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleSendMessage}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4 mr-2" />
                {isScheduled ? "Schedule Message" : "Send Now"}
              </Button>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Manage your message templates</p>
              <Button size="sm" data-testid="button-create-template">
                <Plus className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </div>
            <div className="space-y-3">
              {messageTemplates.map((template) => (
                <Card key={template.id} data-testid={`template-${template.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {template.category === "Hospitality" ? (
                          <Crown className="h-5 w-5 text-amber-500 mt-0.5" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">Category: {template.category}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.variables.map((v) => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {"{" + v + "}"}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-edit-${template.id}`}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-use-${template.id}`}>
                          Use
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Manage your contact groups</p>
              <Button size="sm" data-testid="button-create-group">
                <Plus className="h-4 w-4 mr-1" />
                Create Group
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {contactGroups.map((group) => (
                <Card key={group.id} data-testid={`contact-group-${group.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{group.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                      </div>
                      <Badge>{group.count} contacts</Badge>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${group.id}`}>
                        View Contacts
                      </Button>
                      <Button variant="ghost" size="sm" data-testid={`button-edit-group-${group.id}`}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">Recent message history</p>
            <div className="space-y-3">
              {recentMessages.map((msg) => (
                <Card key={msg.id} data-testid={`history-${msg.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{msg.template}</p>
                          <p className="text-xs text-muted-foreground">
                            {msg.recipients} recipients • {msg.sent}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {msg.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Account Status Footer */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <SiWhatsapp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-sm">WhatsApp Business Account</p>
                <p className="text-xs text-muted-foreground">+971 4 XXX XXXX • Connected</p>
              </div>
            </div>
            <Button variant="outline" size="sm" data-testid="button-account-settings">
              <Settings className="h-4 w-4 mr-1" />
              Account Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
