"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, LoaderCircle, Lock, MoreHorizontal, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { PageHeading } from "@/components/admin/page-heading";
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
  const demoStaff = [{ id: "demo-staff", full_name: "Demo Staff", email: "staff@demo.local", phone: null }];
  const [sessionData, setSessionData] = useState(session);
  const [closed, setClosed] = useState(session.status === "closed");
  const [products, setProducts] = useState<Product[]>(isDemo ? demoProducts.filter((product) => session.productIds.includes(product.id)) : []);
  const [entries, setEntries] = useState<CountEntry[]>(isDemo ? demoEntries.filter((entry) => entry.sessionId === session.id) : []);
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string; email: string; phone: string | null }>>(isDemo ? demoStaff : []);
  const [showPeople, setShowPeople] = useState(false);
  const [peopleSaving, setPeopleSaving] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(session.name);
  const [nameError, setNameError] = useState("");

  async function refreshSession() {
    const response = await fetch(`/api/admin/sessions/${session.id}`);
    if (!response.ok) return;
    const data = await response.json();
    setSessionData(data.session);
    setClosed(data.session.status === "closed");
    setProducts(data.products);
    setEntries(data.entries);
  }

  useEffect(() => {
    if (!isDemo) void Promise.all([
      refreshSession(),
      fetch("/api/admin/users").then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setStaff(data.users.filter((user: { role: string }) => user.role === "staff"));
      })
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function addPeople(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assigneeIds = new FormData(event.currentTarget).getAll("assignees").map(String);
    if (!assigneeIds.length) return setPeopleError("Select at least one staff member.");
    setPeopleSaving(true);
    setPeopleError("");
    try {
      if (isDemo) {
        const names = staff.filter((person) => assigneeIds.includes(person.id)).map((person) => person.full_name);
        setSessionData((current) => ({
          ...current,
          assignees: [...current.assignees, ...names],
          assigneeIds: [...(current.assigneeIds ?? []), ...assigneeIds]
        }));
      } else {
        const response = await fetch(`/api/admin/sessions/${session.id}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeIds })
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not add people.");
        await refreshSession();
      }
      setShowPeople(false);
    } catch (reason) {
      setPeopleError(reason instanceof Error ? reason.message : "Could not add people.");
    } finally {
      setPeopleSaving(false);
    }
  }

  async function saveName() {
    const name = draftName.trim();
    setEditingName(false);
    if (!name || name === sessionData.name) {
      setDraftName(sessionData.name);
      return;
    }

    setNameError("");
    if (isDemo) {
      setSessionData((current) => ({ ...current, name }));
      setDraftName(name);
      return;
    }

    const response = await fetch(`/api/admin/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json() as { error?: string; name?: string };
    if (!response.ok) {
      setDraftName(sessionData.name);
      setNameError(data.error || "Could not rename the session.");
      return;
    }
    const savedName = data.name ?? name;
    setSessionData((current) => ({ ...current, name: savedName }));
    setDraftName(savedName);
  }

  const availableStaff = staff.filter((person) => !(sessionData.assigneeIds ?? []).includes(person.id));

  return (
    <>
      <PageHeading
        eyebrow="Session review"
        title={editingName ? (
          <input
            autoFocus
            aria-label="Session name"
            className="min-w-0 max-w-full rounded-lg border border-[#9fcab2] bg-white px-2 py-1 text-2xl font-black tracking-tight outline-none ring-2 ring-[#18794e]/15 sm:text-3xl"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraftName(sessionData.name);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="rounded-md text-left hover:text-[#18794e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18794e]/30"
            title="Click to edit session name"
            onClick={() => {
              setDraftName(sessionData.name);
              setNameError("");
              setEditingName(true);
            }}
          >
            {sessionData.name}
          </button>
        )}
        description="Review the additive count total, investigate variances, and close only when the team has finished syncing."
      />
      {nameError && <div className="-mt-5 mb-5 flex gap-2 rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b]"><AlertCircle size={17} />{nameError}</div>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Badge tone={closed ? "neutral" : "green"}>{closed ? "closed" : "open"}</Badge><span className="text-xs font-semibold text-[#68726c]"><Users className="mr-1 inline" size={14} />{sessionData.assignees.join(", ")}</span></div><p className="mt-2 text-xs text-[#7a847e]">Master: {sessionData.masterFileName}</p></div>
        <div className="flex flex-wrap gap-2">
          {!closed && <Button variant="secondary" onClick={() => { setShowPeople(true); setPeopleError(""); }}><Plus size={16} /> Add people</Button>}
          <ExportButton sessionId={session.id} products={products} entries={entries} />
          <Button variant="danger" disabled={closed} onClick={() => void closeSession()}><Lock size={16} /> {closed ? "Session closed" : "Close session"}</Button>
        </div>
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

      {showPeople && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-[#172019]/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
          <Card className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-b-none p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-black">Add people</h2><p className="mt-1 text-sm text-[#68726c]">{sessionData.name}</p></div>
              <button type="button" onClick={() => setShowPeople(false)} className="grid size-9 place-items-center rounded-full bg-[#eef1ef]" aria-label="Close"><X size={17} /></button>
            </div>
            {availableStaff.length ? (
              <form onSubmit={addPeople} className="space-y-4">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-bold">Select additional staff</legend>
                  <div className="max-h-60 space-y-1 overflow-auto rounded-xl border border-[#dfe5e1] p-2">
                    {availableStaff.map((person) => (
                      <label key={person.id} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-[#f4f7f5]">
                        <input name="assignees" value={person.id} type="checkbox" />
                        <span><b>{person.full_name}</b><span className="ml-2 text-xs text-[#7a847e]">{person.phone || person.email}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {peopleError && <div className="flex gap-2 rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b]"><AlertCircle size={17} />{peopleError}</div>}
                <Button className="w-full" type="submit" disabled={peopleSaving}>
                  {peopleSaving ? <LoaderCircle className="animate-spin" /> : <Plus size={16} />}
                  {peopleSaving ? "Adding…" : "Add selected people"}
                </Button>
              </form>
            ) : (
              <div className="rounded-xl bg-[#eef2ef] p-4 text-sm text-[#56615b]">Everyone is already assigned to this session.</div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
