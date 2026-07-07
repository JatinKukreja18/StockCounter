"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import type {
  AdminIssuesResponse,
  IssueOptionsResponse,
  IssueResolution
} from "@/lib/api-types";
import type { SyncIssue } from "@/lib/types";

export function useAdminIssues() {
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<AdminIssuesResponse>("/api/admin/issues", {
        cache: "no-store"
      });
      setIssues(data.issues ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const resolveIssue = useCallback(async (payload: IssueResolution) => {
    await apiJson<Record<string, unknown>>("/api/admin/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const nextStatus =
      payload.resolution === "assigned" ? "accepted" : payload.resolution;
    setIssues((items) =>
      items.map((item) =>
        item.id === payload.issueId ? { ...item, status: nextStatus } : item
      )
    );
  }, []);

  const searchOptions = useCallback(async (query: string) => {
    const data = await apiJson<IssueOptionsResponse>(
      `/api/admin/issues?options=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );
    return data.options ?? [];
  }, []);

  return { issues, loading, refresh, resolveIssue, searchOptions };
}
