export const TOKEN_KEY = 'hs_auth_token';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; total?: number; summary?: any; message?: string; errors?: any; [key: string]: any }> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resolvedUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(resolvedUrl, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        success: false,
        message: res.ok ? 'Unexpected response from server.' : 'Unable to connect to the server. Please try again.',
      };
    }
    return data;
  } catch (error: any) {
    console.error(`API Error on ${endpoint}:`, error);
    return {
      success: false,
      message: 'Unable to connect to the server. Please try again.',
    };
  }
}
