import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIndianPhone } from "@/lib/phone-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const createSchema = z.object({
  mobile: z.string().min(10).max(20),
  fullName: z.string().min(2).max(100),
  pin: z.string().regex(/^\d{6}$/, "PIN must contain exactly 6 digits"),
  role: z.enum(["admin", "staff"]).default("staff")
});

const updateSchema = z.object({
  id: z.string().uuid(),
  mobile: z.string().min(10).max(20),
  fullName: z.string().min(2).max(100),
  pin: z.union([z.literal(""), z.string().regex(/^\d{6}$/, "PIN must contain exactly 6 digits")]).optional()
});

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("users").select("id,email,phone,full_name,role,group_name,created_at").order("full_name");
    if (error) throw error;
    return NextResponse.json({ users: data });
  } catch (error) {
    const message = errorMessage(error, "Failed to load users");
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid user", details: parsed.error.flatten() }, { status: 400 });
    const phone = normalizeIndianPhone(parsed.data.mobile);
    const admin = createSupabaseAdminClient();
    const existing = await admin.from("users").select("id").eq("phone", phone).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ existing: true });
    const { data, error } = await admin.auth.admin.createUser({
      phone,
      password: parsed.data.pin,
      phone_confirm: true,
      user_metadata: { full_name: parsed.data.fullName }
    });
    if (error) throw error;
    if (data.user) {
      const update = await admin.from("users").update({ phone, role: parsed.data.role }).eq("id", data.user.id);
      if (update.error) throw update.error;
    }
    return NextResponse.json({ user: data.user, created: true }, { status: 201 });
  } catch (error) {
    const message = errorMessage(error, "Failed to create user");
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid staff update", details: parsed.error.flatten() }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const phone = normalizeIndianPhone(parsed.data.mobile);
    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id,role")
      .eq("id", parsed.data.id)
      .single();
    if (targetError) throw targetError;
    if (target.role !== "staff") return NextResponse.json({ error: "Only staff accounts can be edited here." }, { status: 400 });

    const { data: duplicate, error: duplicateError } = await admin
      .from("users")
      .select("id")
      .eq("phone", phone)
      .neq("id", parsed.data.id)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return NextResponse.json({ error: "That mobile number belongs to another account." }, { status: 409 });

    const authUpdate = await admin.auth.admin.updateUserById(parsed.data.id, {
      phone,
      phone_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
      ...(parsed.data.pin ? { password: parsed.data.pin } : {})
    });
    if (authUpdate.error) throw authUpdate.error;

    const profileUpdate = await admin
      .from("users")
      .update({ phone, full_name: parsed.data.fullName })
      .eq("id", parsed.data.id);
    if (profileUpdate.error) throw profileUpdate.error;

    return NextResponse.json({ updated: true });
  } catch (error) {
    const message = errorMessage(error, "Failed to update staff account");
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
