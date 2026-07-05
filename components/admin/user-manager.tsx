"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type UserRow = { id: string; email: string; phone: string | null; full_name: string; role: "admin" | "staff" };

function responseBody(text: string): { users?: UserRow[]; existing?: boolean; error?: string } {
  if (!text) return {};
  try {
    return JSON.parse(text) as { users?: UserRow[]; existing?: boolean; error?: string };
  } catch {
    return { error: text };
  }
}

export function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);

  async function load() {
    const response = await fetch("/api/admin/users");
    const data = responseBody(await response.text());
    if (response.ok) setUsers(data.users ?? []);
    else setMessage(data.error || `Could not load users (${response.status}).`);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { id: editing.id, mobile: form.get("mobile"), fullName: form.get("fullName"), pin: form.get("pin") }
          : { mobile: form.get("mobile"), fullName: form.get("fullName"), pin: form.get("pin"), role: "staff" }
        )
      });
      const data = responseBody(await response.text());

      if (!response.ok) {
        setMessage(data.error || (editing ? "Could not update account." : "Could not create account."));
        return;
      }

      formElement.reset();
      setMessage(editing
        ? "Staff details updated. A new PIN was applied only if you entered one."
        : data.existing ? "This mobile number already has a staff account." : "Staff account created. Share the mobile number and PIN securely."
      );
      setEditing(null);
      await load();
    } catch {
      setMessage(`Could not ${editing ? "update" : "create"} account. Check your connection and try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black">{editing ? "Edit staff account" : "Add staff account"}</h2>
            <p className="mt-1 text-xs leading-5 text-[#68726c]">{editing ? "Update their name or mobile. Enter a PIN only to override it." : "Create one account per person. Never share a common counting login."}</p>
          </div>
          {editing && <button type="button" onClick={() => { setEditing(null); setMessage(""); }} className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef1ef]" aria-label="Cancel editing"><X size={15} /></button>}
        </div>
        <form key={editing?.id ?? "create"} onSubmit={submit} className="mt-5 space-y-3">
          <input required name="fullName" defaultValue={editing?.full_name ?? ""} placeholder="Full name" className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <input required name="mobile" defaultValue={editing?.phone?.replace(/^\+91/, "") ?? ""} type="tel" inputMode="numeric" pattern="[0-9]{10}" placeholder="10-digit mobile number" className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <input required={!editing} name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder={editing ? "New 6-digit PIN (optional)" : "6-digit PIN"} className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <Button className="w-full" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : editing ? <Check size={16} /> : <Plus size={16} />}{editing ? "Update staff user" : "Create staff user"}</Button>
        </form>
        {message && <p className="mt-3 rounded-xl bg-[#eef2ef] p-3 text-xs font-semibold">{message}</p>}
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#e8ece9] px-5 py-4"><h2 className="font-black">Users</h2><p className="text-xs text-[#7a847e]">{users.length} accounts</p></div>
        {loading ? <div className="grid py-12 place-items-center"><LoaderCircle className="animate-spin" /></div> : (
          <div className="divide-y divide-[#e8ece9]">{users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-4">
              <span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><UserRound size={16} /></span>
              <div className="min-w-0 flex-1"><p className="font-bold">{user.full_name}</p><p className="truncate text-xs text-[#7a847e]">{user.phone || user.email}</p></div>
              <Badge tone={user.role === "admin" ? "green" : "neutral"}>{user.role}</Badge>
              {user.role === "staff" ? <button type="button" onClick={() => { setEditing(user); setMessage(""); }} className="grid size-8 place-items-center rounded-lg text-[#68726c] hover:bg-[#eef2ef]" aria-label={`Edit ${user.full_name}`}><Pencil size={15} /></button> : <Check size={15} className="text-[#18794e]" />}
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}
