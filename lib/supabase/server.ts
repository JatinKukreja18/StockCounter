import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Middleware refreshes them.
        }
      }
    }
  });
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return { supabase, user: data.user };
}

export async function getAuthenticatedProfile() {
  const { supabase, user } = await getAuthenticatedUser();
  const { data: profile, error } = await supabase
    .from("users")
    .select("id,email,phone,full_name,role,group_name")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("User profile is not configured.");
  return { supabase, user, profile: profile as { id: string; email: string; phone: string | null; full_name: string; role: "admin" | "staff"; group_name: string | null } };
}

export async function requireAdmin() {
  const context = await getAuthenticatedProfile();
  if (context.profile.role !== "admin") throw new Error("Forbidden");
  return context;
}
