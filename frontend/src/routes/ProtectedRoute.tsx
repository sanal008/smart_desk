import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/auth";
import type { Role } from "@/api/types";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="card p-8">
          <div className="text-3xl">⛔</div>
          <h1 className="mt-3 text-lg font-semibold">Access restricted</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This area is limited to{" "}
            {roles.map((r) => r.replace("_", " ").toLowerCase()).join(", ")} roles. You are signed
            in as <strong>{user.role.replace("_", " ").toLowerCase()}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
