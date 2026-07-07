"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getErrorMessage } from "@/lib/api-client";
import type { DashboardData } from "@/lib/api-types";

export function useAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await apiJson<DashboardData>("/api/admin/dashboard", {
          cache: "no-store"
        })
      );
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not load dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
