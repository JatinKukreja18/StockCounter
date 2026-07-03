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
    void fetch("/api/me").then(async (response) => {
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
      <button onClick={() => void logout()} title="Sign out" className="hidden items-center gap-2 rounded-full bg-[#eef2ef] py-1.5 pl-2 pr-3 text-xs font-semibold sm:flex">
        <span className="grid size-7 place-items-center rounded-full bg-white"><UserRound size={14} /></span>
        {name}<LogOut size={12} className="text-[#7a847e]" />
      </button>
    </div>
  );
}
