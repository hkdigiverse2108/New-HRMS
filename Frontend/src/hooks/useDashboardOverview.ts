import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ONE-API dashboard data (month-wise), shared module cache → sections re-render par refetch nai.
const cache = new Map<string, any>();
const inflight = new Map<string, Promise<any>>();

export function currentMonthYear(now: Date = new Date()) {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function useDashboardOverview(month?: number, year?: number) {
  const now = new Date();
  const m = month || now.getMonth() + 1;
  const y = year || now.getFullYear();
  const key = `${y}-${String(m).padStart(2, "0")}`;
  const [data, setData] = useState<any | null>(() => cache.get(key) || null);
  const [isLoading, setIsLoading] = useState(!cache.has(key));

  const fetchData = useCallback(async () => {
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      return cached;
    }
    let p = inflight.get(key);
    if (!p) {
      p = api
        .get<any>(`/dashboard/overview?month=${m}&year=${y}`, { showLoader: false, showErrorToast: false })
        .then((res) => {
          cache.set(key, res);
          return res;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, p);
    }
    setIsLoading(true);
    try {
      const res = await p;
      setData(res);
      return res;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [key, m, y]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, refresh: fetchData, month: m, year: y };
}

export function clearDashboardCache() {
  cache.clear();
}
