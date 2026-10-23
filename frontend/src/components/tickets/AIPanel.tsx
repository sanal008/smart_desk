import { useState } from "react";

import type { MLPrediction, SimilarCase, TicketDetail } from "@/api/types";
import { ConfidenceBar, Spinner } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useRerunTriage, useSimilarCases, useSubmitFeedback, useSuggestReply } from "@/hooks/useAI";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";

const TASK_ORDER = ["category", "priority", "team", "sentiment", "summary", "agent"];

function taskLabel(task: string) {
  return (
    {
      category: "Category",
      priority: "Priority",
      team: "Team routing",
      sentiment: "Sentiment",
      summary: "Summary",
      agent: "Suggested agent",
      reply: "Reply draft",
    }[task] ?? task
  );
}

function PredictionCard({
  prediction,
  onFeedback,
}: {
  prediction: MLPrediction;
  onFeedback: (p: MLPrediction, accepted: boolean, corrected?: string) => void;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [corrected, setCorrected] = useState(prediction.predicted_label);
  const [note, setNote] = useState("");

  const features = prediction.explanation.top_features ?? [];
  const probabilities = prediction.explanation.probabilities ?? {};
  const shortlist = prediction.explanation.shortlist ?? [];
  const isTextTask = prediction.task === "summary" || prediction.task === "reply";

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          {taskLabel(prediction.task)}
        </span>
        <ConfidenceBar value={prediction.confidence} />
      </div>

      <p className={cn("mt-1.5 text-sm", isTextTask ? "leading-relaxed text-slate-600 dark:text-slate-300" : "font-medium")}>
        {prediction.task === "priority" ? prediction.predicted_label.toUpperCase() : prediction.predicted_label}
      </p>

      {features.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Top contributing features
          </div>
          <div className="flex flex-wrap gap-1">
            {features.map((f) => (
              <span
                key={f.feature}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                title={`+${f.weight}`}
              >
                {f.feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(probabilities).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(probabilities)
            .slice(0, 3)
            .map(([label, p]) => (
              <div key={label} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 truncate capitalize text-slate-500">{label}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-brand-500" style={{ width: `${p * 100}%` }} />
                </div>
                <span className="w-9 text-right tabular-nums text-slate-400">{Math.round(p * 100)}%</span>
              </div>
            ))}
        </div>
      )}

      {shortlist.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {prediction.explanation.reasoning}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span className="font-mono">{prediction.model_version}</span>
        <span>·</span>
        <span>human feedback:</span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 font-medium text-success-600 hover:bg-success-500/10"
          onClick={() => onFeedback(prediction, true)}
          title="Mark this prediction as correct"
        >
          ✓ accept
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 font-medium text-danger-600 hover:bg-danger-500/10"
          onClick={() => setCorrecting(true)}
          title="Override with the correct label"
        >
          ✎ correct
        </button>
      </div>

      <Modal
        open={correcting}
        onClose={() => setCorrecting(false)}
        title={`Correct ${taskLabel(prediction.task).toLowerCase()} prediction`}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCorrecting(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onFeedback(prediction, false, corrected);
                setCorrecting(false);
              }}
            >
              Save correction
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          The AI said <strong>{prediction.predicted_label}</strong> with{" "}
          {Math.round(prediction.confidence * 100)}% confidence. Overrides are logged in the audit
          trail and used for model monitoring.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Correct label</span>
          <input className="input" value={corrected} onChange={(e) => setCorrected(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Note (optional)</span>
          <textarea
            className="input min-h-20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why was the prediction wrong?"
          />
        </label>
      </Modal>
    </div>
  );
}

function ReplyDraftSection({ ticket }: { ticket: TicketDetail }) {
  const suggest = useSuggestReply(ticket.id);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-dashed border-brand-300 p-3 dark:border-brand-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
          ✦ Reply assistant
        </span>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={suggest.isPending}
          onClick={() => suggest.mutate(false, { onSuccess: (d) => setDraft(d.draft.predicted_label) })}
        >
          {suggest.isPending ? <Spinner /> : "Generate draft"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Retrieval-based draft built from the most similar resolved case. Always review before sending.
      </p>

      {draft && (
        <>
          <textarea
            className="input mt-3 min-h-44 font-mono text-xs leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => suggest.mutate(true, { onSuccess: () => setDraft(null) })}
            >
              Save as internal draft comment
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SimilarCases({ ticketId }: { ticketId: string }) {
  const { data } = useSimilarCases(ticketId);
  const cases: SimilarCase[] = data?.cases ?? [];
  if (cases.length === 0) return null;

  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        Similar resolved cases
      </h3>
      <ul className="mt-2 space-y-2">
        {cases.map((c, i) => (
          <li key={i} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{c.subject}</span>
              <span className="shrink-0 text-[10px] text-slate-400">
                {Math.round(c.similarity * 100)}% match
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {c.resolution_note}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIPanel({ ticket }: { ticket: TicketDetail }) {
  const submitFeedback = useSubmitFeedback();
  const rerun = useRerunTriage(ticket.id);
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role !== "CUSTOMER";

  const predictions = [...ticket.predictions].sort(
    (a, b) => TASK_ORDER.indexOf(a.task) - TASK_ORDER.indexOf(b.task),
  );
  const mainPredictions = predictions.filter((p) => p.task !== "reply");

  const handleFeedback = (p: MLPrediction, accepted: boolean, corrected?: string) => {
    submitFeedback.mutate({
      prediction_id: p.id,
      accepted,
      corrected_label: accepted ? undefined : (corrected ?? p.predicted_label),
    });
  };

  return (
    <aside className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">✦ AI triage</h2>
          {isStaff && (
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={rerun.isPending}
              onClick={() => rerun.mutate()}
            >
              {rerun.isPending ? <Spinner /> : "Re-run"}
            </button>
          )}
        </div>

        {mainPredictions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No predictions on this ticket yet.
            {isStaff && " Hit ‘Re-run’ to triage it now."}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {mainPredictions.map((p) => (
              <PredictionCard key={`${p.task}-${p.id}`} prediction={p} onFeedback={handleFeedback} />
            ))}
          </div>
        )}

        {submitFeedback.isSuccess && (
          <p className="mt-3 rounded-lg bg-success-500/10 px-3 py-2 text-xs text-success-600 dark:text-success-500">
            Feedback recorded — thank you. This improves model monitoring.
          </p>
        )}
      </div>

      {isStaff && <ReplyDraftSection ticket={ticket} />}

      <div className="card p-4">
        <SimilarCases ticketId={ticket.id} />
      </div>
    </aside>
  );
}
