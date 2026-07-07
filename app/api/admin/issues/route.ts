import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const resolveSchema = z.discriminatedUnion("resolution", [
  z.object({
    issueId: z.string().uuid(),
    resolution: z.enum(["accepted", "corrected", "voided"]),
    quantity: z.number().nonnegative().optional(),
    note: z.string().max(500).optional()
  }),
  z.object({
    issueId: z.string().uuid(),
    resolution: z.literal("assigned"),
    sessionId: z.string().uuid(),
    stockBatchId: z.string().uuid()
  })
]);

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const query = new URL(request.url).searchParams
      .get("options")
      ?.trim()
      .replace(/[,%()]/g, " ");
    if (query) {
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,sku,barcode,name")
        .or(
          `sku.ilike.%${query}%,barcode.ilike.%${query}%,name.ilike.%${query}%`
        )
        .limit(20);
      if (productError) throw productError;
      const ids = (products ?? []).map((product) => product.id);
      if (!ids.length) return NextResponse.json({ options: [] });
      const { data: mappings, error: mappingError } = await supabase
        .from("session_products")
        .select(
          "session_id,product_id,stock_batch_id,sessions!inner(name,status),stock_batches(batch_no,inward_tranno,expiry_date)"
        )
        .in("product_id", ids)
        .eq("sessions.status", "open");
      if (mappingError) throw mappingError;
      return NextResponse.json({
        options: (mappings ?? []).map((mapping) => {
          const product = products?.find(
            (item) => item.id === mapping.product_id
          );
          const source = mapping as unknown as {
            session_id: string;
            stock_batch_id: string;
            sessions: { name: string };
            stock_batches: {
              batch_no: string | null;
              inward_tranno: string | null;
              expiry_date: string | null;
            };
          };
          return {
            sessionId: source.session_id,
            stockBatchId: source.stock_batch_id,
            label: `${product?.sku} · ${product?.name} · ${source.stock_batches.batch_no || source.stock_batches.inward_tranno || "Unlabelled"} · ${source.stock_batches.expiry_date?.slice(0, 10) || "No expiry"} · ${source.sessions.name}`
          };
        })
      });
    }
    const { data, error } = await supabase
      .from("sync_issues")
      .select(
        "id,local_entry_id,code,message,status,created_at,barcode,entry_id"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({
      issues: (data ?? []).map((row) => ({
        id: row.id,
        localEntryId: row.local_entry_id,
        code: row.code,
        message: row.message,
        severity: [
          "unusually_high_quantity",
          "stock_changed",
          "duplicate_local_entry"
        ].includes(row.code)
          ? "warning"
          : "error",
        status: row.status,
        createdAt: row.created_at,
        barcode: row.barcode,
        entryId: row.entry_id
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 401 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const parsed = resolveSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid resolution" },
        { status: 400 }
      );
    const { error } =
      parsed.data.resolution === "assigned"
        ? await supabase.rpc("assign_sync_issue", {
            p_issue_id: parsed.data.issueId,
            p_session_id: parsed.data.sessionId,
            p_stock_batch_id: parsed.data.stockBatchId
          })
        : await supabase.rpc("resolve_sync_issue", {
            p_issue_id: parsed.data.issueId,
            p_resolution: parsed.data.resolution,
            p_quantity: parsed.data.quantity ?? null,
            p_note: parsed.data.note ?? null
          });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
