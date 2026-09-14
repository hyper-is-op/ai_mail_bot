export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

export function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem('user');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // If a legacy session stored a numeric or non-string client_id, evict it
    if (parsed.client_id !== undefined && parsed.client_id !== null && typeof parsed.client_id !== 'string') {
      localStorage.removeItem('user');
      return {};
    }
    const { token } = parsed;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function handleAuthFailure(res: Response) {
  if (res.status === 401) {
    localStorage.removeItem('user');
    // Only redirect if not already on the login page to prevent wiping form state/error messages
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

export async function safeJson(res: Response, defaultError = 'Request failed'): Promise<any> {
  await handleAuthFailure(res);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(`Backend server is currently restarting or unreachable (Status ${res.status}). Please try again in a moment.`);
      }
      throw new Error(text || `${defaultError} (Status ${res.status})`);
    }
    return {};
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`Backend server is currently restarting or unreachable (Status ${res.status}). Please try again in a moment.`);
    }
    throw new Error(data?.detail || data?.message || data?.error || `${defaultError} (Status ${res.status})`);
  }
  return data !== null ? data : {};
}

export const coreApi = {
  async health() {
    const res = await fetch(`${BASE_URL}/`);
    return safeJson(res, 'Health check failed');
  },
};
