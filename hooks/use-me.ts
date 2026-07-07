"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getErrorMessage } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-types";
import { isDemoMode } from "@/lib/runtime";

const demoProfile: UserProfile = {
  id: "demo",
  email: "demo@sekai.local",
  phone: null,
  fullName: "Demo Admin",
  role: "admin"
};

export function useMe() {
  const isDemo = isDemoMode();
  const [profile, setProfile] = useState<UserProfile | null>(
    isDemo ? demoProfile : null
  );
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isDemo) {
      setProfile(demoProfile);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProfile(await apiJson<UserProfile>("/api/me", { cache: "no-store" }));
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not load profile."));
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, error, refresh, isDemo };
}
