import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api, qs } from "@/api/client";
import type {
  Category,
  Comment,
  PagedResponse,
  TicketDetail,
  TicketListItem,
  TicketStatus,
} from "@/api/types";

export interface TicketFilters {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  team?: string;
  sla_status?: string;
  open_only?: boolean;
  ordering?: string;
  page?: string;
  [key: string]: string | boolean | undefined;
}

const KEY = "tickets";

function listKey(filters: TicketFilters) {
  return [KEY, "list", filters] as const;
}

export function useTickets(
  filters: TicketFilters,
  options: { pollMs?: number; enabled?: boolean } = {},
): UseQueryResult<PagedResponse<TicketListItem>> {
  return useQuery({
    queryKey: listKey(filters),
    queryFn: () => api<PagedResponse<TicketListItem>>(`/api/tickets/${qs(filters)}`),
    refetchInterval: options.pollMs ?? 15_000,
    enabled: options.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

export function useInfiniteTickets(filters: TicketFilters) {
  return useInfiniteQuery({
    queryKey: [...listKey(filters), "infinite"],
    queryFn: ({ pageParam }) =>
      api<PagedResponse<TicketListItem>>(`/api/tickets/${qs({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      if (!last.next) return undefined;
      const url = new URL(last.next, window.location.origin);
      return Number(url.searchParams.get("page") ?? 1);
    },
    refetchInterval: 20_000,
  });
}

export function useTicket(id: string | undefined, pollMs = 10_000) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => api<TicketDetail>(`/api/tickets/${id}/`),
    enabled: !!id,
    refetchInterval: pollMs,
  });
}

export function useBoard(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: [KEY, "board", filters],
    queryFn: () =>
      api<{ columns: Record<TicketStatus, TicketListItem[]>; total: number }>(
        `/api/tickets/board/${qs(filters)}`,
      ),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; description: string; category?: number | null }) =>
      api<TicketDetail>("/api/tickets/", { method: "POST", body: payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Record<string, unknown>>) =>
      api<TicketDetail>(`/api/tickets/${id}/`, { method: "PATCH", body: payload }),
    onSuccess: (data) => {
      qc.setQueryData([KEY, "detail", id], data);
      void qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useMoveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      api<TicketDetail>(`/api/tickets/${id}/status/`, { method: "POST", body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries({ queryKey: ["analytics", "overview"] });
    },
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { assignee?: number | null; team?: number | null }) =>
      api<TicketDetail>(`/api/tickets/${id}/assign/`, { method: "POST", body: payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; is_internal?: boolean }) =>
      api<Comment>(`/api/tickets/${id}/comments/`, { method: "POST", body: payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ results: Category[] }>("/api/categories/"),
    select: (data) => data.results,
    staleTime: 5 * 60_000,
  });
}
