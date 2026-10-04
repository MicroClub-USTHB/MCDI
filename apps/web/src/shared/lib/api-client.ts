import type { NestErrorBody } from '@mcdi/contracts';
import type { ApiError, ApiResponse } from '@/shared/types';
import { env } from '@/shared/lib/env';
import { useAuthStore } from '@/features/auth/stores/auth';

interface CustomRequestInit extends RequestInit {
  requiresAuth?: boolean;
  /** `text` for an endpoint that answers with a document, not JSON. */
  responseType?: 'json' | 'text';
}

function toErrorCode(error: string | undefined, status: number): string {
  if (error) return error.replace(/\s+/g, '_').toUpperCase();
  return status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR';
}

function toErrorMessage(message: string | string[] | undefined): string {
  if (Array.isArray(message)) return message.join('; ');
  return message || 'An error occurred';
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = env.NEXT_PUBLIC_API_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: CustomRequestInit = {}
  ): Promise<ApiResponse<T>> {
    const { requiresAuth = true, responseType = 'json', ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);

    // Only on requests that actually carry a body — a bare `Content-Type` on
    // a GET buys nothing and turns a simple cross-origin request into a
    // preflighted one.
    if (fetchOptions.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    // The session lives in the backend's `admin_session` httpOnly cookie, set
    // during the Discord OAuth callback. It is issued on the API's origin, so
    // without `credentials: 'include'` the browser drops it from every
    // cross-origin call and every authenticated request 401s.
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    // There is no refresh endpoint for admin sessions — the backend issues a
    // single 24h session token with no refresh counterpart — so a 401 is
    // terminal. Drop local state immediately so `SessionProvider` can surface
    // the expiry and `ProtectedRoute` stops rendering protected content.
    if (response.status === 401 && requiresAuth) {
      useAuthStore.getState().clearAuth();
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as NestErrorBody;
      throw {
        message: toErrorMessage(errorData.message),
        code: toErrorCode(errorData.error, response.status),
        status: response.status,
      } as ApiError;
    }

    // The backend returns resource bodies verbatim — there is no
    // `{ data, message, status }` envelope on the wire. Wrapping here keeps
    // `ApiResponse<T>` as the single shape every caller consumes.
    const data =
      response.status === 204
        ? null
        : responseType === 'text'
          ? await response.text()
          : ((await response.json()) as unknown);

    return { data: data as T, status: response.status };
  }

  async get<T>(endpoint: string, options?: CustomRequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  async getText(endpoint: string, options?: CustomRequestInit): Promise<ApiResponse<string>> {
    return this.request<string>(endpoint, {
      ...options,
      method: 'GET',
      responseType: 'text',
    });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: CustomRequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: CustomRequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: CustomRequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: CustomRequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
export { ApiClient };
