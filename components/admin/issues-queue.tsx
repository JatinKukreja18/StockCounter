"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Link2, Pencil, Search, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoIssues } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/runtime";
import type { SyncIssue } from "@/lib/types";
import { formatTime } from "@/lib/utils";

export function IssuesQueue() {
  const isDemo = isDemoMode();
  const [issues, setIssues] = useState<SyncIssue[]>(isDemo ? demoIssues : []);
  const [loading, setLoading] = useState(!isDemo);
  const [query, setQuery] = useState("");
  const open = issues.filter((issue) => issue.status === "open" && `${issue.code} ${issue.message} ${issue.localEntryId}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    if (!isDemo) void fetch("/api/admin/issues").then(async (response) => {
      if (response.ok) setIssues((await response.json()).issues);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isDemo]);
  async function resolve(id: string, status: SyncIssue["status"]) {
    if (status === "open") return;
    let quantity: number | undefined;
    if (status === "corrected") {
      const value = window.prompt("Enter the corrected positive quantity");
      if (!value || Number(value) <= 0) return;
      quantity = Number(value);
    }
    if (!isDemo) {
      const response = await fetch("/api/admin/issues", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: id, resolution: status, quantity })
      });
      if (!response.ok) return;
    }
    setIssues((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  }
  async function assign(id: string) {
    const query = window.prompt("Search the correct product by SKU, barcode, or name");
    if (!query) return;
    if (isDemo) return setIssues((items) => items.map((item) => item.id === id ? { ...item, status: "accepted" } : item));
    const response = await fetch(`/api/admin/issues?options=${encodeURIComponent(query)}`);
    const options = response.ok ? (await response.json()).options as Array<{ sessionId: string; stockBatchId: string; label: string }> : [];
    if (!options.length) return window.alert("No matching batch in an open session.");
    let selected = options[0];
    if (options.length > 1) {
      const choice = window.prompt(`Choose a result number:\n${options.slice(0, 10).map((option, index) => `${index + 1}. ${option.label}`).join("\n")}`, "1");
      const index = Number(choice) - 1;
      if (!Number.isInteger(index) || !options[index]) return;
      selected = options[index];
    }
    const update = await fetch("/api/admin/issues", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId: id, resolution: "assigned", sessionId: selected.sessionId, stockBatchId: selected.stockBatchId })
    });
    if (update.ok) setIssues((items) => items.map((item) => item.id === id ? { ...item, status: "accepted" } : item));
  }
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a847e]" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issue" className="h-10 w-full rounded-xl border border-[#dfe5e1] bg-white pl-10 pr-3 text-sm outline-none" /></div>
      {loading && <Card className="py-14 text-center text-sm text-[#7a847e]">Loading issues…</Card>}
      {!loading && open.length === 0 && <Card className="py-14 text-center"><Check className="mx-auto mb-3 text-[#18794e]" size={30} /><p className="font-black">{query ? "No matching issues" : "Issue queue is clear"}</p><p className="mt-1 text-sm text-[#7a847e]">{query ? "Try another search." : "All problematic sync entries have been reviewed."}</p></Card>}
      {open.map((issue) => (
        <Card key={issue.id} className="overflow-hidden">
          <div className="flex items-start gap-4 p-5">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${issue.severity === "error" ? "bg-[#fff0ee] text-[#b42318]" : "bg-[#fff6df] text-[#b45309]"}`}>{issue.severity === "error" ? <ShieldAlert size={21} /> : <AlertTriangle size={21} />}</span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={issue.severity === "error" ? "red" : "amber"}>{issue.code.replaceAll("_", " ")}</Badge>{issue.createdAt && <span className="text-xs text-[#7a847e]">Received {formatTime(issue.createdAt)}</span>}</div>
              <p className="font-bold">{issue.message}</p>
              <p className="mt-2 font-mono text-xs text-[#7a847e]">Local ID: {issue.localEntryId}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ece9] bg-[#fbfcfb] px-5 py-3">
            {issue.code === "barcode_not_found" && <Button variant="secondary" size="sm" onClick={() => void assign(issue.id)}><Link2 size={14} /> Assign product & session</Button>}
            <Button variant="secondary" size="sm" onClick={() => void resolve(issue.id, "corrected")}><Pencil size={14} /> Correct</Button>
            <Button variant="ghost" size="sm" className="text-[#b42318]" onClick={() => void resolve(issue.id, "voided")}><Trash2 size={14} /> Void</Button>
            <Button size="sm" onClick={() => void resolve(issue.id, "accepted")}><Check size={14} /> Accept</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
