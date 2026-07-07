"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import type {
  AdminIssuesResponse,
  IssueOptionsResponse,
  IssueResolution
} from "@/lib/api-types";
import type { SyncIssue } from "@/lib/types";

export function useAdminIssues(isDemo: boolean, demoIssues: SyncIssue[]) {
  const [issues, setIssues] = useState<SyncIssue[]>(isDemo ? demoIssues : []);
  const [loading, setLoading] = useState(!isDemo);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    try {
      const data = await apiJson<AdminIssuesResponse>("/api/admin/issues", {
        cache: "no-store"
      });
      setIssues(data.issues ?? []);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const resolveIssue = useCallback(
    async (payload: IssueResolution) => {
      if (!isDemo) {
        await apiJson<Record<string, unknown>>("/api/admin/issues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      const nextStatus =
        payload.resolution === "assigned" ? "accepted" : payload.resolution;
      setIssues((items) =>
        items.map((item) =>
          item.id === payload.issueId ? { ...item, status: nextStatus } : item
        )
      );
    },
    [isDemo]
  );

  const searchOptions = useCallback(async (query: string) => {
    const data = await apiJson<IssueOptionsResponse>(
      `/api/admin/issues?options=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );
    return data.options ?? [];
  }, []);

  return { issues, setIssues, loading, refresh, resolveIssue, searchOptions };
}
