/**
 * API Service for Multi-Project Client Portal
 * Handles intelligent backend URL routing, static hosting detection (GitHub Pages),
 * and safe JSON parsing that never crashes on HTML 404 responses.
 */

export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('github.io') ||
    host.endsWith('pages.dev') ||
    host.endsWith('web.app') ||
    host.endsWith('firebaseapp.com') ||
    host.endsWith('vercel.app') ||
    host.endsWith('netlify.app') ||
    window.location.protocol === 'file:'
  );
}

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem('portal_backend_url');
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

export function setBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    localStorage.removeItem('portal_backend_url');
  } else {
    localStorage.setItem('portal_backend_url', trimmed);
  }
}

export function hasConfiguredBackend(): boolean {
  return Boolean(getBackendUrl());
}

export async function testBackendConnection(url: string): Promise<{ ok: boolean; message: string; version?: string }> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    return { ok: false, message: 'Please enter a valid backend URL.' };
  }

  try {
    const res = await fetch(`${cleanUrl}/api/portal-data`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: `Endpoint returned non-JSON content (${res.status} ${res.statusText}). Verify the server URL.`,
      };
    }

    if (res.ok || res.status === 401) {
      return { ok: true, message: 'Successfully connected to backend server!' };
    }

    return { ok: false, message: `Server responded with HTTP ${res.status}: ${res.statusText}` };
  } catch (err: any) {
    return { ok: false, message: `Connection failed: ${err.message || 'Network error'}` };
  }
}

export async function safeApiFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const backendBase = getBackendUrl();
  let fullUrl = endpoint;

  if (endpoint.startsWith('/api/') && backendBase) {
    fullUrl = `${backendBase}${endpoint}`;
  }

  try {
    const headers = new Headers(options?.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    const status = res.status;
    const contentType = res.headers.get('content-type') || '';

    // If response is HTML or not JSON
    if (!contentType.includes('application/json')) {
      if (isStaticHosting() && !backendBase) {
        return {
          ok: false,
          status,
          error:
            'You are running on GitHub Pages (static hosting). GitHub Pages does not run backend APIs. Use the "Sync & Data" options or configure a Live Backend URL.',
        };
      }
      return {
        ok: false,
        status,
        error: `Server returned non-JSON response (${status} ${res.statusText || 'Error'}).`,
      };
    }

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch (parseErr: any) {
      return {
        ok: false,
        status,
        error: `Failed to parse response JSON: ${parseErr.message}`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status,
        data: parsed,
        error: parsed?.error || parsed?.message || `Request failed with HTTP ${status}`,
      };
    }

    return {
      ok: true,
      status,
      data: parsed as T,
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      error: netErr.message || 'Network connection failed.',
    };
  }
}
