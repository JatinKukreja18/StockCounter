import { NextResponse } from "next/server";
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
        .select("id,local_entry_id,session_id,product_id,stock_batch_id,user_id,quantity,area,note,is_voided,created_on_device_at")
        .eq("session_id", id)
    ]);
    if (mapError) throw mapError;
    if (entryError) throw entryError;
    type Mapping = {
      system_qty_snapshot: number | string; stock_version_snapshot: string;
      products: { id: string; barcode: string; sku: string; name: string; category: string; store: string } | null;
      stock_batches: { id: string; batch_no: string | null; inward_tranno: string | null; expiry_date: string | null } | null;
    };
    const productMap = new Map<string, {
      id: string; barcode: string; sku: string; name: string; category: string; store: string; systemQty: number; stockVersion: string;
      batches: Array<{ id: string; batchNo?: string; inwardTranno?: string; expiryDate?: string; systemQty: number; stockVersion: string }>;
    }>();
    for (const mapping of (mappings ?? []) as unknown as Mapping[]) {
      if (!mapping.products || !mapping.stock_batches) continue;
      const product = productMap.get(mapping.products.id) ?? { ...mapping.products, systemQty: 0, stockVersion: mapping.stock_version_snapshot, batches: [] };
      const qty = Number(mapping.system_qty_snapshot);
      product.systemQty += qty;
      product.batches.push({ id: mapping.stock_batches.id, batchNo: mapping.stock_batches.batch_no ?? undefined, inwardTranno: mapping.stock_batches.inward_tranno ?? undefined, expiryDate: mapping.stock_batches.expiry_date?.slice(0, 10), systemQty: qty, stockVersion: mapping.stock_version_snapshot });
      productMap.set(product.id, product);
    }
    const source = session as unknown as {
      id: string; name: string; status: "draft" | "open" | "closed"; category: string | null; store: string; stock_import_id: string;
      created_at: string; closed_at: string | null; stock_imports: { file_name: string } | null;
      session_assignments: Array<{ users: { full_name: string } | null }>;
    };
    return NextResponse.json({
      session: { id: source.id, name: source.name, status: source.status, category: source.category ?? "All", store: source.store, stockImportId: source.stock_import_id, masterFileName: source.stock_imports?.file_name ?? "", productIds: [...productMap.keys()], assignees: source.session_assignments.map((item) => item.users?.full_name).filter(Boolean), createdAt: source.created_at, closedAt: source.closed_at ?? undefined },
      products: [...productMap.values()],
      entries: (entries ?? []).map((entry) => ({ id: entry.id, localEntryId: entry.local_entry_id, sessionId: entry.session_id, productId: entry.product_id, stockBatchId: entry.stock_batch_id, userId: entry.user_id, userName: "Staff", quantity: Number(entry.quantity), area: entry.area ?? undefined, note: entry.note ?? undefined, isVoided: entry.is_voided, createdAt: entry.created_on_device_at }))
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
