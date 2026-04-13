import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  initials: string;
  color: string;
  category: "announcement" | "system" | "task";
}

const initialNotifications: NotificationItem[] = [
  {
    id: 1,
    title: "New HR Policy Update",
    description: "Updated leave policy for Q1 2026 has been published.",
    time: "2 hours ago",
    read: false,
    initials: "HR",
    color: "bg-blue-500",
    category: "announcement",
  },
  {
    id: 2,
    title: "Q4 Financial Results Townhall",
    description: "Tomorrow at 2:00 PM in the main conference hall.",
    time: "5 hours ago",
    read: false,
    initials: "FN",
    color: "bg-green-500",
    category: "announcement",
  },
  {
    id: 3,
    title: "NetSuite Maintenance Scheduled",
    description: "System maintenance on Jan 15 from 11 PM to 2 AM.",
    time: "Yesterday",
    read: true,
    initials: "IT",
    color: "bg-purple-500",
    category: "system",
  },
  {
    id: 4,
    title: "Sprint Review Completed",
    description: "Sprint 24 review notes are now available.",
    time: "2 days ago",
    read: true,
    initials: "PM",
    color: "bg-amber-500",
    category: "task",
  },
];

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0"
        data-testid="notification-dropdown"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="flex items-start gap-3 px-4 py-3 hover-elevate cursor-pointer border-b border-border last:border-b-0"
                data-testid={`notification-item-${item.id}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                  <AvatarFallback
                    className={`${item.color} text-white text-xs`}
                  >
                    {item.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      item.read ? "font-normal" : "font-semibold"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.time}
                  </p>
                </div>
                {!item.read && (
                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-2.5">
          <button
            className="w-full text-center text-xs text-primary hover:underline"
            data-testid="link-view-all-notifications"
          >
            View All Notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
