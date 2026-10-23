import { Card, CardBody, CardHeader, ErrorBanner, Skeleton } from "@/components/ui/Card";
import { useModelMetrics } from "@/hooks/useAI";
import { dateTime, pct } from "@/lib/format";
import { cn } from "@/lib/cn";

function MetricsTable({
  title,
  block,
}: {
  title: string;
  block: {
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    weighted_f1: number;
    labels: string[];
    confusion_matrix: number[][];
  };
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`Accuracy ${pct(block.accuracy)} · macro F1 ${pct(block.macro_f1)}`}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Accuracy", block.accuracy],
            ["Precision", block.macro_precision],
            ["Recall", block.macro_recall],
            ["Macro F1", block.macro_f1],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{pct(value as number)}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-1 pr-2 font-medium">actual \ predicted</th>
                {block.labels.map((l) => (
                  <th key={l} className="py-1 px-2 text-center font-medium capitalize">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.confusion_matrix.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-2 font-medium capitalize">{block.labels[i]}</td>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "py-1.5 px-2 text-center tabular-nums",
                        i === j
                          ? "font-semibold text-success-600 dark:text-success-500"
                          : cell > 0
                            ? "text-danger-600 dark:text-danger-500"
                            : "text-slate-300 dark:text-slate-600",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

export function ModelMonitoringPage() {
  const { data, isLoading, error, refetch } = useModelMetrics();

  if (error) return <ErrorBanner message={error.message} onRetry={() => void refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const m = data.static_metrics;
  const fb = data.human_feedback;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Model monitoring</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Offline evaluation from the last training run, plus live human-feedback accuracy from
            agent corrections in the UI.
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium",
            data.is_ready
              ? "bg-success-500/10 text-success-600 dark:text-success-500"
              : "bg-warning-500/10 text-warning-600",
          )}
        >
          {data.is_ready ? `Active: ${data.active_version}` : "Model not trained"}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-[11px] tracking-wide text-slate-400 uppercase">Feedback total</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{fb.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] tracking-wide text-slate-400 uppercase">Accepted as-is</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-success-600 dark:text-success-500">
            {fb.accepted}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] tracking-wide text-slate-400 uppercase">Human overrides</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-danger-600 dark:text-danger-500">
            {fb.corrected}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] tracking-wide text-slate-400 uppercase">Acceptance rate</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {pct(fb.acceptance_rate)}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Feedback by task" subtitle="Where agents override the model most" />
          <CardBody>
            <ul className="space-y-3">
              {fb.per_task.map((t) => (
                <li key={t.task}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{t.task}</span>
                    <span className="text-xs text-slate-400">
                      {t.feedback_count} feedback · {pct(t.acceptance_rate)} accepted
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${Math.round((t.acceptance_rate ?? 0) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
              {fb.per_task.every((t) => t.feedback_count === 0) && (
                <li className="text-sm text-slate-400">
                  No feedback yet — accept or correct a prediction on any ticket to populate this.
                </li>
              )}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Training runs" subtitle="History from `manage.py train_models`" />
          <CardBody>
            {data.recent_runs.length === 0 ? (
              <p className="text-sm text-slate-400">
                No ModelRun records yet — run training via the management command.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recent_runs.map((run) => (
                  <li key={run.version} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-mono text-xs">{run.version}</span>
                    <span className="text-xs text-slate-400">
                      {dateTime(run.trained_at)} · train {run.train_size} / test {run.test_size}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {m.category && <MetricsTable title="Category classifier" block={m.category} />}
      {m.priority && <MetricsTable title="Priority predictor" block={m.priority} />}
      {m.routing && <MetricsTable title="Team routing" block={m.routing} />}

      <Card>
        <CardHeader title="Limitations & retraining" />
        <CardBody className="prose prose-sm max-w-none text-sm text-slate-600 dark:text-slate-300">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Training data is synthetic and template-generated, so offline metrics are optimistic
              versus real support language.
            </li>
            <li>Priority labels come from a rule function; the model learns to imitate it.</li>
            <li>Sentiment uses the VADER lexicon — weak on sarcasm and implicit affect.</li>
            <li>Reply drafting is retrieval-based, not generative, and always requires agent review.</li>
          </ul>
          <p className="mt-3">
            Retrain with <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">python
            manage.py train_models</code>, then hit the reload endpoint (or restart) to pick up new
            artifacts. Agent corrections captured here are the intended source of real labels for
            the next training round.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
