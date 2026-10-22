/**
 * API-клієнт (машинерія курсу, генерується). База — `/api`: у dev її проксує Vite, у проді — Caddy.
 * Не імпортує роутер чи auth-екрани (ізоляція для майбутнього віджета).
 */
export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `${init.method ?? 'GET'} ${path} → ${response.status}`,
      body,
    );
  }
  return body as T;
}
