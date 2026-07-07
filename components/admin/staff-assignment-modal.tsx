"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { SheetModal } from "@/components/ui/sheet-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Button } from "@/components/ui/button";
import type { AdminUserRow } from "@/lib/api-types";

export function StaffAssignmentModal({
  open,
  title = "Add people",
  sessionName,
  staff,
  assignedIds,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  title?: string;
  sessionName: string;
  staff: AdminUserRow[];
  assignedIds: string[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (assigneeIds: string[]) => void;
}) {
  const availableStaff = staff.filter(
    (person) => !assignedIds.includes(person.id)
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assigneeIds = new FormData(event.currentTarget)
      .getAll("assignees")
      .map(String);
    onSubmit(assigneeIds);
  }

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={title}
      description={sessionName}
    >
      {availableStaff.length ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold">
              Select additional staff
            </legend>
            <div className="max-h-60 space-y-1 overflow-auto rounded-xl border border-[#dfe5e1] p-2">
              {availableStaff.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-[#f4f7f5]"
                >
                  <input name="assignees" value={person.id} type="checkbox" />
                  <span>
                    <b>{person.full_name}</b>
                    <span className="ml-2 text-xs text-[#7a847e]">
                      {person.phone || person.email}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <ErrorAlert message={error} />
          <Button className="w-full" type="submit" disabled={saving}>
            {saving ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {saving ? "Adding..." : "Add selected people"}
          </Button>
        </form>
      ) : (
        <div className="rounded-xl bg-[#eef2ef] p-4 text-sm text-[#56615b]">
          Everyone is already assigned to this session.
        </div>
      )}
    </SheetModal>
  );
}
