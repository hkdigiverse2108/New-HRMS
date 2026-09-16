/**
 * Common API Client for New-HRMS
 * - Automatically injects JWT Bearer token from localStorage
 * - Global loading indicator control
 * - Unified error handling with toast notifications
 * - Type-safe methods: get, post, put, patch, delete, upload
 */

import { toast } from "sonner";
import { API_URL, getApiUrl } from "./config";

export const TOKEN_STORAGE_KEY = "hrms_auth_token";
export const USER_STORAGE_KEY = "hrms_user";

// Token Helpers
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setAuthToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const removeAuthToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

export const getStoredUser = (): any => {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem(USER_STORAGE_KEY);
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

// Global Loader Listeners
type LoaderListener = (loadingCount: number) => void;
let activeRequestsCount = 0;
const loaderListeners = new Set<LoaderListener>();
const inFlightRequests = new Map<string, Promise<any>>();

export const subscribeLoader = (listener: LoaderListener): (() => void) => {
  loaderListeners.add(listener);
  listener(activeRequestsCount);
  return () => loaderListeners.delete(listener);
};

const notifyLoader = () => {
  loaderListeners.forEach(listener => listener(activeRequestsCount));
};

export interface RequestOptions extends RequestInit {
  showLoader?: boolean;
  showErrorToast?: boolean;
  skipAuth?: boolean;
}

/**
 * Core Request wrapper
 */
async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    showLoader = true,
    showErrorToast = true,
    skipAuth = false,
    headers: customHeaders = {},
    ...rest
  } = options;

  if (showLoader) {
    activeRequestsCount++;
    notifyLoader();
  }

  const token = !skipAuth ? getAuthToken() : null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  };

  // Only set application/json if body is not FormData
  if (!(rest.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Construct proper absolute URL without unnecessary trailing slash before query parameters
  let cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  // Remove any trailing slash before query params: e.g. /employees/?page=1 -> /employees?page=1
  cleanEndpoint = cleanEndpoint.replace(/\/+\?/, "?");
  // Also remove trailing slash if path ends with / and has no query: e.g. /employees/ -> /employees
  if (cleanEndpoint.length > 1 && cleanEndpoint.endsWith("/")) {
    cleanEndpoint = cleanEndpoint.slice(0, -1);
  }
  const baseUrl = getApiUrl() || API_URL;
  const url = `${baseUrl}${cleanEndpoint}`;

  const method = (rest.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const inFlightKey = isGet ? `${url}::${token || ""}` : null;

  if (inFlightKey && inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey) as Promise<T>;
  }

  const execute = async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        headers,
        ...rest,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          typeof errorData.detail === "string"
            ? errorData.detail
            : errorData.message || (Array.isArray(errorData.detail) ? errorData.detail[0]?.msg : null) || `Request failed with status ${response.status}`;

        if (response.status === 401 && !skipAuth) {
          removeAuthToken();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("hrms:unauthorized"));
          }
        }

        if (showErrorToast && response.status !== 401) {
          toast.error(message);
        }

        throw new Error(message);
      }

      if (response.status === 204) {
        return null as T;
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (showErrorToast && !error.message) {
        toast.error("Network error. Please check backend connection.");
      }
      throw error;
    } finally {
      if (inFlightKey) {
        inFlightRequests.delete(inFlightKey);
      }
      if (showLoader) {
        activeRequestsCount = Math.max(0, activeRequestsCount - 1);
        notifyLoader();
      }
    }
  };

  const reqPromise = execute();
  if (inFlightKey) {
    inFlightRequests.set(inFlightKey, reqPromise);
  }
  return reqPromise;
}

function normalizeBody(body?: any): any {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData) return body;
  if (typeof body === "object" && "body" in body && Object.keys(body).length === 1) {
    return normalizeBody(body.body);
  }
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

/**
 * Common REST methods and helpers
 */
export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, { method: "GET", ...options }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, {
      method: "POST",
      body: normalizeBody(body),
      ...options,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, {
      method: "PUT",
      body: normalizeBody(body),
      ...options,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, {
      method: "PATCH",
      body: normalizeBody(body),
      ...options,
    }),

  delete: <T = any>(endpoint: string, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, { method: "DELETE", ...options }),

  /**
   * Common upload method for any folder (e.g., "employee", "department")
   */
  uploadImage: async (file: File, folder: string = "common"): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    return apiRequest<{ url: string; filename: string }>("/images/upload", {
      method: "POST",
      body: formData,
      showLoader: true,
      showErrorToast: true,
    });
  },

  /**
   * Common method to list images by folder for re-use
   */
  listImages: async (folder?: string): Promise<Array<{ filename: string; url: string; folder: string }>> => {
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    const res = await apiRequest<{ data: Array<{ filename: string; url: string; folder: string }> }>(
      `/images/list${query}`,
      { showLoader: false, showErrorToast: false }
    );
    return res.data || [];
  },
};
