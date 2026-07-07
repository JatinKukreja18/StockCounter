"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LoaderCircle, PackageSearch, Plus, Users } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminDashboard } from "@/hooks/use-admin-dashboard";
import { formatNumber, formatTime } from "@/lib/utils";

export function AdminDashboard() {
  const { data, loading, error } = useAdminDashboard();

  if (error) return <Card className="p-6 text-sm font-semibold text-[#b42318]">{error}</Card>;
  if (loading || !data) return <div className="grid min-h-[55dvh] place-items-center"><LoaderCircle className="animate-spin text-[#18794e]" size={30} /></div>;

  return (
    <>
      <PageHeading eyebrow="Live count" title="Count overview" description="Live progress from Supabase. Products are complete only when every expected expiry batch has an active count entry." action={<Link href="/admin/sessions"><Button><Plus size={17} /> New session</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall progress" value={`${data.stats.overallPercent}%`} detail={`${data.stats.completedProducts} of ${data.stats.totalProducts} products fully counted`} icon={PackageSearch} />
        <StatCard label="Open sessions" value={String(data.stats.openSessions)} detail="Currently accepting syncs" icon={Clock3} tone="neutral" />
        <StatCard label="Staff accounts" value={String(data.stats.staffUsers)} detail="Individual authenticated users" icon={Users} tone="green" />
        <StatCard label="Sync issues" value={String(data.stats.openIssues)} detail="Needs admin review" icon={AlertTriangle} tone={data.stats.openIssues ? "amber" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4">
            <div><h2 className="font-black">Session progress</h2><p className="text-xs text-[#7a847e]">Updated after staff sync</p></div>
            <Link href="/admin/sessions" className="text-xs font-bold text-[#18794e]">View all</Link>
          </div>
          {!data.sessions.length ? <div className="px-5 py-12 text-center text-sm text-[#7a847e]">No open sessions. Upload a stock master to begin.</div> : (
            <div className="divide-y divide-[#e8ece9]">{data.sessions.map((session) => (
              <Link href={`/admin/sessions/${session.id}`} key={session.id} className="group block px-5 py-4 hover:bg-[#fbfcfb]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><p className="text-sm font-bold">{session.name}</p><p className="mt-0.5 text-xs text-[#7a847e]">{session.assignees.join(", ") || "No staff assigned"} · {session.completedProducts}/{session.totalProducts} products</p></div>
                  <div className="flex items-center gap-3"><span className="tabular text-sm font-black">{session.percent}%</span><ArrowRight size={16} className="text-[#9aa29d] transition group-hover:translate-x-1" /></div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#2c9762]" style={{ width: `${session.percent}%` }} /></div>
              </Link>
            ))}</div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4">
            <div><h2 className="font-black">Recent activity</h2><p className="text-xs text-[#7a847e]">Latest active synced entries</p></div>
            <Badge tone="green">Live</Badge>
          </div>
          {!data.recent.length ? <div className="px-5 py-12 text-center text-sm text-[#7a847e]">No synced entries yet.</div> : (
            <div className="divide-y divide-[#e8ece9]">{data.recent.map((entry) => (
              <div key={entry.id} className="flex gap-3 px-5 py-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><CheckCircle2 size={15} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.userName} added <b>+{formatNumber(entry.quantity)}</b> {entry.productName}</p><p className="mt-1 text-xs text-[#7a847e]">{entry.area || "No area"} · {formatTime(entry.syncedAt)}</p></div>
              </div>
            ))}</div>
          )}
        </Card>
      </div>
    </>
  );
}
