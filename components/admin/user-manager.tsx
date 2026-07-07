'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Pencil, Plus, UserRound, X } from 'lucide-react';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminUsers } from '@/hooks/use-admin-users';
import type { AdminUserRow } from '@/lib/api-types';

export function UserManager() {
  const { users, loading, error, saveUser } = useAdminUsers();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage('');
    const form = new FormData(formElement);
    const credential = authMethod === 'phone'
      ? { mobile: form.get('mobile'), pin: form.get('pin') }
      : { email: form.get('email'), password: form.get('password') };

    try {
      const data = await saveUser(
        editing
          ? { id: editing.id, authMethod, fullName: String(form.get('fullName') ?? ''), ...credential }
          : { authMethod, fullName: String(form.get('fullName') ?? ''), role: 'staff', ...credential },
      );

      formElement.reset();
      setMessage(
        editing
          ? `Staff details updated. A new ${authMethod === 'phone' ? 'PIN' : 'password'} was applied only if you entered one.`
          : data.existing
            ? `This ${authMethod === 'phone' ? 'mobile number' : 'email address'} already has an account.`
            : `Staff account created. Share the ${authMethod === 'phone' ? 'mobile number and PIN' : 'email and password'} securely.`,
      );
      setEditing(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : `Could not ${editing ? 'update' : 'create'} account. Check your connection and try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black">{editing ? 'Edit staff account' : 'Add staff account'}</h2>
            <p className="mt-1 text-xs leading-5 text-[#68726c]">
              {editing
                ? `Update their name or ${authMethod === 'phone' ? 'mobile number' : 'email'}. Leave the new credential blank to keep it.`
                : 'Full name and one sign-in method are required. Never share a common counting login.'}
            </p>
          </div>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setAuthMethod('phone');
                setMessage('');
              }}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef1ef]"
              aria-label="Cancel editing"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <form key={editing?.id ?? 'create'} onSubmit={submit} className="mt-5 space-y-3">
          <input
            required
            name="fullName"
            defaultValue={editing?.full_name ?? ''}
            placeholder="Full name"
            className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm"
          />
          {!editing && (
            <AuthMethodToggle value={authMethod} onChange={(method) => {
              setAuthMethod(method);
              setMessage('');
            }} label="Staff sign-in method" />
          )}
          {authMethod === 'phone' ? (
            <>
              <input
                required
                name="mobile"
                defaultValue={editing?.phone?.replace(/^\+91/, '') ?? ''}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                placeholder="10-digit mobile number"
                className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm"
              />
              <input
                required={!editing}
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                placeholder={editing ? 'New 6-digit PIN (optional)' : '6-digit PIN'}
                className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm"
              />
            </>
          ) : (
            <>
              <input
                required
                name="email"
                defaultValue={editing?.email ?? ''}
                type="email"
                autoComplete="off"
                placeholder="Email address"
                className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm"
              />
              <input
                required={!editing}
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder={editing ? 'New password (optional)' : 'Password (at least 8 characters)'}
                className="h-11 w-full rounded-xl border border-[#dfe5e1] px-3 text-sm"
              />
            </>
          )}
          <Button className="w-full" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : editing ? <Check size={16} /> : <Plus size={16} />}
            {editing ? 'Update staff user' : 'Create staff user'}
          </Button>
        </form>
        {message && <p className="mt-3 rounded-xl bg-[#eef2ef] p-3 text-xs font-semibold">{message}</p>}
        {error && <p className="mt-3 rounded-xl bg-[#fff0ee] p-3 text-xs font-semibold text-[#9e251b]">{error}</p>}
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#e8ece9] px-5 py-4">
          <h2 className="font-black">Users</h2>
          <p className="text-xs text-[#7a847e]">{users.length} accounts</p>
        </div>
        {loading ? (
          <div className="grid py-12 place-items-center">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-[#e8ece9]">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-5 py-4">
                <span className="grid size-9 place-items-center rounded-full bg-[#e9f6ef] text-[#18794e]">
                  <UserRound size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{user.full_name}</p>
                  <p className="truncate text-xs text-[#7a847e]">{user.phone || user.email}</p>
                </div>
                <Badge tone={user.role === 'admin' ? 'green' : 'neutral'}>{user.role}</Badge>
                {user.role === 'staff' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(user);
                      setAuthMethod(user.phone ? 'phone' : 'email');
                      setMessage('');
                    }}
                    className="grid size-8 place-items-center rounded-lg text-[#68726c] hover:bg-[#eef2ef]"
                    aria-label={`Edit ${user.full_name}`}
                  >
                    <Pencil size={15} />
                  </button>
                ) : (
                  <Check size={15} className="text-[#18794e]" />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
