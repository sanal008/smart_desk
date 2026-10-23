import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/api/types";

interface AuthState {
  accessToken: string | null;
  refresh: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (access: string, refresh: string, user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  isStaff: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refresh: null,
      user: null,
      hydrated: false,
      setSession: (access, refresh, user) => set({ accessToken: access, refresh, user }),
      setTokens: (access, refresh) => set({ accessToken: access, refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refresh: null, user: null }),
      isStaff: () => {
        const role = get().user?.role;
        return role === "AGENT" || role === "TEAM_LEAD" || role === "ADMIN";
      },
    }),
    {
      name: "smartdesk-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refresh: state.refresh,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setUser(state.user ?? null);
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
