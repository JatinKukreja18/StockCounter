"use client";

import { useState } from "react";
import { AlertTriangle, Check, Link2, Pencil, Search, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoIssues } from "@/lib/demo-data";
import type { SyncIssue } from "@/lib/types";

export function IssuesQueue() {
  const [issues, setIssues] = useState(demoIssues);
  const open = issues.filter((issue) => issue.status === "open");
  function resolve(id: string, status: SyncIssue["status"]) {
    setIssues((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  }
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a847e]" size={17} /><input placeholder="Search barcode or issue" className="h-10 w-full rounded-xl border border-[#dfe5e1] bg-white pl-10 pr-3 text-sm outline-none" /></div>
      {open.length === 0 && <Card className="py-14 text-center"><Check className="mx-auto mb-3 text-[#18794e]" size={30} /><p className="font-black">Issue queue is clear</p><p className="mt-1 text-sm text-[#7a847e]">All problematic sync entries have been reviewed.</p></Card>}
      {issues.map((issue) => issue.status === "open" ? (
        <Card key={issue.id} className="overflow-hidden">
          <div className="flex items-start gap-4 p-5">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${issue.severity === "error" ? "bg-[#fff0ee] text-[#b42318]" : "bg-[#fff6df] text-[#b45309]"}`}>{issue.severity === "error" ? <ShieldAlert size={21} /> : <AlertTriangle size={21} />}</span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={issue.severity === "error" ? "red" : "amber"}>{issue.code.replaceAll("_", " ")}</Badge><span className="text-xs text-[#7a847e]">Received 8 minutes ago</span></div>
              <p className="font-bold">{issue.message}</p>
              <p className="mt-2 font-mono text-xs text-[#7a847e]">Local ID: {issue.localEntryId}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ece9] bg-[#fbfcfb] px-5 py-3">
            {issue.code === "barcode_not_found" && <Button variant="secondary" size="sm"><Link2 size={14} /> Assign product & session</Button>}
            <Button variant="secondary" size="sm" onClick={() => resolve(issue.id, "corrected")}><Pencil size={14} /> Correct</Button>
            <Button variant="ghost" size="sm" className="text-[#b42318]" onClick={() => resolve(issue.id, "voided")}><Trash2 size={14} /> Void</Button>
            <Button size="sm" onClick={() => resolve(issue.id, "accepted")}><Check size={14} /> Accept</Button>
          </div>
        </Card>
      ) : null)}
    </div>
  );
}
