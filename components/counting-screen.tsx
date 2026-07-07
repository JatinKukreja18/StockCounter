"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
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
import { useStaffBootstrap } from "@/hooks/use-staff-bootstrap";
import {
  getCountedProductIds,
  indexActiveProductCountQuantities,
  indexUnsyncedProductCountQuantities
} from "@/lib/counting";
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
import type {
  CountEntry,
  CountSession,
  LocalCountEntry,
  Product,
  StockBatch
} from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatNumber, formatTime, makeId } from "@/lib/utils";

const presets = [1, 2, 5, 10];

type Notice = {
  tone: "green" | "red";
  text: string;
  undoLocalEntryId?: string;
};

export function CountingScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [serverEntries, setServerEntries] = useState<CountEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [entries, setEntries] = useState<LocalCountEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [area, setArea] = useState("Aisle 1");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [countedOpen, setCountedOpen] = useState(false);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [correctingTotal, setCorrectingTotal] = useState(false);
  const [correctedTotal, setCorrectedTotal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hardwareScanRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const { loadBootstrap, syncEntries } = useStaffBootstrap();

  const getCacheOwnerId = useCallback(async () => {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    return data.session?.user.id ?? null;
  }, []);

  const refreshEntries = useCallback(
    async () => setEntries(await getLocalEntries()),
    []
  );
  const refreshServerData = useCallback(async () => {
    const data = await loadBootstrap();
    setSessions(data.sessions);
    setProducts(data.products);
    setServerEntries(data.entries);
    setActiveSessionId((value) =>
      data.sessions.some((session) => session.id === value)
        ? value
        : (data.sessions[0]?.id ?? "")
    );
    await cacheProducts(data.products, data.userId);
    await setMeta(
      `assignedSessions:${data.userId}`,
      JSON.stringify(data.sessions)
    );
  }, [loadBootstrap]);

  useEffect(() => {
    async function hydrate() {
      try {
        await refreshServerData();
      } catch {
        const ownerId = await getCacheOwnerId();
        const cachedSessions = ownerId
          ? await getMeta(`assignedSessions:${ownerId}`)
          : undefined;
        if (cachedSessions) {
          setProducts(await getCachedProducts(ownerId!));
          const parsed = JSON.parse(cachedSessions) as CountSession[];
          setSessions(parsed);
          setActiveSessionId(parsed[0]?.id ?? "");
        } else {
          setSessions([]);
          setProducts([]);
          setActiveSessionId("");
          setNotice({
            tone: "red",
            text: "Could not load your assigned sessions. Check your connection and try again."
          });
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
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [getCacheOwnerId, refreshEntries, refreshServerData]);

  const pending = entries.filter(
    (entry) => entry.syncState === "pending" || entry.syncState === "failed"
  );
  const activeSessionIdForCounts = activeSession?.id ?? "";
  const serverCountsByProduct = useMemo(
    () =>
      indexActiveProductCountQuantities(
        serverEntries,
        activeSessionIdForCounts
      ),
    [activeSessionIdForCounts, serverEntries]
  );
  const localCountsByProduct = useMemo(
    () =>
      indexUnsyncedProductCountQuantities(entries, activeSessionIdForCounts),
    [activeSessionIdForCounts, entries]
  );
  const countedProductIds = useMemo(
    () =>
      getCountedProductIds(serverEntries, entries, activeSessionIdForCounts),
    [activeSessionIdForCounts, entries, serverEntries]
  );
  const sessionProducts = useMemo(
    () =>
      products.filter((product) =>
        activeSession?.productIds.includes(product.id)
      ),
    [activeSession, products]
  );
  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return sessionProducts;
    return sessionProducts.filter(
      (product) =>
        product.barcode.toLowerCase().includes(value) ||
        product.sku.toLowerCase().includes(value) ||
        product.name.toLowerCase().includes(value)
    );
  }, [query, sessionProducts]);
  const incompleteProducts = filteredProducts.filter(
    (product) => !countedProductIds.has(product.id)
  );
  const completedProducts = filteredProducts.filter((product) =>
    countedProductIds.has(product.id)
  );
  const totalIncompleteProducts = sessionProducts.filter(
    (product) => !countedProductIds.has(product.id)
  ).length;
  const activeSessionEntries = entries.filter(
    (entry) => entry.sessionId === activeSessionIdForCounts
  );
  const selectedServerCount = selected
    ? (serverCountsByProduct.get(selected.id) ?? 0)
    : 0;
  const selectedLocalCount = selected
    ? (localCountsByProduct.get(selected.id) ?? 0)
    : 0;
  const countedQty = selectedServerCount + selectedLocalCount;
  const systemQty = selected?.systemQty ?? 0;
  const selectedEditableEntries = selected
    ? entries.filter(
        (entry) =>
          entry.sessionId === activeSessionIdForCounts &&
          entry.productId === selected.id &&
          (entry.syncState === "pending" || entry.syncState === "failed")
      )
    : [];

  function showTemporaryNotice(nextNotice: Notice) {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice(nextNotice);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
  }

  function chooseProduct(product: Product, fromHardwareScanner = false) {
    hardwareScanRef.current = fromHardwareScanner;
    setSelected(product);
    setSelectedBatch(product.batches[0] ?? null);
    setQuantity(0);
    setCorrectingTotal(false);
    setNotice(null);
  }

  function submitBarcode(rawBarcode: string, fromHardwareScanner: boolean) {
    const barcode = rawBarcode.trim();
    if (!barcode || !activeSession) return;

    const activeMatch = sessionProducts.find(
      (product) => product.barcode === barcode
    );
    if (activeMatch) {
      chooseProduct(activeMatch, fromHardwareScanner);
      return;
    }

    const matchingProduct = products.find(
      (product) => product.barcode === barcode
    );
    if (matchingProduct) {
      const otherSessions = sessions.filter(
        (session) =>
          session.id !== activeSession.id &&
          session.productIds.includes(matchingProduct.id)
      );
      const destination = otherSessions
        .map((session) => session.name)
        .join(", ");
      setNotice({
        tone: "red",
        text: destination
          ? `${matchingProduct.name} is not in ${activeSession.name}. Switch to ${destination} to count it.`
          : `${matchingProduct.name} is not part of ${activeSession.name}.`
      });
      return;
    }

    setNotice({
      tone: "red",
      text: `Barcode ${barcode} was not found in the cached product list.`
    });
  }

  function handleBarcode(barcode: string) {
    setQuery(barcode);
    submitBarcode(barcode, false);
  }

  function closeProduct() {
    setSelected(null);
    setSelectedBatch(null);
    setCorrectingTotal(false);
    hardwareScanRef.current = false;
  }

  async function saveCount() {
    if (!activeSession || !selected || !selectedBatch || quantity < 0) return;
    const savedProductName = selected.name;
    const savedQuantity = quantity;
    const localEntryId = makeId();
    const shouldRefocusScanner = hardwareScanRef.current;
    const now = new Date().toISOString();
    const entry: LocalCountEntry = {
      localEntryId,
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
    setSelected(null);
    setSelectedBatch(null);
    setQuantity(0);
    setQuery("");
    showTemporaryNotice({
      tone: "green",
      text: `Added ${savedQuantity} × ${savedProductName}. Saved on this device.`,
      undoLocalEntryId: localEntryId
    });
    if (shouldRefocusScanner) {
      window.requestAnimationFrame(() =>
        searchInputRef.current?.focus({ preventScroll: true })
      );
    }
  }

  async function undoSavedCount(localEntryId: string) {
    await deleteLocalEntry(localEntryId);
    await refreshEntries();
    showTemporaryNotice({ tone: "green", text: "The saved count was undone." });
  }

  async function correctUnsyncedProductTotal(targetTotal: number) {
    if (!selected || !selectedEditableEntries.length) return;
    if (!Number.isFinite(targetTotal) || targetTotal < 0) {
      setNotice({
        tone: "red",
        text: "Enter a valid non-negative product total."
      });
      return;
    }

    const lockedLocalQuantity = entries
      .filter(
        (entry) =>
          entry.sessionId === activeSessionIdForCounts &&
          entry.productId === selected.id &&
          entry.syncState === "syncing"
      )
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const lockedTotal = selectedServerCount + lockedLocalQuantity;
    if (targetTotal < lockedTotal) {
      setNotice({
        tone: "red",
        text: `${formatNumber(lockedTotal)} is already synced or syncing. A lower total must be corrected by an administrator.`
      });
      return;
    }

    const editableTotal = selectedEditableEntries.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );
    const targetEditableTotal = targetTotal - lockedTotal;
    const difference = targetEditableTotal - editableTotal;
    if (difference === 0) {
      showTemporaryNotice({
        tone: "green",
        text: `${selected.name} is already at ${formatNumber(targetTotal)}.`
      });
      return;
    }

    if (difference > 0) {
      const latest = selectedEditableEntries[0];
      await updateLocalEntry(latest.localEntryId, {
        quantity: latest.quantity + difference,
        syncState: "pending",
        syncError: undefined
      });
    } else {
      let quantityToRemove = Math.abs(difference);
      for (const entry of selectedEditableEntries) {
        if (quantityToRemove === 0) break;
        if (entry.quantity <= quantityToRemove) {
          quantityToRemove -= entry.quantity;
          await deleteLocalEntry(entry.localEntryId);
        } else {
          await updateLocalEntry(entry.localEntryId, {
            quantity: entry.quantity - quantityToRemove,
            syncState: "pending",
            syncError: undefined
          });
          quantityToRemove = 0;
        }
      }
    }

    await refreshEntries();
    setQuantity(0);
    setCorrectingTotal(false);
    showTemporaryNotice({
      tone: "green",
      text: `${selected.name} corrected to a total of ${formatNumber(targetTotal)} on this device.`
    });
  }

  async function syncNow() {
    if (!pending.length || syncing) return;
    if (!navigator.onLine) {
      setNotice({
        tone: "red",
        text: "No connection. Your entries are safe on this device—try again when online."
      });
      return;
    }
    setSyncing(true);
    setNotice(null);
    await Promise.all(
      pending.map((entry) =>
        updateLocalEntry(entry.localEntryId, { syncState: "syncing" })
      )
    );
    await refreshEntries();
    try {
      const data = await syncEntries(pending);
      await Promise.all(
        data.results.map((result) =>
          updateLocalEntry(
            result.localEntryId,
            result.status === "issue"
              ? { syncState: "failed", syncError: result.issue?.message }
              : {
                  syncState: "synced",
                  serverEntryId: result.serverEntryId,
                  syncError: undefined
                }
          )
        )
      );
      await setMeta("lastSync", data.syncedAt);
      setLastSync(data.syncedAt);
      const failed = data.results.filter(
        (result) => result.status === "issue"
      ).length;
      setNotice(
        failed
          ? {
              tone: "red",
              text: `${data.results.length - failed} synced. ${failed} need attention and remain on this device.`
            }
          : {
              tone: "green",
              text: `${data.results.length} ${data.results.length === 1 ? "entry" : "entries"} synced successfully.`
            }
      );
      await refreshServerData();
    } catch {
      await Promise.all(
        pending.map((entry) =>
          updateLocalEntry(entry.localEntryId, {
            syncState: "failed",
            syncError: "Could not reach the server. Tap sync to retry."
          })
        )
      );
      setNotice({
        tone: "red",
        text: "Sync failed. Nothing was lost—tap Sync to retry."
      });
    } finally {
      setSyncing(false);
      await refreshEntries();
    }
  }

  function renderProductRow(product: Product, isCounted: boolean) {
    const productTotal =
      (serverCountsByProduct.get(product.id) ?? 0) +
      (localCountsByProduct.get(product.id) ?? 0);
    const hasLocalCount = (localCountsByProduct.get(product.id) ?? 0) > 0;
    return (
      <button
        key={product.id}
        onClick={() => chooseProduct(product)}
        className="w-full text-left"
      >
        <Card className="flex items-center gap-3 rounded-xl p-3.5 shadow-none transition hover:border-[#63a982] active:bg-[#f7f9f7]">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${isCounted ? "bg-[#e9f6ef] text-[#18794e]" : "bg-[#eef1ef] text-[#68726c]"}`}
          >
            {isCounted ? <Check size={19} /> : <PackageCheck size={19} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {product.name}
            </span>
            <span className="mt-1 block text-xs text-[#7a847e]">
              {product.sku} · {product.barcode}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {isCounted ? (
              <span className="text-right">
                <span className="block text-sm font-black">
                  {formatNumber(productTotal)}
                </span>
                <span
                  className={`block text-[10px] font-bold ${hasLocalCount ? "text-[#b45309]" : "text-[#18794e]"}`}
                >
                  {hasLocalCount ? "On device" : "Counted"}
                </span>
              </span>
            ) : (
              <Badge>Uncounted</Badge>
            )}
            <ChevronRight size={16} className="text-[#9aa29d]" />
          </span>
        </Card>
      </button>
    );
  }

  return (
    <div className="mx-auto min-h-[calc(100dvh-4rem)] max-w-xl px-4 pb-32 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#7a847e]">
            Tonight&apos;s count
          </p>
          {sessions.length > 1 ? (
            <select
              value={activeSession?.id}
              onChange={(event) => {
                setActiveSessionId(event.target.value);
                setSelected(null);
                setSelectedBatch(null);
                setQuery("");
              }}
              aria-label="Active count session"
              className="max-w-[260px] bg-transparent text-xl font-black tracking-tight outline-none"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="truncate text-xl font-black tracking-tight">
              {activeSession?.name ?? "No assigned session"}
            </h1>
          )}
        </div>
        <Badge tone={online ? "green" : "amber"} className="shrink-0 gap-1.5">
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? "Online" : "Offline"}
        </Badge>
      </div>

      {activeSession && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#edf5f0] px-4 py-3">
          <div>
            <p className="text-xs font-bold text-[#526059]">Session progress</p>
            <p className="text-sm font-black text-[#18794e]">
              {sessionProducts.length - totalIncompleteProducts} of{" "}
              {sessionProducts.length} products counted
            </p>
          </div>
          <span className="text-2xl font-black text-[#18794e]">
            {sessionProducts.length
              ? Math.round(
                  ((sessionProducts.length - totalIncompleteProducts) /
                    sessionProducts.length) *
                    100
                )
              : 0}
            %
          </span>
        </div>
      )}

      {notice && (
        <div
          className={`animate-enter mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold ${notice.tone === "green" ? "border-[#bfe4cf] bg-[#e9f6ef] text-[#12673f]" : "border-[#f2c4bf] bg-[#fff0ee] text-[#9e251b]"}`}
        >
          {notice.tone === "green" ? (
            <Check className="mt-0.5 shrink-0" size={17} />
          ) : (
            <AlertCircle className="mt-0.5 shrink-0" size={17} />
          )}
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.undoLocalEntryId && (
            <button
              onClick={() => void undoSavedCount(notice.undoLocalEntryId!)}
              className="shrink-0 font-black underline underline-offset-2"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => setNotice(null)}
            className="shrink-0"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="relative mb-5">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a847e]"
          size={20}
        />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitBarcode(query, true);
            }
          }}
          placeholder="Scan barcode or search products"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          className="h-14 w-full rounded-2xl border border-[#dfe5e1] bg-white pl-12 pr-14 text-base font-medium outline-none focus:border-[#63a982] focus:ring-4 focus:ring-[#18794e]/10"
        />
        <button
          onClick={() => setScannerOpen(true)}
          className="absolute right-2 top-2 grid size-10 place-items-center rounded-xl bg-[#18211d] text-white"
          aria-label="Scan with camera"
        >
          <ScanLine size={21} />
        </button>
      </div>

      {!activeSession ? (
        <Card className="border-dashed px-6 py-12 text-center shadow-none">
          <AlertCircle className="mx-auto mb-3 text-[#b45309]" />
          <p className="font-bold">No count session assigned</p>
          <p className="mt-2 text-sm text-[#7a847e]">
            Ask an administrator to add you to an open session.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-black">To count</h2>
                <p className="text-xs text-[#7a847e]">
                  Tap a product or scan its barcode.
                </p>
              </div>
              <Badge>
                {query ? incompleteProducts.length : totalIncompleteProducts}
              </Badge>
            </div>
            {incompleteProducts.length > 0 ? (
              <div className="space-y-2">
                {incompleteProducts.map((product) =>
                  renderProductRow(product, false)
                )}
              </div>
            ) : (
              <Card className="py-9 text-center shadow-none">
                <Check className="mx-auto mb-3 text-[#18794e]" />
                <p className="font-bold">
                  {query
                    ? "No uncounted products match"
                    : "Every product has been counted"}
                </p>
              </Card>
            )}
          </section>

          <section>
            <button
              onClick={() => setCountedOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-xl border border-[#dfe5e1] bg-white px-4 py-3 text-left"
              aria-expanded={countedOpen}
            >
              <span>
                <span className="block text-sm font-black">
                  Counted products
                </span>
                <span className="block text-xs text-[#7a847e]">
                  Reopen a product to add another count
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone="green">{completedProducts.length}</Badge>
                <ChevronDown
                  size={18}
                  className={`transition ${countedOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {countedOpen && (
              <div className="animate-enter mt-2 space-y-2">
                {completedProducts.length > 0 ? (
                  completedProducts.map((product) =>
                    renderProductRow(product, true)
                  )
                ) : (
                  <p className="py-4 text-center text-sm text-[#7a847e]">
                    No counted products match.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <button
              onClick={() => setEntriesOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-xl border border-[#dfe5e1] bg-white px-4 py-3 text-left"
              aria-expanded={entriesOpen}
            >
              <span>
                <span className="block text-sm font-black">Recent entries</span>
                <span className="block text-xs text-[#7a847e]">
                  Counts saved on this device for this session
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge>{activeSessionEntries.length}</Badge>
                <ChevronDown
                  size={18}
                  className={`transition ${entriesOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {entriesOpen && (
              <div className="animate-enter mt-2 space-y-2">
                {activeSessionEntries.length === 0 ? (
                  <Card className="py-8 text-center shadow-none">
                    <History className="mx-auto mb-3 text-[#9aa29d]" />
                    <p className="font-bold">No entries on this device yet</p>
                  </Card>
                ) : (
                  activeSessionEntries.map((entry) => (
                    <Card key={entry.localEntryId} className="p-4 shadow-none">
                      <div className="flex items-start gap-3">
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-xl ${entry.syncState === "synced" ? "bg-[#e9f6ef] text-[#18794e]" : entry.syncState === "failed" ? "bg-[#fff0ee] text-[#b42318]" : "bg-[#fff6df] text-[#b45309]"}`}
                        >
                          {entry.syncState === "synced" ? (
                            <Check size={18} />
                          ) : entry.syncState === "failed" ? (
                            <CloudOff size={18} />
                          ) : (
                            <RefreshCw size={18} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <p className="truncate text-sm font-bold">
                              {entry.productName}
                            </p>
                            <p className="tabular text-base font-black">
                              +{formatNumber(entry.quantity)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[#7a847e]">
                            {entry.area} · {formatTime(entry.createdAt)}
                          </p>
                          {entry.syncError && (
                            <p className="mt-2 text-xs font-semibold text-[#b42318]">
                              {entry.syncError}
                            </p>
                          )}
                        </div>
                      </div>
                      {entry.syncState !== "synced" &&
                        entry.syncState !== "syncing" && (
                          <div className="mt-3 flex justify-end gap-2 border-t border-[#eef1ef] pt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = window.prompt(
                                  "Correct quantity",
                                  String(entry.quantity)
                                );
                                if (next !== null && Number(next) >= 0)
                                  void updateLocalEntry(entry.localEntryId, {
                                    quantity: Number(next),
                                    syncState: "pending",
                                    syncError: undefined
                                  }).then(refreshEntries);
                              }}
                            >
                              <Pencil size={14} /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#b42318]"
                              onClick={() =>
                                void deleteLocalEntry(entry.localEntryId).then(
                                  refreshEntries
                                )
                              }
                            >
                              <Trash2 size={14} /> Undo
                            </Button>
                          </div>
                        )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5e1] bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{pending.length} unsynced</p>
            <p className="truncate text-[11px] text-[#7a847e]">
              Last sync: {formatTime(lastSync)}
            </p>
          </div>
          <Button
            size="lg"
            className="min-w-40 text-base"
            disabled={!pending.length || syncing}
            onClick={syncNow}
          >
            {syncing ? (
              <LoaderCircle className="animate-spin" />
            ) : online ? (
              <RefreshCw />
            ) : (
              <WifiOff />
            )}
            {syncing
              ? "SYNCING…"
              : pending.some((entry) => entry.syncState === "failed")
                ? "RETRY SYNC"
                : "SYNC NOW"}
          </Button>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#18211d]/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProduct();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="count-product-title"
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 border-b border-[#e8ece9] bg-[#fbfcfb] p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <Badge tone="green" className="mb-2">
                    {selected.category}
                  </Badge>
                  <h2
                    id="count-product-title"
                    className="text-xl font-black leading-tight"
                  >
                    {selected.name}
                  </h2>
                </div>
                <button
                  onClick={closeProduct}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef1ef] text-[#68726c]"
                  aria-label="Close product"
                >
                  <X size={17} />
                </button>
              </div>
              <p className="text-xs font-medium text-[#7a847e]">
                {selected.sku} · {selected.barcode}
              </p>
            </div>

            <div className="grid grid-cols-3 border-b border-[#e8ece9]">
              {[
                ["System total", systemQty],
                ["Counted", countedQty],
                ["Difference", countedQty - systemQty]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-r border-[#e8ece9] p-4 text-center last:border-r-0"
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#7a847e]">
                    {label}
                  </p>
                  <p
                    className={`tabular text-xl font-black ${label === "Difference" && Number(value) !== 0 ? "text-[#b45309]" : ""}`}
                  >
                    {Number(value) > 0 && label === "Difference" ? "+" : ""}
                    {formatNumber(Number(value))}
                  </p>
                </div>
              ))}
            </div>

            <div className="safe-bottom p-5">
              {notice && (
                <div
                  className={`mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold ${notice.tone === "green" ? "border-[#bfe4cf] bg-[#e9f6ef] text-[#12673f]" : "border-[#f2c4bf] bg-[#fff0ee] text-[#9e251b]"}`}
                >
                  {notice.tone === "green" ? (
                    <Check className="mt-0.5 shrink-0" size={17} />
                  ) : (
                    <AlertCircle className="mt-0.5 shrink-0" size={17} />
                  )}
                  <span>{notice.text}</span>
                </div>
              )}
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-bold">
                  Additional quantity found now
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#68726c]">
                  <MapPin size={13} />
                  <select
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    className="bg-transparent outline-none"
                  >
                    <option>Aisle 1</option>
                    <option>Aisle 2</option>
                    <option>Aisle 3</option>
                    <option>Back stock</option>
                    <option>Display</option>
                  </select>
                </label>
              </div>
              <div className="mb-3 flex h-16 items-center rounded-2xl border-2 border-[#dfe5e1]">
                <button
                  onClick={() => setQuantity((value) => Math.max(0, value - 1))}
                  className="grid h-full w-16 place-items-center text-[#18794e]"
                  aria-label="Subtract one"
                >
                  <Minus />
                </button>
                <input
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(0, Number(event.target.value) || 0))
                  }
                  type="number"
                  min="0"
                  inputMode="decimal"
                  className="tabular h-full min-w-0 flex-1 border-x border-[#e4e8e5] text-center text-3xl font-black outline-none"
                />
                <button
                  onClick={() => setQuantity((value) => value + 1)}
                  className="grid h-full w-16 place-items-center text-[#18794e]"
                  aria-label="Add one"
                >
                  <Plus />
                </button>
              </div>
              <div className="mb-5 grid grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setQuantity((value) => value + preset)}
                    className="h-11 rounded-xl bg-[#eef2ef] text-sm font-black text-[#445049] active:bg-[#dce9e1]"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
              <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-[#f4f6f4] px-4 py-3 text-center">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a847e]">
                    Already counted
                  </span>
                  <span className="tabular text-lg font-black">
                    {formatNumber(countedQty)}
                  </span>
                </span>
                <span className="font-black text-[#7a847e]">+</span>
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a847e]">
                    This entry
                  </span>
                  <span className="tabular text-lg font-black">
                    {formatNumber(quantity)}
                  </span>
                </span>
                <span className="col-span-3 border-t border-[#dfe5e1] pt-2 text-sm font-bold text-[#18794e]">
                  New product total: {formatNumber(countedQty + quantity)}
                </span>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={saveCount}
                disabled={!selectedBatch || (countedQty > 0 && quantity === 0)}
              >
                <PackageCheck size={20} /> Add {formatNumber(quantity)} → total{" "}
                {formatNumber(countedQty + quantity)}
              </Button>
              {selectedEditableEntries.length > 0 &&
                (correctingTotal ? (
                  <div className="mt-3 rounded-xl border border-[#dfe5e1] bg-[#fbfcfb] p-3">
                    <label
                      htmlFor="correct-product-total"
                      className="text-sm font-bold"
                    >
                      Correct product total
                    </label>
                    <p className="mt-1 text-xs text-[#7a847e]">
                      Changes unsynced counts on this device. Synced quantities
                      remain locked.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        id="correct-product-total"
                        value={correctedTotal}
                        onChange={(event) =>
                          setCorrectedTotal(
                            Math.max(0, Number(event.target.value) || 0)
                          )
                        }
                        type="number"
                        min="0"
                        inputMode="decimal"
                        className="tabular h-11 min-w-0 flex-1 rounded-xl border border-[#dfe5e1] px-3 text-lg font-black outline-none focus:border-[#63a982]"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => setCorrectingTotal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          void correctUnsyncedProductTotal(correctedTotal)
                        }
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => {
                      setCorrectedTotal(countedQty);
                      setCorrectingTotal(true);
                      setNotice(null);
                    }}
                  >
                    <Pencil size={16} /> Correct product total
                  </Button>
                ))}
              <p className="mt-2 text-center text-[11px] text-[#7a847e]">
                Each saved entry is added to the product total and kept safely
                on this device
              </p>
            </div>
          </div>
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcode}
      />
    </div>
  );
}
