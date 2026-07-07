"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { PageHeading } from "@/components/admin/page-heading";
import { StaffAssignmentModal } from "@/components/admin/staff-assignment-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useAdminSessionDetail } from "@/hooks/use-admin-session-detail";
import { indexActiveProductCountQuantities } from "@/lib/counting";
import { demoEntries, demoProducts } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/runtime";
import type { CountSession } from "@/lib/types";
import { formatNumber, formatTime } from "@/lib/utils";

const demoStaff = [
  {
    id: "demo-staff",
    full_name: "Demo Staff",
    email: "staff@demo.local",
    phone: null,
    role: "staff" as const
  }
];

export function SessionDetail({ session }: { session: CountSession }) {
  const isDemo = isDemoMode();
  const {
    sessionData,
    setSessionData,
    products,
    setProducts,
    entries,
    setEntries,
    staff,
    setStaff,
    closeSession: closeSessionApi,
    changeEntry: changeEntryApi,
    addPeople: addPeopleApi,
    renameSession
  } = useAdminSessionDetail(session, isDemo);
  const closed = sessionData.status === "closed";
  const [showPeople, setShowPeople] = useState(false);
  const [peopleSaving, setPeopleSaving] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(session.name);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!isDemo) return;
    setProducts(
      demoProducts.filter((product) => session.productIds.includes(product.id))
    );
    setEntries(demoEntries.filter((entry) => entry.sessionId === session.id));
    setStaff(demoStaff);
  }, [
    isDemo,
    session.id,
    session.productIds,
    setEntries,
    setProducts,
    setStaff
  ]);

  const countsByProduct = useMemo(
    () => indexActiveProductCountQuantities(entries, session.id),
    [entries, session.id]
  );
  const [tab, setTab] = useState<"variance" | "history">("variance");
  async function closeSession() {
    if (
      !window.confirm(
        "Close this session? Staff will no longer be able to sync entries into it."
      )
    )
      return;
    if (!isDemo) {
      await closeSessionApi();
    }
    setSessionData((current) => ({
      ...current,
      status: "closed",
      closedAt: new Date().toISOString()
    }));
  }
  async function changeEntry(entryId: string, action: "void" | "correct") {
    let quantity: number | undefined;
    if (action === "correct") {
      const value = window.prompt("Enter corrected quantity");
      if (value === null || Number(value) < 0) return;
      quantity = Number(value);
    } else if (
      !window.confirm(
        "Void this entry? Its quantity will be removed from the count."
      )
    )
      return;
    if (!isDemo) {
      await changeEntryApi(entryId, action, quantity);
    } else
      setEntries((items) =>
        items.map((entry) =>
          entry.id === entryId ? { ...entry, isVoided: true } : entry
        )
      );
  }

  async function addPeople(assigneeIds: string[]) {
    if (!assigneeIds.length)
      return setPeopleError("Select at least one staff member.");
    setPeopleSaving(true);
    setPeopleError("");
    try {
      if (isDemo) {
        const names = staff
          .filter((person) => assigneeIds.includes(person.id))
          .map((person) => person.full_name);
        setSessionData((current) => ({
          ...current,
          assignees: [...current.assignees, ...names],
          assigneeIds: [...(current.assigneeIds ?? []), ...assigneeIds]
        }));
      } else {
        await addPeopleApi(assigneeIds);
      }
      setShowPeople(false);
    } catch (reason) {
      setPeopleError(
        reason instanceof Error ? reason.message : "Could not add people."
      );
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

    try {
      const savedName = await renameSession(name);
      setDraftName(savedName);
    } catch (reason) {
      setDraftName(sessionData.name);
      setNameError(
        reason instanceof Error
          ? reason.message
          : "Could not rename the session."
      );
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Session review"
        title={
          editingName ? (
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
          )
        }
        description="Review the additive count total, investigate variances, and close only when the team has finished syncing."
      />
      <ErrorAlert message={nameError} className="-mt-5 mb-5" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={closed ? "neutral" : "green"}>
              {closed ? "closed" : "open"}
            </Badge>
            <span className="text-xs font-semibold text-[#68726c]">
              <Users className="mr-1 inline" size={14} />
              {sessionData.assignees.join(", ")}
            </span>
          </div>
          <p className="mt-2 text-xs text-[#7a847e]">
            Master: {sessionData.masterFileName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed && (
            <Button
              variant="secondary"
              onClick={() => {
                setShowPeople(true);
                setPeopleError("");
              }}
            >
              <Plus size={16} /> Add people
            </Button>
          )}
          <ExportButton
            sessionId={session.id}
            products={products}
            entries={entries}
          />
          <Button
            variant="danger"
            disabled={closed}
            onClick={() => void closeSession()}
          >
            <Lock size={16} /> {closed ? "Session closed" : "Close session"}
          </Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-[#e9ecea] p-1 sm:w-80">
        <button
          onClick={() => setTab("variance")}
          className={`h-9 rounded-lg text-xs font-bold ${tab === "variance" ? "bg-white shadow-sm" : "text-[#68726c]"}`}
        >
          Variance
        </button>
        <button
          onClick={() => setTab("history")}
          className={`h-9 rounded-lg text-xs font-bold ${tab === "history" ? "bg-white shadow-sm" : "text-[#68726c]"}`}
        >
          Entry history
        </button>
      </div>
      <Card className="overflow-hidden">
        {tab === "variance" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#f7f9f7] text-xs text-[#68726c]">
                <tr>
                  {[
                    "Product",
                    "System qty",
                    "Count qty",
                    "Difference",
                    "Status",
                    ""
                  ].map((item) => (
                    <th key={item} className="px-5 py-3 font-bold">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const count = countsByProduct.get(product.id) ?? 0;
                  const difference = count - product.systemQty;
                  return (
                    <tr key={product.id} className="border-t border-[#e8ece9]">
                      <td className="px-5 py-4">
                        <p className="font-bold">{product.name}</p>
                        <p className="mt-1 text-xs text-[#7a847e]">
                          {product.sku} · {product.barcode}
                        </p>
                      </td>
                      <td className="tabular px-5 py-4 font-semibold">
                        {formatNumber(product.systemQty)}
                      </td>
                      <td className="tabular px-5 py-4 font-black">
                        {formatNumber(count)}
                      </td>
                      <td
                        className={`tabular px-5 py-4 font-black ${difference ? "text-[#b45309]" : "text-[#18794e]"}`}
                      >
                        {difference > 0 ? "+" : ""}
                        {formatNumber(difference)}
                      </td>
                      <td className="px-5 py-4">
                        {!countsByProduct.has(product.id) ? (
                          <Badge>Not counted</Badge>
                        ) : difference === 0 ? (
                          <Badge tone="green">Matched</Badge>
                        ) : (
                          <Badge tone="amber">Variance</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button className="text-[#7a847e]">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[#e8ece9]">
            {entries
              .filter((entry) => entry.sessionId === session.id)
              .map((entry) => {
                const product = products.find(
                  (item) => item.id === entry.productId
                );
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-5 py-4"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]">
                      {entry.isVoided ? (
                        <Circle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${entry.isVoided ? "line-through opacity-50" : ""}`}
                      >
                        <b>{entry.userName}</b> added <b>+{entry.quantity}</b>{" "}
                        {product?.name}
                      </p>
                      <p className="mt-1 text-xs text-[#7a847e]">
                        {entry.area} · synced {formatTime(entry.createdAt)}
                      </p>
                    </div>
                    {!entry.isVoided && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void changeEntry(entry.id, "correct")}
                        >
                          <Pencil size={14} /> Correct
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#b42318]"
                          onClick={() => void changeEntry(entry.id, "void")}
                        >
                          <Trash2 size={14} /> Void
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <StaffAssignmentModal
        open={showPeople}
        sessionName={sessionData.name}
        staff={staff}
        assignedIds={sessionData.assigneeIds ?? []}
        saving={peopleSaving}
        error={peopleError}
        onClose={() => setShowPeople(false)}
        onSubmit={(assigneeIds) => void addPeople(assigneeIds)}
      />
    </>
  );
}
