import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PriorityBadge, SentimentBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, EmptyState, ErrorBanner, Skeleton } from "@/components/ui/Card";
import { useCategories } from "@/hooks/useTickets";
import { useTickets, type TicketFilters } from "@/hooks/useTickets";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<TicketFilters>(
    () => ({
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      priority: params.get("priority") ?? undefined,
      category: params.get("category") ?? undefined,
      sla_status: params.get("sla_status") ?? undefined,
      ordering: params.get("ordering") ?? "-created_at",
      page: params.get("page") ?? undefined,
    } as TicketFilters),
    [params],
  );

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return { filters, setFilter, params, setParams };
}

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const SLA_OPTIONS = [
  { value: "", label: "Any SLA" },
  { value: "breached", label: "SLA breached" },
  { value: "at_risk", label: "SLA at risk" },
  { value: "ok", label: "SLA on track" },
];

export function TicketsPage() {
  const { filters, setFilter, params, setParams } = useUrlFilters();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebounced(search);
  const { data, isLoading, error, refetch, isFetching } = useTickets(filters, { pollMs: 20_000 });
  const { data: categories } = useCategories();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (debouncedSearch !== current) setFilter("q", debouncedSearch || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const page = Number(params.get("page") ?? "1");
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tickets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.count} matching · ` : ""}
            {isFetching ? "syncing…" : "live"}
          </p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          + New ticket
        </Link>
      </div>
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search title, body or ticket #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tickets"
        />
        <select
          className="input w-auto"
          value={params.get("status") ?? ""}
          onChange={(e) => setFilter("status", e.target.value || undefined)}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={params.get("priority") ?? ""}
          onChange={(e) => setFilter("priority", e.target.value || undefined)}
          aria-label="Filter by priority"
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={params.get("category") ?? ""}
          onChange={(e) => setFilter("category", e.target.value || undefined)}
          aria-label="Filter by category"
        >
          <option value="">Any category</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={params.get("sla_status") ?? ""}
          onChange={(e) => setFilter("sla_status", e.target.value || undefined)}
          aria-label="Filter by SLA"
        >
          {SLA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={params.get("ordering") ?? "-created_at"}
          onChange={(e) => setFilter("ordering", e.target.value)}
          aria-label="Sort"
        >
          <option value="-created_at">Newest first</option>
          <option value="created_at">Oldest first</option>
          <option value="due_at">SLA deadline</option>
          <option value="-due_at">SLA deadline (desc)</option>
        </select>
        {(params.get("status") ||
          params.get("priority") ||
          params.get("category") ||
          params.get("sla_status") ||
          params.get("q")) && (
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => {
              setSearch("");
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            Clear filters
          </button>
        )}
      </Card>

      {error && <ErrorBanner message={error.message} onRetry={() => void refetch()} />}
      {isLoading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {data && data.results.length === 0 && (
        <Card>
          <EmptyState
            title="No tickets match"
            description="Try clearing filters or widening your search."
          />
        </Card>
      )}

      {data && data.results.length > 0 && (
        <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {data.results.map((t) => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50/50 dark:hover:bg-slate-800/50"
            >
              <span className="w-24 shrink-0 font-mono text-xs text-slate-400">{t.number}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <span>{t.requester_username}</span>
                  {t.category_name && <span>· {t.category_name}</span>}
                  {t.team_name && <span>· {t.team_name}</span>}
                  {t.assignee_username ? (
                    <span>· @{t.assignee_username}</span>
                  ) : (
                    <span className="font-medium text-warning-600">· unassigned</span>
                  )}
                  <span>· {timeAgo(t.created_at)}</span>
                  {t.comment_count > 0 && <span>· 💬 {t.comment_count}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SentimentBadge sentiment={t.sentiment} />
                <PriorityBadge priority={t.priority} aiSuggested={t.is_priority_ai_suggested} />
                <StatusBadge status={t.status} />
                {t.is_sla_breached && (
                  <span className={cn("rounded-full bg-danger-500/15 px-2 py-0.5 text-xs font-semibold text-danger-600")}>
                    SLA
                  </span>
                )}
              </div>
            </Link>
          ))}
        </Card>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setFilter("page", String(page - 1))}
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setFilter("page", String(page + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
