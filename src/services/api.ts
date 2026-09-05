export const TOKEN_KEY = 'hs_auth_token';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; total?: number; summary?: any; message?: string; errors?: any }> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error(`API Error on ${endpoint}:`, error);
    return {
      success: false,
      message: error?.message || 'Network error or unable to communicate with server.',
    };
  }
}
