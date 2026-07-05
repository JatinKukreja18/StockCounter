"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { passwordCredentials } from "@/lib/phone-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signInWithPassword(passwordCredentials(identifier, password));
      if (result.error) throw result.error;
      const requested = params.get("next");
      if (requested) {
        router.replace(requested);
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("users").select("role").eq("id", result.data.user.id).single();
        if (profileError) throw profileError;
        router.replace(profile.role === "admin" ? "/admin" : "/count");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-xs font-bold">Mobile number</span><input required type="text" inputMode="tel" autoComplete="username" placeholder="9876543210" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe5e1] px-4 outline-none focus:border-[#63a982]" /><span className="mt-1 block text-[11px] text-[#7a847e]">Admins may enter their email address.</span></label>
      <label className="block"><span className="mb-1.5 block text-xs font-bold">PIN</span><input required type="password" inputMode="numeric" autoComplete="current-password" placeholder="6-digit PIN" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe5e1] px-4 outline-none focus:border-[#63a982]" /></label>
      {error && <p className="rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b]">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <LogIn size={18} />}{loading ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
