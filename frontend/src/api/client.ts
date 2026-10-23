import { useAuthStore } from "@/stores/auth";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const { refresh, setTokens, logout } = useAuthStore.getState();
  if (!refresh) return null;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        logout();
        return null;
      }
      const data = (await res.json()) as { access: string };
      setTokens(data.access, refresh);
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
  retry?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, logout } = useAuthStore.getState();
  const headers = new Headers(options.headers);

  if (options.auth !== false && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const res = await fetch(path, { ...options, headers, body });

  if (res.status === 401 && options.auth !== false && options.retry !== false) {
    const token = await tryRefresh();
    if (token) {
      return api<T>(path, { ...options, retry: false });
    }
    logout();
    throw new ApiError(401, { detail: "Session expired" });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : typeof payload === "object" && payload
          ? Object.entries(payload as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
              .join(" | ")
          : undefined;
    throw new ApiError(res.status, payload, message);
  }

  return payload as T;
}

export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
