import { formatDistanceToNowStrict, format, isPast } from "date-fns";

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function dateTime(iso?: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy HH:mm");
}

export function isOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  return isPast(new Date(iso));
}

export function minutesUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export function pct(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}
