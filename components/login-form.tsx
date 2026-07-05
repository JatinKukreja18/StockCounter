'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { passwordCredentials } from '@/lib/phone-auth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type LoginMethod = 'email' | 'phone';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signInWithPassword(passwordCredentials(identifier, password));
      if (result.error) throw result.error;
      const requested = params.get('next');
      if (requested) {
        router.replace(requested);
      } else {
        const { data: profile, error: profileError } = await supabase.from('users').select('role').eq('id', result.data.user.id).single();
        if (profileError) throw profileError;
        router.replace(profile.role === 'admin' ? '/admin' : '/count');
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-[#eef2ef] p-1" aria-label="Sign-in method">
        {(['phone', 'email'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMethod(option);
              setIdentifier('');
              setPassword('');
              setError('');
            }}
            className={`h-10 rounded-lg text-sm font-bold transition ${
              method === option ? 'bg-white text-[#18794e] shadow-sm' : 'text-[#68726c]'
            }`}
            aria-pressed={method === option}
          >
            {option === 'phone' ? 'Phone + PIN' : 'Email + password'}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold">{method === 'phone' ? 'Mobile number' : 'Email address'}</span>
        <input
          required
          type={method === 'phone' ? 'tel' : 'email'}
          inputMode={method === 'phone' ? 'tel' : 'email'}
          autoComplete="username"
          pattern={method === 'phone' ? '[0-9]{10}' : undefined}
          placeholder={method === 'phone' ? '9876543210' : 'name@example.com'}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          className="h-12 w-full rounded-xl border border-[#dfe5e1] px-4 outline-none focus:border-[#63a982]"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold">{method === 'phone' ? '6-digit PIN' : 'Password'}</span>
        <input
          required
          type="password"
          inputMode={method === 'phone' ? 'numeric' : 'text'}
          autoComplete="current-password"
          pattern={method === 'phone' ? '[0-9]{6}' : undefined}
          minLength={method === 'phone' ? 6 : undefined}
          maxLength={method === 'phone' ? 6 : undefined}
          placeholder={method === 'phone' ? '6-digit PIN' : 'Your password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-xl border border-[#dfe5e1] px-4 outline-none focus:border-[#63a982]"
        />
      </label>
      {error && <p className="rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b]">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <LoaderCircle className="animate-spin" /> : <LogIn size={18} />}
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
