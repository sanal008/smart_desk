import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "purple" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
  success: "bg-success-500/15 text-success-600 dark:text-success-500",
  warning: "bg-warning-500/15 text-warning-600 dark:text-warning-500",
  danger: "bg-danger-500/15 text-danger-600 dark:text-danger-500",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  cyan: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const priorityTone = {
  LOW: "neutral",
  MEDIUM: "cyan",
  HIGH: "warning",
  URGENT: "danger",
} as const;

const priorityDot = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-cyan-500",
  HIGH: "bg-warning-500",
  URGENT: "bg-danger-500 animate-pulse",
} as const;

export function PriorityBadge({ priority, aiSuggested }: { priority: string; aiSuggested?: boolean }) {
  return (
    <Badge tone={priorityTone[priority as keyof typeof priorityTone] ?? "neutral"}>
      <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[priority as keyof typeof priorityDot] ?? "bg-slate-400")} />
      {priority}
      {aiSuggested && <span title="Suggested by AI">✦</span>}
    </Badge>
  );
}

const statusTone = {
  NEW: "brand",
  TRIAGED: "purple",
  IN_PROGRESS: "warning",
  WAITING_CUSTOMER: "cyan",
  RESOLVED: "success",
  CLOSED: "neutral",
} as const;

const statusLabel = {
  NEW: "New",
  TRIAGED: "Triaged",
  IN_PROGRESS: "In Progress",
  WAITING_CUSTOMER: "Waiting",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
} as const;

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone[status as keyof typeof statusTone] ?? "neutral"}>
      {statusLabel[status as keyof typeof statusLabel] ?? status}
    </Badge>
  );
}

const sentimentTone = {
  positive: "success",
  neutral: "neutral",
  negative: "danger",
} as const;

export function SentimentBadge({ sentiment }: { sentiment?: string }) {
  if (!sentiment) return null;
  const glyph = sentiment === "positive" ? "☺" : sentiment === "negative" ? "☹" : "∙";
  return (
    <Badge tone={sentimentTone[sentiment as keyof typeof sentimentTone] ?? "neutral"} title={`Sentiment: ${sentiment}`}>
      {glyph} {sentiment}
    </Badge>
  );
}
