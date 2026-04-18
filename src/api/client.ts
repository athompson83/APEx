import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BubbleListResponse } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_BUBBLE_API_URL ?? '';
const TOKEN_KEY = 'apex_auth_token';
const MAX_RETRIES = 3;
const IS_DEV = process.env.NODE_ENV === 'development' || __DEV__;

// ─── Navigation callback ──────────────────────────────────────────────────────
// Injected at app startup to avoid circular dependency with navigation.
let _redirectToLogin: (() => void) | null = null;

export function setRedirectToLogin(fn: () => void): void {
  _redirectToLogin = fn;
}

// ─── Retry state ──────────────────────────────────────────────────────────────
// Attached as a non-enumerable property on the config to track retries.
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: AxiosError): boolean {
  if (!error.response) {
    // Network error / timeout
    return true;
  }
  const status = error.response.status;
  return status >= 500 && status < 600;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request interceptor ──────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: RetryConfig) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers = config.headers ?? {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // SecureStore unavailable (e.g. simulator without keychain); proceed without token
    }

    if (IS_DEV) {
      console.log(
        `[APEx] --> ${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`,
        config.params ? { params: config.params } : '',
        config.data ? { body: config.data } : '',
      );
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ─── Response interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (IS_DEV) {
      console.log(
        `[APEx] <-- ${response.status} ${response.config.url ?? ''}`,
        response.data,
      );
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    // ── 401: clear token and redirect ─────────────────────────────────────────
    if (error.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } catch {
        // ignore
      }
      _redirectToLogin?.();
      return Promise.reject(
        new APIError('Session expired. Please log in again.', 401, error),
      );
    }

    // ── Retry logic ───────────────────────────────────────────────────────────
    if (config && isRetryable(error)) {
      const retryCount = config._retryCount ?? 0;
      if (retryCount < MAX_RETRIES) {
        config._retryCount = retryCount + 1;
        const backoffMs = Math.min(1000 * 2 ** retryCount, 10_000);
        if (IS_DEV) {
          console.log(
            `[APEx] Retrying request (attempt ${config._retryCount}/${MAX_RETRIES}) after ${backoffMs}ms`,
          );
        }
        await sleep(backoffMs);
        return apiClient(config);
      }
    }

    // ── Normalize error ───────────────────────────────────────────────────────
    if (IS_DEV) {
      console.error(
        `[APEx] <-- ERROR ${error.response?.status ?? 'NETWORK'} ${config?.url ?? ''}`,
        error.message,
        error.response?.data,
      );
    }

    if (!error.response) {
      return Promise.reject(
        new APIError(
          'Network error. Please check your connection.',
          0,
          error,
        ),
      );
    }

    const status = error.response.status;
    const serverMessage =
      (error.response.data as { message?: string } | undefined)?.message ??
      `Request failed with status ${status}`;

    return Promise.reject(new APIError(serverMessage, status, error));
  },
);

// ─── Custom error class ───────────────────────────────────────────────────────

export class APIError extends Error {
  readonly status: number;
  readonly originalError: AxiosError;

  constructor(message: string, status: number, originalError: AxiosError) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.originalError = originalError;
    Object.setPrototypeOf(this, APIError.prototype);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// ─── Bubble response envelope normalizers ─────────────────────────────────────

/**
 * Normalizes a Bubble list response:
 * `{ response: { results: T[], count: N, remaining: N } }` → `BubbleListResponse<T>`
 */
export function normalizeBubbleList<T>(
  responseData: unknown,
): BubbleListResponse<T> {
  const data = responseData as {
    response?: { results?: T[]; count?: number; remaining?: number };
  };
  const inner = data?.response ?? {};
  return {
    results: inner.results ?? [],
    count: inner.count ?? 0,
    remaining: inner.remaining ?? 0,
  };
}

/**
 * Normalizes a Bubble single-object response:
 * `{ response: T }` → `T`
 */
export function normalizeBubbleSingle<T>(responseData: unknown): T {
  const data = responseData as { response?: T };
  if (!data?.response) {
    throw new Error('Unexpected Bubble response shape: missing response key');
  }
  return data.response;
}

// ─── Typed helper functions ───────────────────────────────────────────────────

export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

export async function patch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.patch<T>(url, data, config);
  return response.data;
}

export async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}
