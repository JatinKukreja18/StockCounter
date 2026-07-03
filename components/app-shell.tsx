"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardCheck, Cloud, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserBadge } from "@/components/user-badge";

const nav = [
  { href: "/count", label: "Count", icon: Boxes },
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/sessions", label: "Sessions", icon: ClipboardCheck },
  { href: "/admin/issues", label: "Issues", icon: Cloud },
  { href: "/admin/users", label: "Users", icon: Users }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCount = pathname.startsWith("/count");
  if (pathname === "/login") return <main>{children}</main>;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[#e4e8e5]/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          <Link href={isCount ? "/count" : "/admin"} className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#18794e] text-lg font-black text-white">S</div>
            <div>
              <div className="text-sm font-black tracking-[-.01em]">SEKAI ICHIBA</div>
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7a847e]">Stock Count</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <UserBadge />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {!isCount && (
          <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 border-r border-[#e4e8e5] px-3 py-6 lg:block">
            <nav className="space-y-1">
              {nav.slice(1).map((item) => {
                const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold", active ? "bg-[#e9f6ef] text-[#12673f]" : "text-[#68726c] hover:bg-white")}>
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-5 left-3 right-3 rounded-xl border border-[#dfe5e1] bg-white p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-bold text-[#18794e]"><Cloud size={14} /> System online</div>
              <p className="text-[11px] leading-4 text-[#7a847e]">Stock import updated 7 hours ago.</p>
            </div>
          </aside>
        )}
        <main className={cn("min-w-0 flex-1", isCount ? "pb-24" : "px-4 py-6 pb-24 lg:px-8 lg:py-8")}>{children}</main>
      </div>

      {!isCount && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#dfe5e1] bg-white px-2 pt-2 lg:hidden">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold", active ? "text-[#18794e]" : "text-[#7a847e]")}>
                <item.icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
