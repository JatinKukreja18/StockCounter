"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileUp, Filter, Plus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoEntries, demoProducts, demoSessions } from "@/lib/demo-data";
import type { CountSession } from "@/lib/types";

export function SessionManager() {
  const [sessions, setSessions] = useState(demoSessions);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [masterFile, setMasterFile] = useState("");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Filter size={15} /> All stores</Button>
          <Link href="/admin/import"><Button variant="secondary" size="sm"><FileUp size={15} /> Import stock</Button></Link>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={17} /> Create session</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {sessions.map((session) => {
          const sessionProducts = demoProducts.filter((product) => session.productIds.includes(product.id));
          const counted = sessionProducts.filter((product) =>
            product.batches.every((batch) => demoEntries.some((entry) => entry.sessionId === session.id && entry.stockBatchId === batch.id && !entry.isVoided))
          ).length;
          const percent = Math.round((counted / session.productIds.length) * 100);
          return (
            <Card key={session.id} className="group overflow-hidden">
              <div className="p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={session.status === "open" ? "green" : "neutral"}>{session.status}</Badge>
                    <h2 className="mt-2 text-lg font-black">{session.name}</h2>
                    <p className="mt-1 text-xs text-[#7a847e]">Master: {session.masterFileName} · {session.productIds.length} products</p>
                  </div>
                  <Link href={`/admin/sessions/${session.id}`} className="grid size-10 place-items-center rounded-xl bg-[#eef2ef] text-[#56615b] transition group-hover:bg-[#18794e] group-hover:text-white"><ArrowRight size={18} /></Link>
                </div>
                <div className="mb-2 flex items-end justify-between">
                  <div><p className="text-xs font-bold text-[#68726c]">Count progress</p><p className="tabular mt-1 text-2xl font-black">{percent}%</p></div>
                  <p className="text-xs font-semibold text-[#7a847e]">{counted} of {session.productIds.length} SKUs</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#2c9762]" style={{ width: `${percent}%` }} /></div>
              </div>
              <div className="flex items-center justify-between border-t border-[#e8ece9] bg-[#fbfcfb] px-5 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#68726c]"><Users size={15} /> {session.assignees.join(", ")}</div>
                <span className="text-xs font-bold text-[#18794e]">{demoEntries.filter((entry) => entry.sessionId === session.id).length} synced entries</span>
              </div>
            </Card>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-[#172019]/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
          <Card className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-b-none p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div><h2 className="text-xl font-black">Create count session</h2><p className="mt-1 text-sm text-[#68726c]">This session&apos;s Excel upload becomes its locked stock master.</p></div>
              <button onClick={() => setCreating(false)} className="grid size-9 place-items-center rounded-full bg-[#eef1ef]"><X size={17} /></button>
            </div>
            {created ? (
              <div className="py-10 text-center">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><Check size={26} /></span>
                <h3 className="font-black">Session is open</h3>
                <p className="mt-2 text-sm text-[#68726c]">Assigned staff can now count these products.</p>
                <Button className="mt-5" onClick={() => { setCreating(false); setCreated(false); }}>Done</Button>
              </div>
            ) : (
              <form onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const category = String(form.get("category"));
                const next: CountSession = {
                  id: crypto.randomUUID(), stockImportId: crypto.randomUUID(), masterFileName: masterFile, name: `${category} · Main Store`, category, store: "Main Store", status: "open",
                  productIds: ["new-1", "new-2"], assignees: [String(form.get("assignee"))], createdAt: new Date().toISOString()
                };
                setSessions((value) => [...value, next]);
                setCreated(true);
              }} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-bold">GoFrugal stock master</span><input required type="file" accept=".xls,.xlsx" onChange={(event) => setMasterFile(event.target.files?.[0]?.name ?? "")} className="block w-full rounded-xl border border-[#dfe5e1] bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#e9f6ef] file:px-3 file:py-2 file:font-bold file:text-[#12673f]" /><span className="mt-1.5 block text-[11px] text-[#7a847e]">The file is immutable after the session opens.</span></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold">Store</span><select name="store" className="h-11 w-full rounded-xl border border-[#dfe5e1] bg-white px-3 outline-none"><option>Main Store</option></select></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold">Category</span><select name="category" className="h-11 w-full rounded-xl border border-[#dfe5e1] bg-white px-3 outline-none"><option>Confectionery</option><option>Frozen</option><option>Household</option></select></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold">Assign to</span><select name="assignee" className="h-11 w-full rounded-xl border border-[#dfe5e1] bg-white px-3 outline-none"><option>Aiko</option><option>Meera</option><option>Rohan</option><option>Night Team</option></select></label>
                <div className="rounded-xl bg-[#f4f7f5] p-4 text-sm">{masterFile ? <><b>{masterFile}</b> will be parsed into products and expiry batches for this session.</> : "Choose the Excel file to preview its products and batches."}</div>
                <Button size="lg" className="w-full" type="submit">Create and open session</Button>
              </form>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
