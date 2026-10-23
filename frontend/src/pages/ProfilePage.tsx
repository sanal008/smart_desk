import { useState, type FormEvent } from "react";

import { Card, CardBody, CardHeader, Skeleton, Spinner } from "@/components/ui/Card";
import { useMe } from "@/hooks/useAuth";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import type { User } from "@/api/types";

function AccountForm({ me }: { me: User }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    first_name: me.first_name,
    last_name: me.last_name,
    email: me.email,
    title: me.title,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api<User>("/api/auth/me/", { method: "PATCH", body: form });
      setUser(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">First name</span>
        <input
          className="input"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Last name</span>
        <input
          className="input"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Job title</span>
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner /> : "Save changes"}
        </button>
        {saved && <span className="text-sm text-success-600 dark:text-success-500">Saved.</span>}
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Profile &amp; preferences</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your role decides which parts of SmartDesk you can access.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Account"
          subtitle={isLoading || !me ? "Loading…" : `Role: ${me.role_display ?? me.role}`}
        />
        <CardBody>{isLoading || !me ? <Skeleton className="h-40" /> : <AccountForm me={me} />}</CardBody>
      </Card>

      <Card>
        <CardHeader title="Preferences" />
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Appearance</div>
            <div className="text-xs text-slate-500">Currently {theme} mode</div>
          </div>
          <button type="button" className="btn-ghost" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"}
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Session" />
        <CardBody className="flex items-center justify-between">
          <div className="text-sm">
            Customer tier: <strong className="capitalize">{me?.tier}</strong>
            <p className="mt-1 text-xs text-slate-500">
              Tier feeds the priority model — enterprise tickets are routed with elevated urgency.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
