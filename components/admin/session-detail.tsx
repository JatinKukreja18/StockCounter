"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Lock, MoreHorizontal, Pencil, Users } from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoEntries, demoProducts } from "@/lib/demo-data";
import type { CountSession } from "@/lib/types";
import { formatNumber, formatTime } from "@/lib/utils";

export function SessionDetail({ session }: { session: CountSession }) {
  const [closed, setClosed] = useState(session.status === "closed");
  const products = demoProducts.filter((product) => session.productIds.includes(product.id));
  const batchRows = products.flatMap((product) => product.batches.map((batch) => ({ product, batch })));
  const [tab, setTab] = useState<"variance" | "history">("variance");
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Badge tone={closed ? "neutral" : "green"}>{closed ? "closed" : "open"}</Badge><span className="text-xs font-semibold text-[#68726c]"><Users className="mr-1 inline" size={14} />{session.assignees.join(", ")}</span></div>
        <div className="flex gap-2"><ExportButton sessionId={session.id} /><Button variant="danger" disabled={closed} onClick={() => window.confirm("Close this session? Staff will no longer be able to sync entries into it.") && setClosed(true)}><Lock size={16} /> {closed ? "Session closed" : "Close session"}</Button></div>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-[#e9ecea] p-1 sm:w-80">
        <button onClick={() => setTab("variance")} className={`h-9 rounded-lg text-xs font-bold ${tab === "variance" ? "bg-white shadow-sm" : "text-[#68726c]"}`}>Variance</button>
        <button onClick={() => setTab("history")} className={`h-9 rounded-lg text-xs font-bold ${tab === "history" ? "bg-white shadow-sm" : "text-[#68726c]"}`}>Entry history</button>
      </div>
      <Card className="overflow-hidden">
        {tab === "variance" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#f7f9f7] text-xs text-[#68726c]"><tr>{["Product", "Batch / inward ref", "Expiry", "System qty", "Count qty", "Difference", "Status", ""].map((item) => <th key={item} className="px-5 py-3 font-bold">{item}</th>)}</tr></thead>
              <tbody>{batchRows.map(({ product, batch }) => {
                const count = demoEntries.filter((entry) => entry.sessionId === session.id && entry.productId === product.id && entry.stockBatchId === batch.id && !entry.isVoided).reduce((sum, entry) => sum + entry.quantity, 0);
                const difference = count - batch.systemQty;
                return (
                  <tr key={batch.id} className="border-t border-[#e8ece9]">
                    <td className="px-5 py-4"><p className="font-bold">{product.name}</p><p className="mt-1 text-xs text-[#7a847e]">{product.sku} · {product.barcode}</p></td>
                    <td className="px-5 py-4 font-semibold">{batch.batchNo || batch.inwardTranno || "Unlabelled"}</td>
                    <td className="px-5 py-4 font-semibold">{batch.expiryDate || <span className="text-[#b45309]">No expiry</span>}</td>
                    <td className="tabular px-5 py-4 font-semibold">{formatNumber(batch.systemQty)}</td>
                    <td className="tabular px-5 py-4 font-black">{formatNumber(count)}</td>
                    <td className={`tabular px-5 py-4 font-black ${difference ? "text-[#b45309]" : "text-[#18794e]"}`}>{difference > 0 ? "+" : ""}{formatNumber(difference)}</td>
                    <td className="px-5 py-4">{count === 0 ? <Badge>Not counted</Badge> : difference === 0 ? <Badge tone="green">Matched</Badge> : <Badge tone="amber">Variance</Badge>}</td>
                    <td className="px-5 py-4"><button className="text-[#7a847e]"><MoreHorizontal size={18} /></button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[#e8ece9]">
            {demoEntries.filter((entry) => entry.sessionId === session.id).map((entry) => {
              const product = demoProducts.find((item) => item.id === entry.productId);
              return <div key={entry.id} className="flex items-center gap-3 px-5 py-4"><span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]">{entry.isVoided ? <Circle size={16} /> : <CheckCircle2 size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm"><b>{entry.userName}</b> added <b>+{entry.quantity}</b> {product?.name}</p><p className="mt-1 text-xs text-[#7a847e]">{entry.area} · synced {formatTime(entry.createdAt)}</p></div><Button size="sm" variant="ghost"><Pencil size={14} /> Edit</Button></div>;
            })}
          </div>
        )}
      </Card>
    </>
  );
}
