"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserBadge() {
  const router = useRouter();
  const [name, setName] = useState("Staff");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  useEffect(() => {
    void fetch("/api/me", { cache: "no-store" }).then(async (response) => {
      if (response.ok) {
        const profile = await response.json();
        setName(profile.fullName);
        setRole(profile.role);
      }
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
    <div className="flex items-center gap-2">
      {role === "admin" && <Link href="/admin/sessions" aria-label="Admin dashboard" className="flex h-10 items-center gap-1.5 rounded-xl bg-[#e9f6ef] px-2.5 text-xs font-bold text-[#12673f] sm:px-3"><LayoutDashboard size={16} /><span className="hidden sm:inline">Admin</span></Link>}
      <button onClick={() => void logout()} title="Sign out" aria-label="Sign out" className="flex size-10 items-center justify-center gap-2 rounded-xl bg-[#eef2ef] text-xs font-semibold sm:h-auto sm:w-auto sm:rounded-full sm:py-1.5 sm:pl-2 sm:pr-3">
        <span className="hidden size-7 place-items-center rounded-full bg-white sm:grid"><UserRound size={14} /></span>
        <span className="hidden sm:inline">{name}</span><LogOut size={15} className="text-[#7a847e]" />
      </button>
    </div>
  );
}
