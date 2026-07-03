import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, PackageSearch, Plus, Users } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoEntries, demoIssues, demoProducts, demoSessions } from "@/lib/demo-data";
import { formatNumber, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/admin/sessions");
  const completedProductIds = new Set(demoProducts.filter((product) =>
    product.batches.every((batch) => demoEntries.some((entry) => entry.productId === product.id && entry.stockBatchId === batch.id && !entry.isVoided))
  ).map((product) => product.id));
  const progress = Math.round((completedProductIds.size / demoProducts.length) * 100);
  return (
    <>
      <PageHeading eyebrow="Live count" title="Good evening, Rohan" description="Three teams are counting the Main Store. Review progress here while staff continue working offline." action={<Link href="/admin/sessions"><Button><Plus size={17} /> New session</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall progress" value={`${progress}%`} detail={`${completedProductIds.size} of ${demoProducts.length} products fully counted`} icon={PackageSearch} />
        <StatCard label="Open sessions" value={String(demoSessions.filter((session) => session.status === "open").length)} detail="Across 3 categories" icon={Clock3} tone="neutral" />
        <StatCard label="Staff counting" value="3" detail="2 synced in last 10 min" icon={Users} tone="green" />
        <StatCard label="Sync issues" value={String(demoIssues.filter((issue) => issue.status === "open").length)} detail="Needs admin review" icon={AlertTriangle} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4">
            <div><h2 className="font-black">Session progress</h2><p className="text-xs text-[#7a847e]">Count totals update after each staff sync</p></div>
            <Link href="/admin/sessions" className="text-xs font-bold text-[#18794e]">View all</Link>
          </div>
          <div className="divide-y divide-[#e8ece9]">
            {demoSessions.map((session) => {
              const sessionProducts = demoProducts.filter((product) => session.productIds.includes(product.id));
              const counted = sessionProducts.filter((product) =>
                product.batches.every((batch) => demoEntries.some((entry) => entry.sessionId === session.id && entry.stockBatchId === batch.id && !entry.isVoided))
              ).length;
              const percent = Math.round((counted / session.productIds.length) * 100);
              return (
                <Link href={`/admin/sessions/${session.id}`} key={session.id} className="group block px-5 py-4 hover:bg-[#fbfcfb]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-bold">{session.name}</p><p className="mt-0.5 text-xs text-[#7a847e]">{session.assignees.join(", ")} · {counted}/{session.productIds.length} SKUs</p></div>
                    <div className="flex items-center gap-3"><span className="tabular text-sm font-black">{percent}%</span><ArrowRight size={16} className="text-[#9aa29d] transition group-hover:translate-x-1" /></div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#2c9762]" style={{ width: `${percent}%` }} /></div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4">
            <div><h2 className="font-black">Recent activity</h2><p className="text-xs text-[#7a847e]">Latest synced entries</p></div>
            <Badge tone="green">Live</Badge>
          </div>
          <div className="divide-y divide-[#e8ece9]">
            {demoEntries.slice().reverse().map((entry) => {
              const product = demoProducts.find((item) => item.id === entry.productId);
              return (
                <div key={entry.id} className="flex gap-3 px-5 py-3.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><CheckCircle2 size={15} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.userName} added <b>+{formatNumber(entry.quantity)}</b> {product?.name}</p><p className="mt-1 text-xs text-[#7a847e]">{entry.area} · {formatTime(entry.createdAt)}</p></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
