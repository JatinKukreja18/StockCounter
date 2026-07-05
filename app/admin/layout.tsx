import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/runtime";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) return children;

  let role: "admin" | "staff";
  try {
    const { profile } = await getAuthenticatedProfile();
    role = profile.role;
  } catch {
    redirect("/login");
  }
  if (role !== "admin") redirect("/count");

  return children;
}
