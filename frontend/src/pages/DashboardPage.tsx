import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, EmptyState, ErrorBanner, Skeleton, StatCard } from "@/components/ui/Card";
import { useOverview, useSla, useVolume } from "@/hooks/useAI";
import { timeAgo } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#06b6d4",
  HIGH: "#f59e0b",
  URGENT: "#ef4444",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#10b981",
  neutral: "#94a3b8",
  negative: "#ef4444",
};

const CATEGORY_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"];

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useOverview();
  const { data: volume } = useVolume(14);
  const { data: sla } = useSla();
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role !== "CUSTOMER";

  if (error) return <ErrorBanner message={error.message} onRetry={() => void refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const priorityData = Object.entries(data.by_priority).map(([name, value]) => ({ name, value }));
  const sentimentData = Object.entries(data.by_sentiment).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(data.by_category)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const urgentTickets = [
    ...(sla?.breached ?? []),
    ...(sla?.at_risk ?? []),
  ].slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {user?.first_name || user?.username}. Live metrics refresh every 30s.
          </p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          + New ticket
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={data.totals.open}
          hint={`${data.totals.unassigned} unassigned`}
          tone="brand"
        />
        <StatCard
          label="SLA breached"
          value={data.totals.sla_breached}
          hint={`${data.totals.sla_at_risk} at risk (next 4h)`}
          tone={data.totals.sla_breached > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Created this week"
          value={data.totals.created_this_week}
          hint={`${data.totals.resolved_this_week} resolved`}
        />
        <StatCard
          label="Avg first response"
          value={data.sla.avg_first_response_minutes !== null ? `${data.sla.avg_first_response_minutes}m` : "—"}
          hint={
            data.sla.avg_resolution_hours !== null
              ? `Avg resolution ${data.sla.avg_resolution_hours}h`
              : undefined
          }
          tone="success"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ticket volume" subtitle="Created vs resolved — last 14 days" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volume?.series ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="created" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="created" stroke="#6366f1" fill="url(#created)" strokeWidth={2} />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="url(#resolved)" strokeWidth={2} />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Priority mix" subtitle="All tickets" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="By category" subtitle="Ticket distribution" />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Customer sentiment" subtitle="VADER analysis of ticket text" />
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={90}>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="SLA watchlist"
            subtitle="Breached and at-risk tickets"
            actions={
              isStaff ? (
                <Link to="/analytics" className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              ) : undefined
            }
          />
          <CardBody className="space-y-2 p-3">
            {urgentTickets.length === 0 && (
              <EmptyState title="Nothing at risk" description="All open tickets are within SLA." />
            )}
            {urgentTickets.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:border-slate-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {t.number} · {t.category_name ?? "Uncategorised"} · {timeAgo(t.created_at)}
                  </div>
                </div>
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
