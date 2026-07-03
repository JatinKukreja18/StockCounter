import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export async function GET() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ id: "demo", email: "demo@sekai.local", fullName: "Demo Admin", role: "admin" });
  }
  try {
    const { profile } = await getAuthenticatedProfile();
    return NextResponse.json({ id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
