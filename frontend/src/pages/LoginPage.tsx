import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useLogin } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Card";

const DEMO_ACCOUNTS = [
  { username: "admin", role: "Admin — full access, model monitoring" },
  { username: "maya", role: "Team lead — engineering board + analytics" },
  { username: "nina", role: "Agent — finance tickets + AI panel" },
  { username: "acme", role: "Customer — enterprise tier, own tickets" },
];

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate(from, { replace: true }) },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-600 p-8 text-white md:flex">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 font-bold">
                S
              </span>
              <span className="text-lg font-semibold">SmartDesk AI</span>
            </div>
            <h1 className="mt-10 text-2xl font-semibold leading-snug">
              Explainable AI triage for support teams
            </h1>
            <p className="mt-3 text-sm text-brand-100">
              Tickets are classified, prioritised, routed and summarised the moment they arrive —
              with every prediction explained, and every human override captured as training signal.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-brand-100">
            <li>✦ Category, priority &amp; sentiment prediction</li>
            <li>✦ SLA-aware dashboards and Kanban board</li>
            <li>✦ Retrieval-based reply drafts with agent review</li>
          </ul>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 p-8">
          <div>
            <h2 className="text-xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use a demo account below (password: <code className="font-mono">smartdesk123</code>)
            </p>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Username</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="e.g. maya"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </label>

          {login.isError && (
            <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600 dark:text-danger-500">
              {login.error.message || "Sign in failed."}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={login.isPending}>
            {login.isPending ? <Spinner /> : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-500">
            No account?{" "}
            <Link to="/register" className="font-medium text-brand-600 hover:underline">
              Create one
            </Link>
          </p>

          <div className="mt-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Demo accounts
            </p>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.username}
                  type="button"
                  onClick={() => {
                    setUsername(acct.username);
                    setPassword("smartdesk123");
                  }}
                  className="flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-mono font-medium">{acct.username}</span>
                  <span className="text-slate-400">{acct.role}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
