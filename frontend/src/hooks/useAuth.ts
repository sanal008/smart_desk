import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Team, User } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

interface RegisterResponse extends LoginResponse {}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api<LoginResponse>("/api/auth/login/", {
        method: "POST",
        body: { username, password },
        auth: false,
      }),
    onSuccess: (data) => setSession(data.access, data.refresh, data.user),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<RegisterResponse>("/api/auth/register/", { method: "POST", body: payload, auth: false }),
    onSuccess: (data) => setSession(data.access, data.refresh, data.user),
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const refresh = useAuthStore((s) => s.refresh);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/api/auth/logout/", { method: "POST", body: { refresh } }),
    onSettled: () => {
      logout();
      qc.clear();
    },
  });
}

export function useMe() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/auth/me/"),
    enabled: !!user,
    staleTime: 60_000,
    select: (data) => {
      if (JSON.stringify(data) !== JSON.stringify(useAuthStore.getState().user)) {
        setUser(data);
      }
      return data;
    },
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => api<{ results: Team[] }>("/api/auth/teams/"),
    select: (data) => data.results,
    staleTime: 5 * 60_000,
  });
}

export function useStaffUsers() {
  return useQuery({
    queryKey: ["users", "staff"],
    queryFn: () => api<{ results: User[] }>("/api/auth/users/"),
    select: (data) =>
      data.results.filter((u) => u.role === "AGENT" || u.role === "TEAM_LEAD"),
    staleTime: 5 * 60_000,
  });
}
