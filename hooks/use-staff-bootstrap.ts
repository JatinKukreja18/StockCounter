"use client";

import { useCallback } from "react";
import { apiJson } from "@/lib/api-client";
import type { BootstrapData, SyncResponse } from "@/lib/api-types";
import type { LocalCountEntry } from "@/lib/types";

export function useStaffBootstrap() {
  const loadBootstrap = useCallback(() => (
    apiJson<BootstrapData>("/api/staff/bootstrap", { cache: "no-store" })
  ), []);

  const syncEntries = useCallback((entries: LocalCountEntry[]) => (
    apiJson<SyncResponse>("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries })
    })
  ), []);

  return { loadBootstrap, syncEntries };
}
