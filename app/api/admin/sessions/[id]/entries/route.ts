import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const schema = z.object({
  entryId: z.string().uuid(),
  action: z.enum(["void", "correct"]),
  quantity: z.number().nonnegative().optional(),
  note: z.string().max(500).optional()
});

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid correction" },
        { status: 400 }
      );
    const { data, error } = await supabase.rpc("admin_correct_count_entry", {
      p_entry_id: parsed.data.entryId,
      p_action: parsed.data.action,
      p_quantity: parsed.data.quantity ?? null,
      p_note: parsed.data.note ?? null
    });
    if (error) throw error;
    return NextResponse.json({ correctedEntryId: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Correction failed" },
      { status: 500 }
    );
  }
}
