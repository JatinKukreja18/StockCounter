import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await getAuthenticatedProfile();
    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      phone: profile.phone,
      fullName: profile.full_name,
      role: profile.role
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
