import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase } = await getAuthenticatedProfile();
    const { data: sessionRows, error: sessionError } = await supabase
      .from("sessions")
      .select("id,name,status,category,store,stock_import_id,created_at,closed_at,stock_imports(file_name),session_assignments(user_id)")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (sessionError) throw sessionError;
    const sessionIds = (sessionRows ?? []).map((row) => row.id);
    if (!sessionIds.length) return NextResponse.json({ sessions: [], products: [], entries: [] });

    const [{ data: mappings, error: mappingError }, { data: entries, error: entryError }] = await Promise.all([
      supabase
        .from("session_products")
        .select("session_id,system_qty_snapshot,stock_version_snapshot,products(id,barcode,sku,name,category,store),stock_batches(id,batch_no,inward_tranno,expiry_date)")
        .in("session_id", sessionIds),
      supabase
        .from("count_entries")
        .select("id,local_entry_id,session_id,product_id,stock_batch_id,user_id,quantity,area,note,is_voided,created_on_device_at")
        .in("session_id", sessionIds)
    ]);
    if (mappingError) throw mappingError;
    if (entryError) throw entryError;

    type Mapping = {
      session_id: string; system_qty_snapshot: number | string; stock_version_snapshot: string;
      products: { id: string; barcode: string; sku: string; name: string; category: string; store: string } | null;
      stock_batches: { id: string; batch_no: string | null; inward_tranno: string | null; expiry_date: string | null } | null;
    };
    const typedMappings = (mappings ?? []) as unknown as Mapping[];
    const productMap = new Map<string, {
      id: string; barcode: string; sku: string; name: string; category: string; store: string;
      systemQty: number; stockVersion: string; batches: Array<{ id: string; batchNo?: string; inwardTranno?: string; expiryDate?: string; systemQty: number; stockVersion: string }>;
    }>();
    for (const mapping of typedMappings) {
      if (!mapping.products || !mapping.stock_batches) continue;
      const existing = productMap.get(mapping.products.id) ?? {
        ...mapping.products, systemQty: 0, stockVersion: mapping.stock_version_snapshot, batches: []
      };
      const quantity = Number(mapping.system_qty_snapshot);
      existing.systemQty += quantity;
      existing.batches.push({
        id: mapping.stock_batches.id,
        batchNo: mapping.stock_batches.batch_no ?? undefined,
        inwardTranno: mapping.stock_batches.inward_tranno ?? undefined,
        expiryDate: mapping.stock_batches.expiry_date?.slice(0, 10),
        systemQty: quantity,
        stockVersion: mapping.stock_version_snapshot
      });
      productMap.set(existing.id, existing);
    }

    const sessions = (sessionRows ?? []).map((row) => {
      const source = row as unknown as {
        id: string; name: string; status: "open"; category: string | null; store: string; stock_import_id: string;
        created_at: string; stock_imports: { file_name: string } | null; session_assignments: Array<{ user_id: string | null }>;
      };
      return {
        id: source.id, name: source.name, status: source.status, category: source.category ?? "All", store: source.store,
        stockImportId: source.stock_import_id, masterFileName: source.stock_imports?.file_name ?? "",
        productIds: [...new Set(typedMappings.filter((mapping) => mapping.session_id === source.id).map((mapping) => mapping.products?.id).filter(Boolean))],
        assignees: [], createdAt: source.created_at
      };
    });
    const mappedEntries = (entries ?? []).map((entry) => ({
      id: entry.id, localEntryId: entry.local_entry_id, sessionId: entry.session_id, productId: entry.product_id,
      stockBatchId: entry.stock_batch_id, userId: entry.user_id, userName: "Staff", quantity: Number(entry.quantity),
      area: entry.area ?? undefined, note: entry.note ?? undefined, isVoided: entry.is_voided, createdAt: entry.created_on_device_at
    }));
    return NextResponse.json({ sessions, products: [...productMap.values()], entries: mappedEntries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load assigned sessions";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
