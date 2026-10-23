import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ConfidenceBar } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Card";
import { usePredictDraft } from "@/hooks/useAI";
import { useCategories, useCreateTicket } from "@/hooks/useTickets";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";

function useDebounced<T>(value: T, delay = 700): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function NewTicketPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [livePreview, setLivePreview] = useState(true);

  const navigate = useNavigate();
  const create = useCreateTicket();
  const predict = usePredictDraft();
  const { data: categories } = useCategories();
  const user = useAuthStore((s) => s.user);

  const combined = useMemo(() => `${title}\n${description}`.trim(), [title, description]);
  const debouncedText = useDebounced(combined);

  useEffect(() => {
    if (!livePreview || debouncedText.length < 25) return;
    predict.mutate({ text: debouncedText, tier: user?.tier });
  }, [debouncedText, livePreview, user?.tier]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        title,
        description,
        category: category ? Number(category) : null,
      },
      { onSuccess: (ticket) => navigate(`/tickets/${ticket.id}`) },
    );
  };

  const draft = predict.data;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">New ticket</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        As you type, the AI triage model previews the category, priority, sentiment and summary it
        will assign. Submit to run the full pipeline and record the predictions.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <form onSubmit={onSubmit} className="card space-y-4 p-5">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              required
              minLength={8}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea
              className="input min-h-40 font-mono text-[13px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                "Describe the problem in detail. Mention urgency keywords, order/invoice numbers,\n" +
                "error messages and business impact — these strongly influence the priority prediction."
              }
              required
              minLength={20}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Category <span className="font-normal text-slate-400">(optional — leave blank to let AI decide)</span>
            </span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Let AI categorise</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {create.isError && (
            <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600 dark:text-danger-500">
              {create.error.message}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : "Submit ticket"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
        <aside className="card h-fit p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">✦ Live AI preview</h2>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={livePreview}
                onChange={(e) => setLivePreview(e.target.checked)}
              />
              Auto
            </label>
          </div>

          {predict.isPending && (
            <div className="mt-4 space-y-2">
              <Spinner /> <span className="text-sm text-slate-500">Analysing…</span>
            </div>
          )}

          {predict.isError && (
            <p className="mt-4 text-sm text-danger-600 dark:text-danger-500">
              {predict.error.message}
            </p>
          )}

          {!draft && !predict.isPending && (
            <p className="mt-4 text-sm text-slate-400">
              Start typing (at least ~25 characters) to see predictions appear here.
            </p>
          )}

          {draft && (
            <div className="mt-4 space-y-4">
              <PreviewRow label="Category" value={draft.category.label} confidence={draft.category.confidence} />
              <PreviewRow label="Priority" value={draft.priority.label.toUpperCase()} confidence={draft.priority.confidence} />
              <PreviewRow label="Team" value={draft.team.label} confidence={draft.team.confidence} />
              <PreviewRow label="Sentiment" value={draft.sentiment.label} confidence={draft.sentiment.confidence} />

              <div>
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  Draft summary
                </div>
                <p className="rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {draft.summary.label}
                </p>
              </div>

              {Array.isArray(draft.category.explanation.top_features) &&
                draft.category.explanation.top_features.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      Why this category
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {draft.category.explanation.top_features.map((f) => (
                        <span
                          key={f.feature}
                          className={cn(
                            "rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
                          )}
                          title={`contribution +${f.weight}`}
                        >
                          {f.feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              <p className="text-[10px] text-slate-400">Model {draft.model_version}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string;
  confidence: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-xs font-semibold capitalize">{value}</span>
        <ConfidenceBar value={confidence} />
      </span>
    </div>
  );
}
