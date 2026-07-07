"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getErrorMessage } from "@/lib/api-client";
import type {
  AdminUserRow,
  AdminUsersResponse,
  CreateUserPayload,
  UpdateUserPayload
} from "@/lib/api-types";

export function useAdminUsers({
  autoLoad = true
}: { autoLoad?: boolean } = {}) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson<AdminUsersResponse>("/api/admin/users", {
        cache: "no-store"
      });
      setUsers(data.users ?? []);
      return data.users ?? [];
    } catch (reason) {
      const message = getErrorMessage(reason, "Could not load users.");
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void refresh().catch(() => undefined);
  }, [autoLoad, refresh]);

  const saveUser = useCallback(
    async (payload: CreateUserPayload | UpdateUserPayload) => {
      const data = await apiJson<AdminUsersResponse>("/api/admin/users", {
        method: "id" in payload ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await refresh();
      return data;
    },
    [refresh]
  );

  return { users, setUsers, loading, error, setError, refresh, saveUser };
}
