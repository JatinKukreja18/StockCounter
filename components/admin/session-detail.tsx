"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { indexActiveProductCountQuantities } from "@/lib/counting";
import { demoEntries, demoProducts } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/runtime";
import type { CountEntry, CountSession, Product } from "@/lib/types";
import { formatNumber, formatTime } from "@/lib/utils";

export function SessionDetail({ session }: { session: CountSession }) {
  const isDemo = isDemoMode();
  const [sessionData, setSessionData] = useState(session);
  const [closed, setClosed] = useState(session.status === "closed");
  const [products, setProducts] = useState<Product[]>(isDemo ? demoProducts.filter((product) => session.productIds.includes(product.id)) : []);
  const [entries, setEntries] = useState<CountEntry[]>(isDemo ? demoEntries.filter((entry) => entry.sessionId === session.id) : []);
  useEffect(() => {
    if (!isDemo) void fetch(`/api/admin/sessions/${session.id}`).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      setSessionData(data.session);
      setClosed(data.session.status === "closed");
      setProducts(data.products);
      setEntries(data.entries);
    });
  }, [isDemo, session.id]);
  const countsByProduct = useMemo(() => indexActiveProductCountQuantities(entries, session.id), [entries, session.id]);
  const [tab, setTab] = useState<"variance" | "history">("variance");
  async function closeSession() {
    if (!window.confirm("Close this session? Staff will no longer be able to sync entries into it.")) return;
    if (!isDemo) {
      const response = await fetch(`/api/admin/sessions/${session.id}`, { method: "PATCH" });
      if (!response.ok) return;
    }
    setClosed(true);
  }
  async function changeEntry(entryId: string, action: "void" | "correct") {
    let quantity: number | undefined;
    if (action === "correct") {
      const value = window.prompt("Enter corrected quantity");
      if (value === null || Number(value) < 0) return;
      quantity = Number(value);
    } else if (!window.confirm("Void this entry? Its quantity will be removed from the count.")) return;
    if (!isDemo) {
      const response = await fetch(`/api/admin/sessions/${session.id}/entries`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, action, quantity })
      });
      if (!response.ok) return;
      const refreshed = await fetch(`/api/admin/sessions/${session.id}`);
      if (refreshed.ok) setEntries((await refreshed.json()).entries);
    } else setEntries((items) => items.map((entry) => entry.id === entryId ? { ...entry, isVoided: true } : entry));
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Badge tone={closed ? "neutral" : "green"}>{closed ? "closed" : "open"}</Badge><span className="text-xs font-semibold text-[#68726c]"><Users className="mr-1 inline" size={14} />{sessionData.assignees.join(", ")}</span></div><p className="mt-2 text-xs text-[#7a847e]">Master: {sessionData.masterFileName}</p></div>
        <div className="flex gap-2"><ExportButton sessionId={session.id} products={products} entries={entries} /><Button variant="danger" disabled={closed} onClick={() => void closeSession()}><Lock size={16} /> {closed ? "Session closed" : "Close session"}</Button></div>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-[#e9ecea] p-1 sm:w-80">
        <button onClick={() => setTab("variance")} className={`h-9 rounded-lg text-xs font-bold ${tab === "variance" ? "bg-white shadow-sm" : "text-[#68726c]"}`}>Variance</button>
        <button onClick={() => setTab("history")} className={`h-9 rounded-lg text-xs font-bold ${tab === "history" ? "bg-white shadow-sm" : "text-[#68726c]"}`}>Entry history</button>
      </div>
      <Card className="overflow-hidden">
        {tab === "variance" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#f7f9f7] text-xs text-[#68726c]"><tr>{["Product", "System qty", "Count qty", "Difference", "Status", ""].map((item) => <th key={item} className="px-5 py-3 font-bold">{item}</th>)}</tr></thead>
              <tbody>{products.map((product) => {
                const count = countsByProduct.get(product.id) ?? 0;
                const difference = count - product.systemQty;
                return (
                  <tr key={product.id} className="border-t border-[#e8ece9]">
                    <td className="px-5 py-4"><p className="font-bold">{product.name}</p><p className="mt-1 text-xs text-[#7a847e]">{product.sku} · {product.barcode}</p></td>
                    <td className="tabular px-5 py-4 font-semibold">{formatNumber(product.systemQty)}</td>
                    <td className="tabular px-5 py-4 font-black">{formatNumber(count)}</td>
                    <td className={`tabular px-5 py-4 font-black ${difference ? "text-[#b45309]" : "text-[#18794e]"}`}>{difference > 0 ? "+" : ""}{formatNumber(difference)}</td>
                    <td className="px-5 py-4">{!countsByProduct.has(product.id) ? <Badge>Not counted</Badge> : difference === 0 ? <Badge tone="green">Matched</Badge> : <Badge tone="amber">Variance</Badge>}</td>
                    <td className="px-5 py-4"><button className="text-[#7a847e]"><MoreHorizontal size={18} /></button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[#e8ece9]">
            {entries.filter((entry) => entry.sessionId === session.id).map((entry) => {
              const product = products.find((item) => item.id === entry.productId);
              return <div key={entry.id} className="flex items-center gap-3 px-5 py-4"><span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]">{entry.isVoided ? <Circle size={16} /> : <CheckCircle2 size={16} />}</span><div className="min-w-0 flex-1"><p className={`truncate text-sm ${entry.isVoided ? "line-through opacity-50" : ""}`}><b>{entry.userName}</b> added <b>+{entry.quantity}</b> {product?.name}</p><p className="mt-1 text-xs text-[#7a847e]">{entry.area} · synced {formatTime(entry.createdAt)}</p></div>{!entry.isVoided && <><Button size="sm" variant="ghost" onClick={() => void changeEntry(entry.id, "correct")}><Pencil size={14} /> Correct</Button><Button size="sm" variant="ghost" className="text-[#b42318]" onClick={() => void changeEntry(entry.id, "void")}><Trash2 size={14} /> Void</Button></>}</div>;
            })}
          </div>
        )}
      </Card>
    </>
  );
}
