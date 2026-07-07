"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, Plus, Users } from "lucide-react";
import { StaffAssignmentModal } from "@/components/admin/staff-assignment-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { SheetModal } from "@/components/ui/sheet-modal";
import { useAdminSessions } from "@/hooks/use-admin-sessions";
import type { AdminUserRow } from "@/lib/api-types";
import { demoEntries, demoProducts, demoSessions } from "@/lib/demo-data";
import { parseStockWorkbook, type GoFrugalImportResult } from "@/lib/gofrugal-import";
import { isDemoMode } from "@/lib/runtime";
import type { CountSession } from "@/lib/types";

const demoStaff: AdminUserRow[] = [{ id: "demo-staff", full_name: "Demo Staff", email: "staff@demo.local", phone: null, role: "staff" }];

export function SessionManager() {
  const isDemo = isDemoMode();
  const {
    sessions: realSessions,
    staff: realStaff,
    loading: realLoading,
    error: loadError,
    createSession: createSessionApi,
    addPeople: addPeopleApi
  } = useAdminSessions({ autoLoad: !isDemo });
  const [demoSessionRows, setDemoSessionRows] = useState<CountSession[]>(demoSessions);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [masterFile, setMasterFile] = useState("");
  const [parsed, setParsed] = useState<GoFrugalImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assigningSession, setAssigningSession] = useState<CountSession | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const sessions = isDemo ? demoSessionRows : realSessions;
  const staff = isDemo ? demoStaff : realStaff;
  const loading = isDemo ? false : realLoading;

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  async function readMaster(file: File) {
    setError("");
    setParsed(null);
    setMasterFile(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const result = parseStockWorkbook(XLSX, workbook);
      if (!result.products.length) throw new Error("No stock products were found. Export GoFrugal Current Stock Detail as XLS or XLSX.");
      setParsed(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not parse the Excel file.");
    }
  }

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed) return setError("Choose and validate a GoFrugal Excel file first.");
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const assigneeIds = form.getAll("assignees").map(String);
    if (!assigneeIds.length) {
      setSaving(false);
      return setError("Assign at least one staff member.");
    }
    try {
      if (isDemo) {
        const next: CountSession = {
          id: crypto.randomUUID(), stockImportId: crypto.randomUUID(), masterFileName: masterFile,
          name: String(form.get("name")), category: parsed.metadata.category, store: parsed.metadata.store, status: "open",
          productIds: parsed.products.map((product) => product.sku), assignees: ["Demo Staff"], createdAt: new Date().toISOString()
        };
        setDemoSessionRows((value) => [next, ...value]);
      } else {
        await createSessionApi({
          name: String(form.get("name") ?? ""),
          fileName: masterFile,
          products: parsed.products,
          assigneeIds
        });
      }
      setCreated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Session import failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addPeople(assigneeIds: string[]) {
    if (!assigningSession) return;
    if (!assigneeIds.length) return setAssignmentError("Select at least one staff member.");

    setAssignmentSaving(true);
    setAssignmentError("");
    try {
      if (isDemo) {
        const demoStaff = [{ id: "demo-staff", full_name: "Demo Staff" }];
        const selectedNames = demoStaff
          .filter((person) => assigneeIds.includes(person.id))
          .map((person) => person.full_name);
        setDemoSessionRows((current) => current.map((session) =>
          session.id === assigningSession.id
            ? {
                ...session,
                assignees: [...session.assignees, ...selectedNames],
                assigneeIds: [...(session.assigneeIds ?? []), ...assigneeIds]
              }
            : session
        ));
      } else {
        await addPeopleApi(assigningSession.id, assigneeIds);
      }
      setAssigningSession(null);
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : "Could not add people.");
    } finally {
      setAssignmentSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#7a847e]">Each session is permanently linked to its uploaded stock master.</p>
        <Button onClick={() => setCreating(true)}><Plus size={17} /> Create session</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading && <Card className="col-span-full grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-[#18794e]" /></Card>}
        {!loading && !sessions.length && <Card className="col-span-full py-14 text-center"><p className="font-black">No count sessions yet</p><p className="mt-1 text-sm text-[#7a847e]">Upload a GoFrugal stock master to create the first live session.</p></Card>}
        {sessions.map((session) => {
          const counted = isDemo
            ? demoProducts.filter((product) => session.productIds.includes(product.id)).filter((product) =>
                product.batches.every((batch) => demoEntries.some((entry) => entry.sessionId === session.id && entry.stockBatchId === batch.id && !entry.isVoided))
              ).length
            : session.completedProductCount ?? 0;
          const percent = session.productIds.length ? Math.round((counted / session.productIds.length) * 100) : 0;
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ece9] bg-[#fbfcfb] px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#68726c]"><Users size={15} className="shrink-0" /> <span className="truncate">{session.assignees.join(", ") || "No staff assigned"}</span></div>
                  <span className="mt-1 block text-xs font-bold text-[#18794e]">{isDemo ? demoEntries.filter((entry) => entry.sessionId === session.id).length : session.entryCount ?? 0} synced entries</span>
                </div>
                {session.status === "open" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAssigningSession(session);
                      setAssignmentError("");
                    }}
                  >
                    <Plus size={15} /> Add people
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {creating && (
        <SheetModal
          open={creating}
          onClose={() => setCreating(false)}
          title="Create count session"
          description="This session's Excel upload becomes its locked stock master."
          maxWidth="max-w-lg"
        >
            {created ? (
              <div className="py-10 text-center">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><Check size={26} /></span>
                <h3 className="font-black">Session is open</h3>
                <p className="mt-2 text-sm text-[#68726c]">Assigned staff can now count these products.</p>
                <Button className="mt-5" onClick={() => { setCreating(false); setCreated(false); }}>Done</Button>
              </div>
            ) : (
              <form onSubmit={createSession} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-bold">GoFrugal stock master</span><input required type="file" accept=".xls,.xlsx" onChange={(event) => event.target.files?.[0] && void readMaster(event.target.files[0])} className="block w-full rounded-xl border border-[#dfe5e1] bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#e9f6ef] file:px-3 file:py-2 file:font-bold file:text-[#12673f]" /><span className="mt-1.5 block text-[11px] text-[#7a847e]">The file is immutable after the session opens.</span></label>
                {parsed && <div className="rounded-xl bg-[#e9f6ef] p-4 text-sm text-[#12673f]"><b>{parsed.products.length} product totals · {parsed.metadata.batchRows} source stock lines</b><br />{parsed.metadata.store} · {parsed.metadata.category} · Stock {parsed.metadata.grandTotal?.toLocaleString("en-IN")}</div>}
                <label className="block"><span className="mb-1.5 block text-xs font-bold">Session name</span><input required name="name" defaultValue={parsed ? `${parsed.metadata.category} · ${parsed.metadata.store}` : ""} key={parsed?.metadata.category} className="h-11 w-full rounded-xl border border-[#dfe5e1] bg-white px-3 outline-none" /></label>
                <fieldset><legend className="mb-1.5 text-xs font-bold">Assign staff</legend><div className="max-h-36 space-y-1 overflow-auto rounded-xl border border-[#dfe5e1] p-2">
                  {staff.map((user) => <label key={user.id} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-[#f4f7f5]"><input name="assignees" value={user.id} type="checkbox" /><span><b>{user.full_name}</b><span className="ml-2 text-xs text-[#7a847e]">{user.phone || user.email}</span></span></label>)}
                  {!isDemo && !staff.length && <p className="p-2 text-xs text-[#b45309]">Create staff accounts under Users first.</p>}
                </div></fieldset>
                <ErrorAlert message={error} />
                <Button size="lg" className="w-full" type="submit" disabled={!parsed || saving || (!isDemo && !staff.length)}>{saving ? <LoaderCircle className="animate-spin" /> : null}{saving ? "Importing master…" : "Create and open session"}</Button>
              </form>
            )}
        </SheetModal>
      )}

      <StaffAssignmentModal
        open={Boolean(assigningSession)}
        sessionName={assigningSession?.name ?? ""}
        staff={staff}
        assignedIds={assigningSession?.assigneeIds ?? []}
        saving={assignmentSaving}
        error={assignmentError}
        onClose={() => setAssigningSession(null)}
        onSubmit={(assigneeIds) => void addPeople(assigneeIds)}
      />
    </>
  );
}
