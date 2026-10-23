import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRegister } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Card";

export function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    tier: "standard",
  });
  const register = useRegister();
  const navigate = useNavigate();

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(form, { onSuccess: () => navigate("/", { replace: true }) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          New accounts start as customers. Ask an admin for an agent role.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">First name</span>
            <input className="input" value={form.first_name} onChange={set("first_name")} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Last name</span>
            <input className="input" value={form.last_name} onChange={set("last_name")} required />
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Username</span>
          <input className="input" value={form.username} onChange={set("username")} required />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input className="input" type="email" value={form.email} onChange={set("email")} required />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Plan tier</span>
          <select className="input" value={form.tier} onChange={set("tier")}>
            <option value="free">Free — lowest routing priority</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise — priority routing</option>
          </select>
        </label>

        {register.isError && (
          <p className="mt-4 rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600 dark:text-danger-500">
            {register.error.message}
          </p>
        )}

        <button type="submit" className="btn-primary mt-6 w-full" disabled={register.isPending}>
          {register.isPending ? <Spinner /> : "Create account"}
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
