import { NextResponse } from "next/server";
import {
  mapCountEntries,
  mapSessionProducts,
  type RawCountEntry,
  type SessionProductMapping
} from "@/lib/session-data";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id,name,status,category,store,stock_import_id,created_at,closed_at,stock_imports(file_name),session_assignments(users(full_name))")
      .eq("id", id).single();
    if (sessionError) throw sessionError;
    const [{ data: mappings, error: mapError }, { data: entries, error: entryError }] = await Promise.all([
      supabase.from("session_products")
        .select("system_qty_snapshot,stock_version_snapshot,products(id,barcode,sku,name,category,store),stock_batches(id,batch_no,inward_tranno,expiry_date)")
        .eq("session_id", id),
      supabase.from("count_entries")
        .select("id,local_entry_id,session_id,product_id,stock_batch_id,user_id,quantity,area,note,is_voided,created_on_device_at,users(full_name)")
        .eq("session_id", id)
    ]);
    if (mapError) throw mapError;
    if (entryError) throw entryError;
    const products = mapSessionProducts((mappings ?? []) as unknown as SessionProductMapping[]);
    const source = session as unknown as {
      id: string; name: string; status: "draft" | "open" | "closed"; category: string | null; store: string; stock_import_id: string;
      created_at: string; closed_at: string | null; stock_imports: { file_name: string } | null;
      session_assignments: Array<{ users: { full_name: string } | null }>;
    };
    return NextResponse.json({
      session: { id: source.id, name: source.name, status: source.status, category: source.category ?? "All", store: source.store, stockImportId: source.stock_import_id, masterFileName: source.stock_imports?.file_name ?? "", productIds: products.map((product) => product.id), assignees: source.session_assignments.map((item) => item.users?.full_name).filter(Boolean), createdAt: source.created_at, closedAt: source.closed_at ?? undefined },
      products,
      entries: mapCountEntries((entries ?? []) as unknown as RawCountEntry[])
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Not found" }, { status: 404 });
  }
}

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("close_count_session", { p_session_id: id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Close failed" }, { status: 500 });
  }
}
