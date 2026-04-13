import {
  Clock,
  RefreshCw,
  Eye,
  CheckCircle,
  Monitor,
  Zap,
  HelpCircle,
} from "lucide-react";

export const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  new: { label: "New", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Clock },
  in_progress: { label: "In Progress", color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", icon: RefreshCw },
  under_review: { label: "Under Review", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: Eye },
  resolved: { label: "Resolved", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  closed: { label: "Closed", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30", icon: CheckCircle },
};

export const severityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "secondary" },
  medium: { label: "Medium", variant: "default" },
  high: { label: "High", variant: "destructive" },
  critical: { label: "Critical", variant: "destructive" },
};

export const categoryConfig: Record<string, { label: string; icon: any; color: string; bgColor: string; gradient: string }> = {
  it_support: { label: "IT Support", icon: Monitor, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", gradient: "from-blue-600 to-cyan-600" },
  digital_transformation: { label: "Digital Transformation", icon: Zap, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", gradient: "from-purple-600 to-pink-600" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30", gradient: "from-gray-600 to-gray-700" },
};
