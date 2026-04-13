import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Clock, AlertCircle, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Reminder {
  id: number;
  title: string;
  source: string;
  time: string;
  overdue: boolean;
  initials: string;
  color: string;
}

const defaultReminders: Reminder[] = [
  {
    id: 1,
    title: "Q4 Budget Review Meeting",
    source: "Calendar",
    time: "Overdue (10:30 AM)",
    overdue: true,
    initials: "BM",
    color: "bg-blue-500",
  },
  {
    id: 2,
    title: "NetSuite Monthly Reconciliation",
    source: "Finance Task",
    time: "Due in 30 minutes",
    overdue: false,
    initials: "NS",
    color: "bg-teal-500",
  },
];

export function NotificationReminder() {
  const [isVisible, setIsVisible] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>(defaultReminders);

  if (!isVisible || reminders.length === 0) return null;

  const handleDismiss = () => {
    setReminders([]);
    setIsVisible(false);
  };

  const handleSnooze = () => {
    setIsVisible(false);
    setTimeout(() => setIsVisible(true), 300000);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[360px]"
      data-testid="notification-reminder-popup"
    >
      <Card className="overflow-hidden shadow-lg border-border">
        <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-semibold text-primary-foreground">
              {reminders.length} Reminder{reminders.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground"
            onClick={() => setIsVisible(false)}
            data-testid="button-close-reminders"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="divide-y divide-border">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-start gap-3 px-4 py-3 hover-elevate cursor-pointer"
              data-testid={`reminder-item-${reminder.id}`}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                <AvatarFallback className={`${reminder.color} text-white text-xs`}>
                  {reminder.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">{reminder.source}</p>
                <div className="flex items-center gap-1 mt-1">
                  {reminder.overdue ? (
                    <AlertCircle className="h-3 w-3 text-destructive" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span
                    className={`text-xs ${
                      reminder.overdue
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {reminder.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSnooze}
            data-testid="button-snooze-reminders"
          >
            Snooze
          </Button>
          <Button
            size="sm"
            onClick={handleDismiss}
            data-testid="button-dismiss-reminders"
          >
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
