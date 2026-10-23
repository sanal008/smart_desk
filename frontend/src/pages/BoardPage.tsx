import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

import { PriorityBadge, SentimentBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui/Card";
import { useBoard, useMoveTicket } from "@/hooks/useTickets";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TicketListItem, TicketStatus } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

const COLUMNS: { status: TicketStatus; label: string; accent: string }[] = [
  { status: "NEW", label: "New", accent: "bg-brand-500" },
  { status: "TRIAGED", label: "Triaged", accent: "bg-purple-500" },
  { status: "IN_PROGRESS", label: "In Progress", accent: "bg-warning-500" },
  { status: "WAITING_CUSTOMER", label: "Waiting", accent: "bg-cyan-500" },
  { status: "RESOLVED", label: "Resolved", accent: "bg-success-500" },
  { status: "CLOSED", label: "Closed", accent: "bg-slate-400" },
];

function TicketCard({
  ticket,
  dragging,
  overlay,
}: {
  ticket: TicketListItem;
  dragging?: boolean;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm transition dark:bg-slate-900",
        overlay
          ? "rotate-2 border-brand-400 shadow-xl ring-2 ring-brand-500/30"
          : "border-slate-200 hover:border-brand-300 dark:border-slate-800",
        dragging && "opacity-40",
        ticket.is_sla_breached && "border-l-2 border-l-danger-500",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-slate-400">{ticket.number}</span>
        <PriorityBadge priority={ticket.priority} aiSuggested={ticket.is_priority_ai_suggested} />
      </div>
      <Link
        to={`/tickets/${ticket.id}`}
        className="mt-1.5 block text-sm font-medium leading-snug text-slate-800 hover:text-brand-600 dark:text-slate-100"
        draggable={false}
      >
        {ticket.title}
      </Link>
      {ticket.ai_summary && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          <span title={`AI confidence ${Math.round(ticket.ai_summary.confidence * 100)}%`}>✦</span>{" "}
          {ticket.ai_summary.text}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {ticket.category_name && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {ticket.category_name}
          </span>
        )}
        <SentimentBadge sentiment={ticket.sentiment} />
        {ticket.assignee_username ? (
          <span className="ml-auto text-[11px] text-slate-400">@{ticket.assignee_username}</span>
        ) : (
          <span className="ml-auto text-[11px] font-medium text-warning-600">unassigned</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>{timeAgo(ticket.created_at)}</span>
        {ticket.is_sla_breached && <span className="font-semibold text-danger-500">SLA BREACH</span>}
      </div>
    </div>
  );
}

function DraggableTicket({ ticket }: { ticket: TicketListItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket, status: ticket.status },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
      <TicketCard ticket={ticket} dragging={isDragging} />
    </div>
  );
}

function Column({
  status,
  label,
  accent,
  tickets,
  canDrag,
}: {
  status: TicketStatus;
  label: string;
  accent: string;
  tickets: TicketListItem[];
  canDrag: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 rounded-full", accent)} />
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {tickets.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "thin-scroll flex-1 space-y-2 overflow-y-auto rounded-xl border border-dashed p-2 transition-colors",
          isOver
            ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/20"
            : "border-transparent bg-slate-100/60 dark:bg-slate-900/60",
        )}
      >
        {tickets.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-slate-400">Drop tickets here</div>
        ) : (
          tickets.map((t) =>
            canDrag ? (
              <DraggableTicket key={t.id} ticket={t} />
            ) : (
              <TicketCard key={t.id} ticket={t} />
            ),
          )
        )}
      </div>
    </div>
  );
}

export function BoardPage() {
  const { data, isLoading, error, refetch } = useBoard();
  const move = useMoveTicket();
  const user = useAuthStore((s) => s.user);
  const canDrag = user?.role !== "CUSTOMER";
  const [activeTicket, setActiveTicket] = useState<TicketListItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => data?.columns ?? ({} as Record<TicketStatus, TicketListItem[]>), [data]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveTicket((event.active.data.current?.ticket as TicketListItem) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const ticket = event.active.data.current?.ticket as TicketListItem | undefined;
    const overId = event.over?.id as TicketStatus | undefined;
    setActiveTicket(null);
    if (!ticket || !overId || overId === ticket.status) return;
    move.mutate({ id: ticket.id, status: overId });
  };

  if (error) return <ErrorBanner message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kanban board</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Drag cards between columns to change status — updates are optimistic and sync every 10s.
          </p>
        </div>
        {move.isError && (
          <span className="rounded-lg bg-danger-500/10 px-3 py-1.5 text-sm text-danger-600 dark:text-danger-500">
            Move failed: {move.error.message}
          </span>
        )}
      </div>

      {isLoading && !data ? (
        <div className="flex gap-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.status} className="h-96 w-72" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="thin-scroll flex flex-1 gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                label={col.label}
                accent={col.accent}
                tickets={grouped[col.status] ?? []}
                canDrag={canDrag}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTicket ? <TicketCard ticket={activeTicket} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {!isLoading && data && data.total === 0 && (
        <EmptyState
          title="No tickets yet"
          description="Create the first ticket to see the AI triage loop in action."
          action={
            <Link to="/tickets/new" className="btn-primary">
              New ticket
            </Link>
          }
        />
      )}
    </div>
  );
}
