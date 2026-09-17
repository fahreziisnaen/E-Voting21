export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(status: number, message: string, code?: string, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.',
  401: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  403: 'Anda tidak memiliki akses untuk tindakan ini.',
  404: 'Data tidak ditemukan.',
  429: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
};
const SERVER_ERROR = 'Terjadi gangguan pada server. Silakan coba beberapa saat lagi.';

/** Pesan yang aman ditampilkan ke pengguna untuk error apa pun. */
export function errorMessage(error: unknown, fallback = SERVER_ERROR): string {
  return error instanceof ApiError ? error.message : fallback;
}

const CSRF_COOKIE = 'ev_csrf';
const NO_REFRESH = new Set(['/auth/login', '/auth/refresh', '/auth/logout', '/auth/csrf']);

function readCookie(name: string): string | undefined {
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

let csrfRequest: Promise<string> | null = null;

async function csrfToken(forceFetch = false): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing && !forceFetch) return existing;
  csrfRequest ??= fetch('/api/auth/csrf', { credentials: 'same-origin' })
    .then((res) => res.json() as Promise<{ csrfToken: string }>)
    .then((body) => body.csrfToken)
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

let refreshRequest: Promise<boolean> | null = null;

/** Satu permintaan refresh untuk banyak request 401 yang datang bersamaan. */
function refreshSession(): Promise<boolean> {
  refreshRequest ??= csrfToken()
    .then((token) =>
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': token } }),
    )
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

/** Mengunduh berkas (mis. CSV) lewat sesi cookie, termasuk refresh token bila perlu. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const request = () => fetch(`/api${path}`, { credentials: 'same-origin' });
  let res: Response;
  try {
    res = await request();
    if (res.status === 401 && (await refreshSession())) res = await request();
  } catch {
    throw new ApiError(0, DEFAULT_MESSAGES[0]!, 'NETWORK_ERROR');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.message ?? DEFAULT_MESSAGES[res.status] ?? SERVER_ERROR, data?.code);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Pesan galat per field dari respons validasi server (path "mission.0" → "mission"). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  const result: Record<string, string> = {};
  for (const detail of error.details) {
    const field = detail.path.split('.')[0] ?? '';
    result[field] ??= detail.message;
  }
  return result;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken();

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      signal,
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, DEFAULT_MESSAGES[0]!, 'NETWORK_ERROR');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!isRetry && res.status === 401 && !NO_REFRESH.has(path) && (await refreshSession())) {
    return api<T>(path, options, true);
  }
  if (!isRetry && res.status === 403 && data?.code === 'CSRF_INVALID') {
    await csrfToken(true);
    return api<T>(path, options, true);
  }
  if (!res.ok) {
    const message = data?.message ?? DEFAULT_MESSAGES[res.status] ?? SERVER_ERROR;
    throw new ApiError(res.status, message, data?.code, data?.details);
  }
  return data as T;
}
