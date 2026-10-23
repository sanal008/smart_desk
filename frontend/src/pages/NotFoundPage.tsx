import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        The route you followed does not exist in SmartDesk.
      </p>
      <Link to="/" className="btn-primary mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}
