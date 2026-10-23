import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, EmptyState, ErrorBanner, Skeleton, StatCard } from "@/components/ui/Card";
import { useAgentWorkload, useCategoryTrends, useSla } from "@/hooks/useAI";
import { timeAgo } from "@/lib/format";

const CATEGORY_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"];

export function AnalyticsPage() {
  const sla = useSla();
  const workload = useAgentWorkload();
  const trends = useCategoryTrends(30);

  if (sla.error) return <ErrorBanner message={sla.error.message} onRetry={() => void sla.refetch()} />;

  const trendSeries = Object.entries(trends.data?.series ?? {}).map(([name, points], i) => ({
    name,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    points,
  }));

  const dates = Array.from(
    new Set(trendSeries.flatMap((s) => s.points.map((p) => p.date))),
  ).sort();
  const aligned = dates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    for (const s of trendSeries) {
      row[s.name] = s.points.find((p) => p.date === date)?.count ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Operations analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          SLA exposure, agent workload and category trends. Polls every 20–30s.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="SLA breached"
          value={sla.data?.counts.breached ?? "—"}
          tone={(sla.data?.counts.breached ?? 0) > 0 ? "danger" : "success"}
        />
        <StatCard
          label="At risk (4h)"
          value={sla.data?.counts.at_risk ?? "—"}
          tone={(sla.data?.counts.at_risk ?? 0) > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Active agents"
          value={workload.data?.agents.length ?? "—"}
          hint="Agents & team leads"
        />
        <StatCard
          label="Most loaded"
          value={workload.data?.agents[0]?.username ?? "—"}
          hint={
            workload.data?.agents[0]
              ? `${workload.data.agents[0].open_assigned} open tickets`
              : undefined
          }
          tone="brand"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Category trends" subtitle="New tickets per day — last 30 days" />
          <CardBody className="h-80">
            {trends.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aligned} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {trendSeries.map((s) => (
                    <Line
                      key={s.name}
                      type="monotone"
                      dataKey={s.name}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Agent workload" subtitle="Open vs resolved, with urgent load" />
          <CardBody className="h-80">
            {workload.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload.data?.agents ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis dataKey="username" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="open_assigned" name="Open" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved_total" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="urgent_open" name="Urgent open" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="SLA watchlist"
          subtitle="Breach first — every row links to the ticket"
        />
        <CardBody className="space-y-6 p-0">
          {sla.isLoading && <Skeleton className="m-5 h-40" />}
          {!sla.isLoading && (sla.data?.breached.length ?? 0) === 0 && (sla.data?.at_risk.length ?? 0) === 0 && (
            <EmptyState title="All clear" description="No open tickets are breaching or at risk." />
          )}
          {(["breached", "at_risk"] as const).map((bucket) => {
            const rows = sla.data?.[bucket] ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={bucket}>
                <h3
                  className={
                    bucket === "breached"
                      ? "px-5 pt-4 text-xs font-semibold text-danger-600 uppercase"
                      : "px-5 pt-4 text-xs font-semibold text-warning-600 uppercase"
                  }
                >
                  {bucket === "breached" ? "Breached" : "At risk (next 4 hours)"} ({rows.length})
                </h3>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.slice(0, 8).map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/tickets/${t.id}`}
                        className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <span className="w-24 font-mono text-xs text-slate-400">{t.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-slate-400">
                          due {t.due_at ? timeAgo(t.due_at) : "—"}
                        </span>
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                        <span className="text-xs text-slate-400">
                          @{t.assignee_username ?? "unassigned"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
