"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  CloudOff,
  History,
  LoaderCircle,
  MapPin,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCountedBatchIds,
  indexActiveCountQuantities,
  indexUnsyncedCountQuantities
} from "@/lib/counting";
import { demoEntries, demoProducts, demoSessions } from "@/lib/demo-data";
import {
  cacheProducts,
  deleteLocalEntry,
  getCachedProducts,
  getDeviceId,
  getLocalEntries,
  getMeta,
  saveLocalEntry,
  setMeta,
  updateLocalEntry
} from "@/lib/local-db";
import type { CountEntry, CountSession, LocalCountEntry, Product, StockBatch, SyncEntryResult } from "@/lib/types";
import { isDemoMode } from "@/lib/runtime";
import { formatNumber, formatTime, makeId } from "@/lib/utils";

const presets = [1, 2, 5, 10];

export function CountingScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [serverEntries, setServerEntries] = useState<CountEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [entries, setEntries] = useState<LocalCountEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [area, setArea] = useState("Aisle 1");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [tab, setTab] = useState<"count" | "uncounted" | "queue">("count");
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const isDemo = isDemoMode();

  const refreshEntries = useCallback(async () => setEntries(await getLocalEntries()), []);
  const refreshServerData = useCallback(async () => {
    if (isDemo) {
      setSessions(demoSessions);
      setProducts(demoProducts);
      setServerEntries(demoEntries);
      setActiveSessionId((value) => value || demoSessions[0].id);
      await cacheProducts(demoProducts);
      return;
    }
    const response = await fetch("/api/staff/bootstrap", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load assigned sessions.");
    const data = await response.json() as { sessions: CountSession[]; products: Product[]; entries: CountEntry[] };
    setSessions(data.sessions);
    setProducts(data.products);
    setServerEntries(data.entries);
    setActiveSessionId((value) => data.sessions.some((session) => session.id === value) ? value : data.sessions[0]?.id ?? "");
    await cacheProducts(data.products);
    await setMeta("assignedSessions", JSON.stringify(data.sessions));
  }, [isDemo]);

  useEffect(() => {
    async function hydrate() {
      try {
        await refreshServerData();
      } catch {
        setProducts(await getCachedProducts());
        const cachedSessions = await getMeta("assignedSessions");
        if (cachedSessions) {
          const parsed = JSON.parse(cachedSessions) as CountSession[];
          setSessions(parsed);
          setActiveSessionId(parsed[0]?.id ?? "");
        }
      }
      setLastSync((await getMeta("lastSync")) ?? null);
      await refreshEntries();
    }
    void hydrate();
    const setNetwork = () => setOnline(navigator.onLine);
    setNetwork();
    window.addEventListener("online", setNetwork);
    window.addEventListener("offline", setNetwork);
    return () => {
      window.removeEventListener("online", setNetwork);
      window.removeEventListener("offline", setNetwork);
    };
  }, [refreshEntries, refreshServerData]);

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return products.filter((product) =>
      activeSession?.productIds.includes(product.id) && (
        product.barcode.includes(value) ||
        product.sku.toLowerCase().includes(value) ||
        product.name.toLowerCase().includes(value)
      )
    ).slice(0, 5);
  }, [activeSession, products, query]);

  const pending = entries.filter((entry) => entry.syncState === "pending" || entry.syncState === "failed");
  const activeSessionIdForCounts = activeSession?.id ?? "";
  const serverCountsByBatch = useMemo(
    () => indexActiveCountQuantities(serverEntries, activeSessionIdForCounts),
    [activeSessionIdForCounts, serverEntries]
  );
  const localCountsByBatch = useMemo(
    () => indexUnsyncedCountQuantities(entries, activeSessionIdForCounts),
    [activeSessionIdForCounts, entries]
  );
  const selectedServerCount = selected
    ? serverCountsByBatch.get(selectedBatch?.id ?? "") ?? 0
    : 0;
  const selectedLocalCount = selected
    ? localCountsByBatch.get(selectedBatch?.id ?? "") ?? 0
    : 0;
  const countedQty = selectedServerCount + selectedLocalCount;
  const systemQty = selectedBatch?.systemQty ?? selected?.systemQty ?? 0;
  const countedBatchIds = useMemo(
    () => getCountedBatchIds(serverEntries, entries, activeSessionIdForCounts),
    [activeSessionIdForCounts, entries, serverEntries]
  );
  const sessionProducts = products.filter((product) => activeSession?.productIds.includes(product.id));
  const incompleteProducts = sessionProducts.filter((product) => product.batches.some((batch) => !countedBatchIds.has(batch.id)));

  function chooseProduct(product: Product) {
    setSelected(product);
    setSelectedBatch(product.batches.length === 1 ? product.batches[0] : null);
    setQuery("");
    setQuantity(1);
    setNotice(null);
  }

  function handleBarcode(barcode: string) {
    setQuery(barcode);
    const match = products.find((product) => activeSession?.productIds.includes(product.id) && product.barcode === barcode);
    if (match) chooseProduct(match);
    else setNotice({ tone: "red", text: `Barcode ${barcode} is not in the cached stock list.` });
  }

  async function saveCount() {
    if (!activeSession || !selected || !selectedBatch || quantity <= 0) return;
    const now = new Date().toISOString();
    const entry: LocalCountEntry = {
      localEntryId: makeId(),
      sessionId: activeSession.id,
      productId: selected.id,
      barcode: selected.barcode,
      sku: selected.sku,
      productName: selected.name,
      stockBatchId: selectedBatch.id,
      batchNo: selectedBatch.batchNo,
      inwardTranno: selectedBatch.inwardTranno,
      expiryDate: selectedBatch.expiryDate,
      quantity,
      area,
      deviceId: await getDeviceId(),
      createdAt: now,
      updatedAt: now,
      stockVersion: selectedBatch.stockVersion,
      syncState: "pending"
    };
    await saveLocalEntry(entry);
    await refreshEntries();
    setNotice({ tone: "green", text: `Added ${quantity} × ${selected.name} · ${selectedBatch.expiryDate ? `exp ${selectedBatch.expiryDate}` : "no expiry"}. Saved on this device.` });
    setQuantity(1);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function syncNow() {
    if (!pending.length || syncing) return;
    if (!navigator.onLine) {
      setNotice({ tone: "red", text: "No connection. Your entries are safe on this device—try again when online." });
      return;
    }
    setSyncing(true);
    setNotice(null);
    await Promise.all(pending.map((entry) => updateLocalEntry(entry.localEntryId, { syncState: "syncing" })));
    await refreshEntries();
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: pending })
      });
      if (!response.ok) throw new Error("Sync request failed");
      const data = (await response.json()) as { results: SyncEntryResult[]; syncedAt: string };
      await Promise.all(data.results.map((result) => updateLocalEntry(result.localEntryId, result.status === "issue"
        ? { syncState: "failed", syncError: result.issue?.message }
        : { syncState: "synced", serverEntryId: result.serverEntryId, syncError: undefined }
      )));
      await setMeta("lastSync", data.syncedAt);
      setLastSync(data.syncedAt);
      const failed = data.results.filter((result) => result.status === "issue").length;
      setNotice(failed
        ? { tone: "red", text: `${data.results.length - failed} synced. ${failed} need attention and remain on this device.` }
        : { tone: "green", text: `${data.results.length} ${data.results.length === 1 ? "entry" : "entries"} synced successfully.` }
      );
      await refreshServerData();
    } catch {
      await Promise.all(pending.map((entry) => updateLocalEntry(entry.localEntryId, {
        syncState: "failed",
        syncError: "Could not reach the server. Tap sync to retry."
      })));
      setNotice({ tone: "red", text: "Sync failed. Nothing was lost—tap Sync to retry." });
    } finally {
      setSyncing(false);
      await refreshEntries();
    }
  }

  return (
    <div className="mx-auto min-h-[calc(100dvh-4rem)] max-w-xl px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#7a847e]">Tonight&apos;s count</p>
          {sessions.length > 1 ? <select value={activeSession?.id} onChange={(event) => { setActiveSessionId(event.target.value); setSelected(null); }} className="max-w-[250px] bg-transparent text-xl font-black tracking-tight outline-none">{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select> : <h1 className="text-xl font-black tracking-tight">{activeSession?.name ?? "No assigned session"}</h1>}
        </div>
        <Badge tone={online ? "green" : "amber"} className="gap-1.5">
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? "Online" : "Offline"}
        </Badge>
      </div>

      <div className="mb-5 grid grid-cols-3 rounded-xl bg-[#e9ecea] p-1">
        <button onClick={() => setTab("count")} className={`h-10 rounded-lg text-sm font-bold transition ${tab === "count" ? "bg-white text-[#18211d] shadow-sm" : "text-[#68726c]"}`}>Count stock</button>
        <button onClick={() => setTab("uncounted")} className={`h-10 rounded-lg text-sm font-bold transition ${tab === "uncounted" ? "bg-white text-[#18211d] shadow-sm" : "text-[#68726c]"}`}>
          Uncounted
          {incompleteProducts.length > 0 && <span className="ml-1.5 rounded-full bg-[#68726c] px-1.5 py-0.5 text-[9px] text-white">{incompleteProducts.length}</span>}
        </button>
        <button onClick={() => setTab("queue")} className={`relative h-10 rounded-lg text-sm font-bold transition ${tab === "queue" ? "bg-white text-[#18211d] shadow-sm" : "text-[#68726c]"}`}>
          Entries
          {pending.length > 0 && <span className="ml-2 rounded-full bg-[#b45309] px-2 py-0.5 text-[10px] text-white">{pending.length}</span>}
        </button>
      </div>

      {notice && (
        <div className={`animate-enter mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold ${notice.tone === "green" ? "border-[#bfe4cf] bg-[#e9f6ef] text-[#12673f]" : "border-[#f2c4bf] bg-[#fff0ee] text-[#9e251b]"}`}>
          {notice.tone === "green" ? <Check className="mt-0.5 shrink-0" size={17} /> : <AlertCircle className="mt-0.5 shrink-0" size={17} />}
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {tab === "count" ? (
        <div className="animate-enter">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a847e]" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Barcode, SKU or product name"
              inputMode="search"
              className="h-14 w-full rounded-2xl border border-[#dfe5e1] bg-white pl-12 pr-14 text-base font-medium outline-none focus:border-[#63a982] focus:ring-4 focus:ring-[#18794e]/10"
            />
            <button onClick={() => setScannerOpen(true)} className="absolute right-2 top-2 grid size-10 place-items-center rounded-xl bg-[#18211d] text-white" aria-label="Scan barcode"><ScanLine size={21} /></button>
            {matches.length > 0 && (
              <div className="absolute inset-x-0 top-[3.8rem] z-30 overflow-hidden rounded-2xl border border-[#dfe5e1] bg-white shadow-xl">
                {matches.map((product) => (
                  <button key={product.id} onClick={() => chooseProduct(product)} className="flex w-full items-center gap-3 border-b border-[#eef1ef] px-4 py-3 text-left last:border-0 hover:bg-[#f7f9f7]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf5f0] text-[#18794e]"><PackageCheck size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{product.name}</span>
                      <span className="block text-xs text-[#7a847e]">{product.sku} · {product.barcode}</span>
                    </span>
                    <ChevronRight size={16} className="text-[#9aa29d]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selected ? (
            <Card className="mt-8 border-dashed bg-white/60 px-6 py-12 text-center shadow-none">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#e9f6ef] text-[#18794e]"><ScanLine size={27} /></div>
              <h2 className="font-bold">Scan or search an item</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#7a847e]">Products are cached on this phone, so finding an item works even without Wi-Fi.</p>
              <Button onClick={() => setScannerOpen(true)} className="mt-5"><ScanLine size={18} /> Open camera</Button>
            </Card>
          ) : (
            <Card className="mt-5 overflow-hidden">
              <div className="border-b border-[#e8ece9] bg-[#fbfcfb] p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="green" className="mb-2">{selected.category}</Badge>
                    <h2 className="text-xl font-black leading-tight">{selected.name}</h2>
                  </div>
                  <button onClick={() => { setSelected(null); setSelectedBatch(null); }} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef1ef] text-[#68726c]"><X size={17} /></button>
                </div>
                <p className="text-xs font-medium text-[#7a847e]">{selected.sku} · {selected.barcode}</p>
              </div>

              <div className="border-b border-[#e8ece9] p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[.08em] text-[#68726c]">
                  {selected.batches.length > 1 ? "Choose the batch / expiry you are counting" : "Batch / expiry"}
                </p>
                <div className="grid gap-2">
                  {selected.batches.map((batch) => {
                    const active = selectedBatch?.id === batch.id;
                    return (
                      <button key={batch.id} onClick={() => setSelectedBatch(batch)} className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${active ? "border-[#52a174] bg-[#e9f6ef] ring-2 ring-[#18794e]/10" : "border-[#dfe5e1] bg-white"}`}>
                        <span>
                          <span className="flex items-center gap-1.5 text-sm font-black"><CalendarDays size={15} /> {batch.expiryDate ? `Expires ${batch.expiryDate}` : "No expiry recorded"}</span>
                          <span className="mt-1 block text-xs text-[#68726c]">{batch.batchNo || batch.inwardTranno || "Unlabelled GoFrugal batch"}</span>
                        </span>
                        <span className="text-right"><span className="block text-[10px] font-bold uppercase text-[#7a847e]">System</span><span className="tabular text-lg font-black">{formatNumber(batch.systemQty)}</span></span>
                      </button>
                    );
                  })}
                </div>
                {!selectedBatch && <p className="mt-2 text-xs font-bold text-[#b45309]">Select the expiry printed on the physical stock before entering quantity.</p>}
              </div>

              <div className="grid grid-cols-3 border-b border-[#e8ece9]">
                {[
                  ["Batch system", systemQty],
                  ["Counted", countedQty],
                  ["Difference", countedQty - systemQty]
                ].map(([label, value]) => (
                  <div key={label} className="border-r border-[#e8ece9] p-4 text-center last:border-r-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#7a847e]">{label}</p>
                    <p className={`tabular text-xl font-black ${label === "Difference" && Number(value) !== 0 ? "text-[#b45309]" : ""}`}>{Number(value) > 0 && label === "Difference" ? "+" : ""}{formatNumber(Number(value))}</p>
                  </div>
                ))}
              </div>

              <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-bold">Add quantity</label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[#68726c]">
                    <MapPin size={13} />
                    <select value={area} onChange={(event) => setArea(event.target.value)} className="bg-transparent outline-none">
                      <option>Aisle 1</option><option>Aisle 2</option><option>Aisle 3</option><option>Back stock</option><option>Display</option>
                    </select>
                  </label>
                </div>
                <div className="mb-3 flex h-16 items-center rounded-2xl border-2 border-[#dfe5e1]">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-full w-16 place-items-center text-[#18794e]" aria-label="Subtract one"><Minus /></button>
                  <input value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} type="number" min="1" inputMode="decimal" className="tabular h-full min-w-0 flex-1 border-x border-[#e4e8e5] text-center text-3xl font-black outline-none" />
                  <button onClick={() => setQuantity((value) => value + 1)} className="grid h-full w-16 place-items-center text-[#18794e]" aria-label="Add one"><Plus /></button>
                </div>
                <div className="mb-5 grid grid-cols-4 gap-2">
                  {presets.map((preset) => <button key={preset} onClick={() => setQuantity((value) => value + preset)} className="h-11 rounded-xl bg-[#eef2ef] text-sm font-black text-[#445049] active:bg-[#dce9e1]">+{preset}</button>)}
                </div>
                <Button size="lg" className="w-full" onClick={saveCount} disabled={!selectedBatch}><PackageCheck size={20} /> Save this batch on device</Button>
                <p className="mt-2 text-center text-[11px] text-[#7a847e]">Instant save · no internet required</p>
              </div>
            </Card>
          )}
        </div>
      ) : tab === "uncounted" ? (
        <div className="animate-enter">
          <div className="mb-3">
            <h2 className="font-black">Still to count</h2>
            <p className="text-xs text-[#7a847e]">A product stays here until every expiry batch in this session has an entry.</p>
          </div>
          {incompleteProducts.length === 0 ? (
            <Card className="py-12 text-center shadow-none"><Check className="mx-auto mb-3 text-[#18794e]" /><p className="font-bold">Every product has been counted</p></Card>
          ) : (
            <div className="space-y-3">
              {incompleteProducts.map((product) => {
                const remaining = product.batches.filter((batch) => !countedBatchIds.has(batch.id));
                const partial = remaining.length < product.batches.length;
                return (
                  <button key={product.id} onClick={() => { chooseProduct(product); setTab("count"); }} className="w-full text-left">
                    <Card className="flex items-center gap-3 p-4 shadow-none transition hover:border-[#63a982]">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${partial ? "bg-[#fff6df] text-[#b45309]" : "bg-[#eef1ef] text-[#68726c]"}`}><PackageCheck size={19} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{product.name}</span><span className="mt-1 block text-xs text-[#7a847e]">{product.sku} · {remaining.length} of {product.batches.length} batches remaining</span></span>
                      <Badge tone={partial ? "amber" : "neutral"}>{partial ? "Partial" : "Uncounted"}</Badge>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-enter space-y-3">
          {entries.length === 0 ? (
            <Card className="py-12 text-center shadow-none"><History className="mx-auto mb-3 text-[#9aa29d]" /><p className="font-bold">No entries on this device yet</p></Card>
          ) : entries.map((entry) => (
            <Card key={entry.localEntryId} className="p-4 shadow-none">
              <div className="flex items-start gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${entry.syncState === "synced" ? "bg-[#e9f6ef] text-[#18794e]" : entry.syncState === "failed" ? "bg-[#fff0ee] text-[#b42318]" : "bg-[#fff6df] text-[#b45309]"}`}>
                  {entry.syncState === "synced" ? <Check size={18} /> : entry.syncState === "failed" ? <CloudOff size={18} /> : <RefreshCw size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="truncate text-sm font-bold">{entry.productName}</p>
                    <p className="tabular text-base font-black">+{formatNumber(entry.quantity)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#7a847e]">{entry.area} · {formatTime(entry.createdAt)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#526059]">{entry.expiryDate ? `Expiry ${entry.expiryDate}` : "No expiry"} · {entry.batchNo || entry.inwardTranno || "Unlabelled batch"}</p>
                  {entry.syncError && <p className="mt-2 text-xs font-semibold text-[#b42318]">{entry.syncError}</p>}
                </div>
              </div>
              {entry.syncState !== "synced" && entry.syncState !== "syncing" && (
                <div className="mt-3 flex justify-end gap-2 border-t border-[#eef1ef] pt-3">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const next = window.prompt("Correct quantity", String(entry.quantity));
                    if (next && Number(next) > 0) void updateLocalEntry(entry.localEntryId, { quantity: Number(next), syncState: "pending", syncError: undefined }).then(refreshEntries);
                  }}><Pencil size={14} /> Edit</Button>
                  <Button variant="ghost" size="sm" className="text-[#b42318]" onClick={() => void deleteLocalEntry(entry.localEntryId).then(refreshEntries)}><Trash2 size={14} /> Undo</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5e1] bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{pending.length} unsynced</p>
            <p className="truncate text-[11px] text-[#7a847e]">Last sync: {formatTime(lastSync)}</p>
          </div>
          <Button size="lg" className="min-w-40 text-base" disabled={!pending.length || syncing} onClick={syncNow}>
            {syncing ? <LoaderCircle className="animate-spin" /> : online ? <RefreshCw /> : <WifiOff />}
            {syncing ? "SYNCING…" : pending.some((entry) => entry.syncState === "failed") ? "RETRY SYNC" : "SYNC NOW"}
          </Button>
        </div>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcode} />
    </div>
  );
}
