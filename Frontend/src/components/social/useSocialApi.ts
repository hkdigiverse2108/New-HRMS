import { useState, useCallback } from "react";
import { getApiUrl } from "@/lib/config";
import { getAuthToken } from "@/lib/api";
import type {
  SocialAccount,
  SocialKeyword,
  SocialPendingDm,
  SocialEventLog,
  SocialBrand,
  SocialScript,
  SocialSettingsData,
  SocialOverviewData,
  CaptionGenerationResponse,
  SocialMediaItem,
} from "./types";

export function useSocialApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    let token = getAuthToken();
    if (!token && typeof window !== "undefined") {
      token = localStorage.getItem("hrms_auth_token") || localStorage.getItem("token") || "";
    }
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  }, []);

  const request = useCallback(
    async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      setLoading(true);
      setError(null);
      const url = `${getApiUrl()}/social${endpoint}`;
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...getHeaders(),
            ...(options.headers || {}),
          },
        });

        if (!response.ok) {
          let errMsg = `Request failed: HTTP ${response.status}`;
          try {
            const data = await response.json();
            errMsg = data.detail || data.message || errMsg;
          } catch {
            const txt = await response.text();
            if (txt) errMsg = txt;
          }
          throw new Error(errMsg);
        }

        const json = await response.json();
        return json as T;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getHeaders]
  );

  // Overview
  const getOverview = useCallback(() => request<SocialOverviewData>("/overview"), [request]);

  // Accounts
  const getAccounts = useCallback(() => request<SocialAccount[]>("/accounts"), [request]);
  const createAccount = useCallback(
    (data: { ig_account_id: string; username: string; access_token: string; brand_id?: string | null | undefined }) =>
      request<SocialAccount>("/accounts", { method: "POST", body: JSON.stringify(data) }),
    [request]
  );
  const updateAccount = useCallback(
    (id: string, data: { username?: string | undefined; access_token?: string | undefined; brand_id?: string | null | undefined; is_active?: boolean | undefined }) =>
      request<SocialAccount>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    [request]
  );
  const toggleAccount = useCallback(
    (id: string) => request<SocialAccount>(`/accounts/${id}/toggle`, { method: "PATCH" }),
    [request]
  );
  const refreshAccountToken = useCallback(
    (id: string) => request<{ success: boolean; hint: string }>(`/accounts/${id}/refresh-token`, { method: "POST" }),
    [request]
  );
  const testAccountToken = useCallback(
    (id: string) => request<{ valid: boolean; hint: string }>(`/accounts/${id}/test-token`, { method: "POST" }),
    [request]
  );
  const deleteAccount = useCallback(
    (id: string) => request<{ deleted: boolean }>(`/accounts/${id}`, { method: "DELETE" }),
    [request]
  );
  const getAccountMedia = useCallback(
    (accountId: string, limit: number = 200) =>
      request<{ items: SocialMediaItem[]; total: number }>(`/accounts/${accountId}/media?limit=${limit}`),
    [request]
  );
  const syncAccountMedia = useCallback(
    (accountId: string) =>
      request<{ success: boolean; synced: number; total: number; items: SocialMediaItem[] }>(
        `/accounts/${accountId}/sync-media`,
        { method: "POST" }
      ),
    [request]
  );

  // Keywords
  const getKeywords = useCallback(
    async (params?: { ig_account_id?: string | undefined; scope?: string | undefined; sync_n8n?: boolean } | undefined) => {
      const sp = new URLSearchParams();
      if (params?.ig_account_id) sp.set("ig_account_id", params.ig_account_id);
      if (params?.scope) sp.set("scope", params.scope);
      if (params?.sync_n8n !== undefined) sp.set("sync_n8n", String(params.sync_n8n));
      const query = sp.toString() ? `?${sp.toString()}` : "";
      const res = await request<any>(`/keywords${query}`);
      if (Array.isArray(res)) return res as SocialKeyword[];
      if (res && Array.isArray(res.items)) return res.items as SocialKeyword[];
      return [] as SocialKeyword[];
    },
    [request]
  );
  const syncKeywords = useCallback(
    () => request<{ ok: boolean; total_n8n: number; inserted: number; updated: number; pushed_to_n8n?: number }>("/keywords/sync", { method: "POST" }),
    [request]
  );
  const createKeyword = useCallback(
    (data: Partial<SocialKeyword>) =>
      request<SocialKeyword>("/keywords", { method: "POST", body: JSON.stringify(data) }),
    [request]
  );
  const updateKeyword = useCallback(
    (id: string, data: Partial<SocialKeyword>) =>
      request<SocialKeyword>(`/keywords/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    [request]
  );
  const toggleKeyword = useCallback(
    (id: string) => request<SocialKeyword>(`/keywords/${id}/toggle`, { method: "PATCH" }),
    [request]
  );
  const deleteKeyword = useCallback(
    (id: string) => request<{ deleted: boolean }>(`/keywords/${id}`, { method: "DELETE" }),
    [request]
  );
  const testMatch = useCallback(
    (data: { comment_text: string; media_id?: string | undefined }) =>
      request<{ matched: boolean; reason: string; normalized_comment: string; matched_rule?: SocialKeyword | null }>(
        "/keywords/test-match",
        { method: "POST", body: JSON.stringify(data) }
      ),
    [request]
  );

  // Pending DMs
  const getPendingDms = useCallback(() => request<SocialPendingDm[]>("/pending"), [request]);
  const dismissPendingDm = useCallback(
    (id: string) => request<{ deleted: boolean }>(`/pending/${id}`, { method: "DELETE" }),
    [request]
  );
  const sweepPendingDms = useCallback(
    () => request<{ swept: number }>("/pending/sweep", { method: "POST" }),
    [request]
  );

  // Event Logs
  const getLogs = useCallback(
    async (params?: { level?: string | undefined; type?: string | undefined; limit?: number | undefined; page?: number | undefined } | undefined) => {
      const sp = new URLSearchParams();
      if (params?.level) sp.set("level", params.level);
      if (params?.type) sp.set("type", params.type);
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.page) sp.set("page", String(params.page));
      const query = sp.toString() ? `?${sp.toString()}` : "";
      const res = await request<any>(`/events${query}`);
      const list = Array.isArray(res?.items) ? res.items : Array.isArray(res?.events) ? res.events : Array.isArray(res) ? res : [];
      return {
        events: list as SocialEventLog[],
        items: list as SocialEventLog[],
        total: Number(res?.total ?? list.length),
        page: Number(res?.page ?? 1),
        limit: Number(res?.limit ?? 30),
      };
    },
    [request]
  );
  const clearLogs = useCallback(
    () => request<{ deleted: number }>("/events/clear", { method: "DELETE" }),
    [request]
  );

  // Brands
  const getBrands = useCallback(() => request<SocialBrand[]>("/brands"), [request]);
  const createBrand = useCallback(
    (data: Partial<SocialBrand>) =>
      request<SocialBrand>("/brands", { method: "POST", body: JSON.stringify(data) }),
    [request]
  );
  const updateBrand = useCallback(
    (id: string, data: Partial<SocialBrand>) =>
      request<SocialBrand>(`/brands/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    [request]
  );
  const deleteBrand = useCallback(
    (id: string) => request<{ deleted: boolean }>(`/brands/${id}`, { method: "DELETE" }),
    [request]
  );

  // Reel Scripts
  const getScripts = useCallback(
    (params?: { brand_id?: string; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params?.brand_id) sp.set("brand_id", params.brand_id);
      if (params?.limit) sp.set("limit", String(params.limit));
      const query = sp.toString() ? `?${sp.toString()}` : "";
      return request<SocialScript[]>(`/scripts${query}`);
    },
    [request]
  );
  const getScript = useCallback(
    (id: string) => request<SocialScript>(`/scripts/${id}`),
    [request]
  );
  const generateScript = useCallback(
    (data: { topic: string; brand_id?: string | null; duration?: number; tone?: string }) =>
      request<SocialScript>("/scripts/generate", { method: "POST", body: JSON.stringify(data) }),
    [request]
  );
  const reviseScript = useCallback(
    (id: string, feedback: string) =>
      request<SocialScript>(`/scripts/${id}/revise`, { method: "POST", body: JSON.stringify({ feedback }) }),
    [request]
  );
  const toggleFavoriteScript = useCallback(
    (id: string) => request<{ id: string; is_favorited: boolean }>(`/scripts/${id}/favorite`, { method: "POST" }),
    [request]
  );
  const updateScriptStatus = useCallback(
    (id: string, status: "draft" | "approved" | "recorded" | "published") =>
      request<SocialScript>(`/scripts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    [request]
  );
  const deleteScript = useCallback(
    (id: string) => request<{ deleted: boolean }>(`/scripts/${id}`, { method: "DELETE" }),
    [request]
  );

  // Captions
  const generateCaption = useCallback(
    (data: { topic: string; brand_id?: string | null; image_url?: string | null }) =>
      request<CaptionGenerationResponse>("/captions/generate", { method: "POST", body: JSON.stringify(data) }),
    [request]
  );

  // Settings
  const getSettings = useCallback(() => request<SocialSettingsData>("/settings"), [request]);
  const updateSettings = useCallback(
    (data: Record<string, unknown>) =>
      request<SocialSettingsData>("/settings", { method: "PUT", body: JSON.stringify(data) }),
    [request]
  );
  const testProvider = useCallback(
    (provider: string) =>
      request<{ ok: boolean; message: string; latency_ms?: number }>(`/settings/test/${provider}`, { method: "POST" }),
    [request]
  );

  return {
    loading,
    error,
    getOverview,
    getAccounts,
    createAccount,
    updateAccount,
    toggleAccount,
    refreshAccountToken,
    testAccountToken,
    deleteAccount,
    getAccountMedia,
    syncAccountMedia,
    getKeywords,
    syncKeywords,
    createKeyword,
    updateKeyword,
    toggleKeyword,
    deleteKeyword,
    testMatch,
    getPendingDms,
    dismissPendingDm,
    sweepPendingDms,
    getLogs,
    clearLogs,
    getBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    getScripts,
    getScript,
    generateScript,
    reviseScript,
    toggleFavoriteScript,
    updateScriptStatus,
    deleteScript,
    generateCaption,
    getSettings,
    updateSettings,
    testProvider,
  };
}
