import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type {
  AgentWorkload,
  CategoryTrendPoint,
  ModelMetricsPayload,
  OverviewAnalytics,
  SimilarCase,
  VolumePoint,
  DraftPrediction,
  MLPrediction,
  TicketDetail,
} from "@/api/types";

export function useOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => api<OverviewAnalytics>("/api/analytics/overview/"),
    refetchInterval: 30_000,
  });
}

export function useVolume(days = 30) {
  return useQuery({
    queryKey: ["analytics", "volume", days],
    queryFn: () => api<{ days: number; series: VolumePoint[] }>(`/api/analytics/volume/?days=${days}`),
    refetchInterval: 60_000,
  });
}

export function useAgentWorkload() {
  return useQuery({
    queryKey: ["analytics", "workload"],
    queryFn: () => api<{ agents: AgentWorkload[] }>("/api/analytics/agent-workload/"),
    refetchInterval: 30_000,
  });
}

export function useCategoryTrends(days = 30) {
  return useQuery({
    queryKey: ["analytics", "trends", days],
    queryFn: () =>
      api<{ days: number; series: Record<string, CategoryTrendPoint[]> }>(
        `/api/analytics/category-trends/?days=${days}`,
      ),
    refetchInterval: 60_000,
  });
}

export function useSla() {
  return useQuery({
    queryKey: ["analytics", "sla"],
    queryFn: () =>
      api<{
        breached: TicketDetail[];
        at_risk: TicketDetail[];
        counts: { breached: number; at_risk: number };
      }>("/api/analytics/sla/"),
    refetchInterval: 20_000,
  });
}

export function useModelStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: () =>
      api<{ is_ready: boolean; version: string | null; artifact: string }>("/api/ai/status/"),
    staleTime: 5 * 60_000,
  });
}

export function useModelMetrics() {
  return useQuery({
    queryKey: ["ai", "metrics"],
    queryFn: () => api<ModelMetricsPayload>("/api/ai/metrics/"),
    refetchInterval: 60_000,
  });
}

export function usePredictDraft() {
  return useMutation({
    mutationFn: ({ text, tier }: { text: string; tier?: string }) =>
      api<DraftPrediction>("/api/ai/predict-draft/", {
        method: "POST",
        body: { text, tier: tier ?? "standard" },
      }),
  });
}

export function useRerunTriage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ status: string; results: Record<string, unknown> }>(
        `/api/ai/tickets/${ticketId}/triage/`,
        { method: "POST", body: {} },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tickets", "detail", ticketId] });
    },
  });
}

export function useSuggestReply(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (saveAsDraft: boolean) =>
      api<{ draft: MLPrediction; saved_comment_id?: number }>(
        `/api/ai/tickets/${ticketId}/suggest-reply/`,
        { method: "POST", body: { save_as_draft: saveAsDraft } },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tickets", "detail", ticketId] });
    },
  });
}

export function useSimilarCases(ticketId: string) {
  return useQuery({
    queryKey: ["ai", "similar", ticketId],
    queryFn: () => api<{ cases: SimilarCase[] }>(`/api/ai/tickets/${ticketId}/similar/`),
    enabled: !!ticketId,
    staleTime: 5 * 60_000,
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      prediction_id: number;
      accepted: boolean;
      corrected_label?: string;
      note?: string;
    }) => api("/api/ai/feedback/", { method: "POST", body: payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
