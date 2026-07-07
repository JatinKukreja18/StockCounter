import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
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
