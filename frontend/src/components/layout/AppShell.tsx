import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useLogout, useMe } from "@/hooks/useAuth";
import { useModelStatus } from "@/hooks/useAI";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { Spinner } from "@/components/ui/Card";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  staffOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "▤" },
  { to: "/board", label: "Kanban Board", icon: "▦" },
  { to: "/tickets", label: "Tickets", icon: "☰" },
  { to: "/tickets/new", label: "New Ticket", icon: "＋" },
  { to: "/analytics", label: "Analytics", icon: "◔", staffOnly: true },
  { to: "/model", label: "Model Monitoring", icon: "✦", staffOnly: true },
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me, isLoading } = useMe();
  const { data: modelStatus } = useModelStatus();

  const isStaff = user?.role === "AGENT" || user?.role === "TEAM_LEAD" || user?.role === "ADMIN";

  if (isLoading && !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    );
  }

  const displayName = me?.first_name ? `${me.first_name} ${me.last_name}`.trim() : user?.username;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900",
          !sidebarOpen && "w-16",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-4 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            S
          </span>
          {sidebarOpen && (
            <div className="leading-tight">
              <div className="text-sm font-semibold">SmartDesk</div>
              <div className="text-[10px] tracking-widest text-slate-400 uppercase">AI Triage</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.filter((item) => !item.staffOnly || isStaff).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )
              }
              title={item.label}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {modelStatus && (
            <div
              className={cn(
                "mb-2 rounded-lg px-2 py-1.5 text-[11px]",
                modelStatus.is_ready
                  ? "bg-success-500/10 text-success-600 dark:text-success-500"
                  : "bg-warning-500/10 text-warning-600",
              )}
              title={modelStatus.artifact}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {sidebarOpen
                ? modelStatus.is_ready
                  ? `Model ${modelStatus.version}`
                  : "Model not trained"
                : ""}
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              {(displayName ?? "?").slice(0, 1).toUpperCase()}
            </span>
            {sidebarOpen && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{displayName}</span>
                <span className="block truncate text-[10px] text-slate-400">
                  {me?.role_display ?? me?.role}
                </span>
              </span>
            )}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={toggleSidebar} className="btn-ghost px-2 py-1" aria-label="Toggle sidebar">
            ☰
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
            {NAV.find((n) => n.to === location.pathname)?.label ?? "SmartDesk AI"}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost px-3 py-1"
            aria-label="Toggle theme"
            title="Toggle dark/light mode"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="btn-ghost px-3 py-1 text-sm"
          >
            Sign out
          </button>
        </header>

        <main className="thin-scroll flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
