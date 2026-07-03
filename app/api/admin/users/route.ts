import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "staff"]).default("staff")
});

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("users").select("id,email,full_name,role,group_name,created_at").order("full_name");
    if (error) throw error;
    return NextResponse.json({ users: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid user", details: parsed.error.flatten() }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName }
    });
    if (error) throw error;
    if (parsed.data.role === "admin" && data.user) {
      const update = await admin.from("users").update({ role: "admin" }).eq("id", data.user.id);
      if (update.error) throw update.error;
    }
    return NextResponse.json({ user: data.user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
