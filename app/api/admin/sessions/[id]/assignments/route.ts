import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const assignmentSchema = z.object({
  assigneeIds: z.array(z.string().uuid()).min(1)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { supabase } = await requireAdmin();
    const parsed = assignmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Select at least one valid staff member." },
        { status: 400 }
      );
    }

    const assigneeIds = [...new Set(parsed.data.assigneeIds)];
    const [
      { data: session, error: sessionError },
      { data: staff, error: staffError }
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select("id,status")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("users")
        .select("id")
        .eq("role", "staff")
        .in("id", assigneeIds)
    ]);
    if (sessionError) throw sessionError;
    if (session.status !== "open") {
      return NextResponse.json(
        { error: "People can only be added to an open session." },
        { status: 400 }
      );
    }
    if (staffError) throw staffError;
    if ((staff ?? []).length !== assigneeIds.length) {
      return NextResponse.json(
        { error: "One or more selected accounts are not staff users." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("session_assignments")
      .select("user_id")
      .eq("session_id", sessionId)
      .in("user_id", assigneeIds);
    if (existingError) throw existingError;

    const existingIds = new Set(
      (existing ?? []).map((assignment) => assignment.user_id)
    );
    const newIds = assigneeIds.filter((userId) => !existingIds.has(userId));
    if (newIds.length) {
      const { error: insertError } = await supabase
        .from("session_assignments")
        .insert(
          newIds.map((userId) => ({ session_id: sessionId, user_id: userId }))
        );
      if (insertError) throw insertError;
    }

    return NextResponse.json({ added: newIds.length });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not add people to the session.";
    return NextResponse.json(
      { error: message },
      { status: message === "Forbidden" ? 403 : 500 }
    );
  }
}
