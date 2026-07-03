"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserBadge() {
  const router = useRouter();
  const [name, setName] = useState("Staff");
  useEffect(() => {
    void fetch("/api/me").then(async (response) => {
      if (response.ok) setName((await response.json()).fullName);
    });
  }, []);
  async function logout() {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      await createSupabaseBrowserClient().auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <button onClick={() => void logout()} title="Sign out" className="hidden items-center gap-2 rounded-full bg-[#eef2ef] py-1.5 pl-2 pr-3 text-xs font-semibold sm:flex">
      <span className="grid size-7 place-items-center rounded-full bg-white"><UserRound size={14} /></span>
      {name}<LogOut size={12} className="text-[#7a847e]" />
    </button>
  );
}
