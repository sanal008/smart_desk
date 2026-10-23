import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={cn("card", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800", className)}
      aria-hidden
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  icon?: ReactNode;
}) {
  const toneClass = {
    neutral: "text-slate-900 dark:text-slate-100",
    success: "text-success-600 dark:text-success-500",
    warning: "text-warning-600 dark:text-warning-500",
    danger: "text-danger-600 dark:text-danger-500",
    brand: "text-brand-600 dark:text-brand-300",
  }[tone];

  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {label}
        </span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <span className={cn("text-2xl font-semibold tabular-nums", toneClass)}>{value}</span>
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800">
        ◇
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function ConfidenceBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pctValue = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone =
    pctValue >= 75 ? "bg-success-500" : pctValue >= 50 ? "bg-warning-500" : "bg-danger-500";
  return (
    <div className="flex items-center gap-2" title={`Confidence ${pctValue}%`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pctValue}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{pctValue}%</span>
      )}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-500">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost text-xs">
          Retry
        </button>
      )}
    </div>
  );
}
