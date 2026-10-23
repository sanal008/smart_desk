import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { AIPanel } from "@/components/tickets/AIPanel";
import { PriorityBadge, SentimentBadge, StatusBadge } from "@/components/ui/Badge";
import { ErrorBanner, Skeleton, Spinner } from "@/components/ui/Card";
import { useAddComment, useAssignTicket, useTicket, useUpdateTicket } from "@/hooks/useTickets";
import { useStaffUsers } from "@/hooks/useAuth";
import { dateTime, isOverdue, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";
import type { TicketStatus } from "@/api/types";

const NEXT_STATUS: Partial<Record<TicketStatus, { status: TicketStatus; label: string }[]>> = {
  NEW: [
    { status: "TRIAGED", label: "Mark triaged" },
    { status: "IN_PROGRESS", label: "Start progress" },
  ],
  TRIAGED: [
    { status: "IN_PROGRESS", label: "Start progress" },
    { status: "WAITING_CUSTOMER", label: "Waiting on customer" },
  ],
  IN_PROGRESS: [
    { status: "WAITING_CUSTOMER", label: "Waiting on customer" },
    { status: "RESOLVED", label: "Resolve" },
  ],
  WAITING_CUSTOMER: [
    { status: "IN_PROGRESS", label: "Resume work" },
    { status: "RESOLVED", label: "Resolve" },
  ],
  RESOLVED: [
    { status: "CLOSED", label: "Close" },
    { status: "IN_PROGRESS", label: "Reopen" },
  ],
  CLOSED: [{ status: "IN_PROGRESS", label: "Reopen" }],
};

function ActivityIcon({ action, isAi }: { action: string; isAi: boolean }) {
  const glyph = isAi
    ? "✦"
    : action === "COMMENTED"
      ? "💬"
      : action === "ASSIGNED"
        ? "→"
        : action === "FEEDBACK"
          ? "⚖"
          : "·";
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
        isAi ? "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" : "bg-slate-100 dark:bg-slate-800",
      )}
    >
      {glyph}
    </span>
  );
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading, error, refetch } = useTicket(id);
  const update = useUpdateTicket(id ?? "");
  const assign = useAssignTicket(id ?? "");
  const addComment = useAddComment(id ?? "");
  const { data: staff } = useStaffUsers();
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role !== "CUSTOMER";

  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);

  if (error) return <ErrorBanner message={error.message} onRetry={() => void refetch()} />;
  if (isLoading || !ticket) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate(
      { body: comment, is_internal: internal },
      { onSuccess: () => setComment("") },
    );
  };

  const slaBreached = ticket.sla.is_breached;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Link to="/tickets" className="hover:text-brand-600">
            Tickets
          </Link>
          <span>/</span>
          <span className="font-mono">{ticket.number}</span>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug">{ticket.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} aiSuggested={ticket.is_priority_ai_suggested} />
                <SentimentBadge sentiment={ticket.sentiment} />
                {ticket.category_name && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {ticket.category_name}
                  </span>
                )}
                {ticket.team_name && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {ticket.team_name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Opened {timeAgo(ticket.created_at)} by @{ticket.requester_username}</div>
              {ticket.requester_detail.tier === "enterprise" && (
                <div className="mt-1 font-medium text-brand-600">Enterprise customer</div>
              )}
            </div>
          </div>
          <div
            className={cn(
              "mt-4 flex flex-wrap gap-4 rounded-lg px-3 py-2 text-xs",
              slaBreached
                ? "bg-danger-500/10 text-danger-600 dark:text-danger-500"
                : ticket.sla.is_first_response_breached
                  ? "bg-warning-500/10 text-warning-600"
                  : "bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
            )}
          >
            <span>
              Resolution due:{" "}
              <strong>{ticket.sla.due_at ? dateTime(ticket.sla.due_at) : "—"}</strong>
              {slaBreached && " — BREACHED"}
              {!slaBreached && isOverdue(ticket.sla.due_at) === false && ticket.sla.due_at && (
                <> ({timeAgo(ticket.sla.due_at)})</>
              )}
            </span>
            <span>
              First response due:{" "}
              <strong>
                {ticket.sla.first_response_due_at ? dateTime(ticket.sla.first_response_due_at) : "—"}
              </strong>
              {ticket.sla.is_first_response_breached && !ticket.first_response_at && " — BREACHED"}
            </span>
            {ticket.first_response_at && <span>First response: {timeAgo(ticket.first_response_at)}</span>}
            {ticket.resolved_at && <span>Resolved: {timeAgo(ticket.resolved_at)}</span>}
          </div>
          {isStaff && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <select
                className="input w-auto"
                value={ticket.assignee ?? ""}
                onChange={(e) =>
                  assign.mutate({ assignee: e.target.value ? Number(e.target.value) : null })
                }
                aria-label="Assign to"
              >
                <option value="">Unassigned</option>
                {(staff ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name ? `${a.first_name} ${a.last_name}` : a.username} ({a.team_name ?? "no team"})
                  </option>
                ))}
              </select>

              {(NEXT_STATUS[ticket.status] ?? []).map((opt) => (
                <button
                  key={opt.status}
                  type="button"
                  className={opt.status === "RESOLVED" ? "btn-primary" : "btn-ghost"}
                  disabled={update.isPending}
                  onClick={() => update.mutate({ status: opt.status })}
                >
                  {opt.label}
                </button>
              ))}

              <select
                className="input ml-auto w-auto"
                value={ticket.priority}
                onChange={(e) => update.mutate({ priority: e.target.value })}
                aria-label="Change priority"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p}>
                    Priority: {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Description</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          {ticket.attachments.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Attachments</h3>
              <ul className="mt-2 space-y-1">
                {ticket.attachments.map((a) => (
                  <li key={a.id} className="text-sm">
                    <a
                      href={a.url ?? "#"}
                      className="text-brand-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.original_name}
                    </a>{" "}
                    <span className="text-xs text-slate-400">
                      ({Math.round(a.size / 1024)} KB · @{a.uploaded_by_username})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Conversation ({ticket.comments.filter((c) => isStaff || !c.is_internal).length})
          </h2>
          <ul className="mt-3 space-y-3">
            {ticket.comments
              .filter((c) => isStaff || !c.is_internal)
              .map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-lg border p-3",
                    c.is_ai_draft
                      ? "border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-900/20"
                      : c.is_internal
                        ? "border-warning-500/30 bg-warning-500/5"
                        : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      @{c.author_username}
                      <span className="ml-2 font-normal text-slate-400">{c.author_role}</span>
                      {c.is_internal && (
                        <span className="ml-2 rounded bg-warning-500/20 px-1 py-0.5 text-[10px] font-semibold text-warning-600">
                          internal
                        </span>
                      )}
                      {c.is_ai_draft && (
                        <span className="ml-2 rounded bg-brand-500/20 px-1 py-0.5 text-[10px] font-semibold text-brand-600">
                          AI draft
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            {ticket.comments.length === 0 && (
              <li className="text-sm text-slate-400">No comments yet.</li>
            )}
          </ul>

          <form onSubmit={submitComment} className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <textarea
              className="input min-h-24"
              placeholder={isStaff ? "Reply to the customer…" : "Add a comment…"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={addComment.isPending || !comment.trim()}>
                {addComment.isPending ? <Spinner /> : "Post comment"}
              </button>
              {isStaff && (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  Internal note (hidden from customer)
                </label>
              )}
            </div>
          </form>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Activity &amp; audit trail
          </h2>
          <ul className="mt-3 space-y-3">
            {ticket.activities.slice(0, 30).map((a) => (
              <li key={a.id} className="flex gap-3">
                <ActivityIcon action={a.action} isAi={a.is_ai_actor} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className={cn(a.is_ai_actor && "text-brand-700 dark:text-brand-300")}>
                    {a.is_ai_actor ? "AI" : a.actor_username ? `@${a.actor_username}` : "System"}
                  </span>{" "}
                  <span className="text-slate-500 dark:text-slate-400">
                    {a.action.toLowerCase().replace("_", " ")}
                    {a.field && <> · {a.field}</>}
                    {a.old_value || a.new_value ? (
                      <>
                        {" "}
                        {a.old_value && <span className="line-through opacity-60">{a.old_value}</span>}
                        {a.old_value && a.new_value && " → "}
                        {a.new_value && <strong>{a.new_value}</strong>}
                      </>
                    ) : null}
                  </span>
                  <div className="text-xs text-slate-400">{dateTime(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <AIPanel ticket={ticket} />
    </div>
  );
}
