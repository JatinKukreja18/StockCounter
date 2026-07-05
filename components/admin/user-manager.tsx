"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type UserRow = { id: string; email: string; full_name: string; role: "admin" | "staff" };

export function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users");
    if (response.ok) setUsers((await response.json()).users);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), fullName: form.get("fullName"), password: form.get("password"), role: "staff" })
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not create account.");
        return;
      }

      formElement.reset();
      setMessage(data.existing ? "This staff account already exists—no duplicate was created." : "Staff account created. Share the temporary password securely.");
      await load();
    } catch {
      setMessage("Could not create account. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5">
        <h2 className="font-black">Add staff account</h2>
        <p className="mt-1 text-xs leading-5 text-[#68726c]">Create one account per person. Never share a common counting login.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input required name="fullName" placeholder="Full name" className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <input required name="email" type="email" placeholder="Email" className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <input required name="password" type="password" minLength={8} placeholder="Temporary password (8+ characters)" className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm" />
          <Button className="w-full" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Plus size={16} />}Create staff user</Button>
        </form>
        {message && <p className="mt-3 rounded-xl bg-[#eef2ef] p-3 text-xs font-semibold">{message}</p>}
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#e8ece9] px-5 py-4"><h2 className="font-black">Users</h2><p className="text-xs text-[#7a847e]">{users.length} accounts</p></div>
        {loading ? <div className="grid py-12 place-items-center"><LoaderCircle className="animate-spin" /></div> : (
          <div className="divide-y divide-[#e8ece9]">{users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-4">
              <span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]"><UserRound size={16} /></span>
              <div className="min-w-0 flex-1"><p className="font-bold">{user.full_name}</p><p className="truncate text-xs text-[#7a847e]">{user.email}</p></div>
              <Badge tone={user.role === "admin" ? "green" : "neutral"}>{user.role}</Badge><Check size={15} className="text-[#18794e]" />
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );
}
