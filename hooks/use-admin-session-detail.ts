"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getErrorMessage } from "@/lib/api-client";
import type {
  AdminUserRow,
  AdminUsersResponse,
  SessionDetailData
} from "@/lib/api-types";
import type { CountEntry, CountSession, Product } from "@/lib/types";

export function useAdminSessionDetail(session: CountSession) {
  const [sessionData, setSessionData] = useState(session);
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<CountEntry[]>([]);
  const [staff, setStaff] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshSession = useCallback(async () => {
    const data = await apiJson<SessionDetailData>(
      `/api/admin/sessions/${session.id}`,
      { cache: "no-store" }
    );
    setSessionData(data.session);
    setProducts(data.products);
    setEntries(data.entries);
  }, [session.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detailData, usersData] = await Promise.all([
        apiJson<SessionDetailData>(`/api/admin/sessions/${session.id}`, {
          cache: "no-store"
        }),
        apiJson<AdminUsersResponse>("/api/admin/users", { cache: "no-store" })
      ]);
      setSessionData(detailData.session);
      setProducts(detailData.products);
      setEntries(detailData.entries);
      setStaff((usersData.users ?? []).filter((user) => user.role === "staff"));
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not load session."));
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const closeSession = useCallback(async () => {
    await apiJson<Record<string, unknown>>(
      `/api/admin/sessions/${session.id}`,
      { method: "PATCH" }
    );
    await refreshSession();
  }, [refreshSession, session.id]);

  const changeEntry = useCallback(
    async (entryId: string, action: "void" | "correct", quantity?: number) => {
      await apiJson<Record<string, unknown>>(
        `/api/admin/sessions/${session.id}/entries`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, action, quantity })
        }
      );
      await refreshSession();
    },
    [refreshSession, session.id]
  );

  const addPeople = useCallback(
    async (assigneeIds: string[]) => {
      await apiJson<Record<string, unknown>>(
        `/api/admin/sessions/${session.id}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeIds })
        }
      );
      await refreshSession();
    },
    [refreshSession, session.id]
  );

  const renameSession = useCallback(
    async (name: string) => {
      const data = await apiJson<{ name?: string }>(
        `/api/admin/sessions/${session.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        }
      );
      const savedName = data.name ?? name;
      setSessionData((current) => ({ ...current, name: savedName }));
      return savedName;
    },
    [session.id]
  );

  return {
    sessionData,
    setSessionData,
    products,
    setProducts,
    entries,
    setEntries,
    staff,
    setStaff,
    loading,
    error,
    refresh,
    refreshSession,
    closeSession,
    changeEntry,
    addPeople,
    renameSession
  };
}
