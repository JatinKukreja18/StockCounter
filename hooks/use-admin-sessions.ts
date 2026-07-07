"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getErrorMessage } from "@/lib/api-client";
import type {
  AdminSessionsResponse,
  AdminUserRow,
  AdminUsersResponse,
  CreateSessionPayload,
  CreateSessionResponse
} from "@/lib/api-types";
import type { CountSession } from "@/lib/types";

export function useAdminSessions({ autoLoad = true }: { autoLoad?: boolean } = {}) {
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [staff, setStaff] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sessionsData, usersData] = await Promise.all([
        apiJson<AdminSessionsResponse>("/api/admin/sessions", { cache: "no-store" }),
        apiJson<AdminUsersResponse>("/api/admin/users", { cache: "no-store" })
      ]);
      setSessions(sessionsData.sessions ?? []);
      setStaff((usersData.users ?? []).filter((user) => user.role === "staff"));
      return sessionsData.sessions ?? [];
    } catch (reason) {
      const message = getErrorMessage(reason, "Could not load sessions.");
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void refresh().catch(() => undefined);
  }, [autoLoad, refresh]);

  const createSession = useCallback(async (payload: CreateSessionPayload) => {
    const data = await apiJson<CreateSessionResponse>("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refresh();
    return data;
  }, [refresh]);

  const addPeople = useCallback(async (sessionId: string, assigneeIds: string[]) => {
    await apiJson<Record<string, unknown>>(`/api/admin/sessions/${sessionId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds })
    });
    await refresh();
  }, [refresh]);

  return { sessions, setSessions, staff, setStaff, loading, error, setError, refresh, createSession, addPeople };
}
