import { NextResponse } from "next/server";
import {
  mapCountEntries,
  mapSessionProducts,
  type RawCountEntry,
  type SessionProductMapping
} from "@/lib/session-data";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase, profile } = await getAuthenticatedProfile();
    const { data: sessionRows, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "id,name,status,category,store,stock_import_id,created_at,closed_at,stock_imports(file_name),session_assignments!inner(user_id)"
      )
      .eq("status", "open")
      .eq("session_assignments.user_id", profile.id)
      .order("created_at", { ascending: false });
    if (sessionError) throw sessionError;
    const sessionIds = (sessionRows ?? []).map((row) => row.id);
    if (!sessionIds.length) {
      return NextResponse.json({
        userId: profile.id,
        sessions: [],
        products: [],
        entries: []
      });
    }

    const [
      { data: mappings, error: mappingError },
      { data: entries, error: entryError }
    ] = await Promise.all([
      supabase
        .from("session_products")
        .select(
          "session_id,system_qty_snapshot,stock_version_snapshot,products(id,barcode,sku,name,category,store),stock_batches(id,batch_no,inward_tranno,expiry_date)"
        )
        .in("session_id", sessionIds),
      supabase
        .from("count_entries")
        .select(
          "id,local_entry_id,session_id,product_id,stock_batch_id,user_id,quantity,area,note,is_voided,created_on_device_at,users(full_name)"
        )
        .in("session_id", sessionIds)
    ]);
    if (mappingError) throw mappingError;
    if (entryError) throw entryError;

    type BootstrapMapping = SessionProductMapping & { session_id: string };
    const typedMappings = (mappings ?? []) as unknown as BootstrapMapping[];
    const products = mapSessionProducts(typedMappings);

    const sessions = (sessionRows ?? []).map((row) => {
      const source = row as unknown as {
        id: string;
        name: string;
        status: "open";
        category: string | null;
        store: string;
        stock_import_id: string;
        created_at: string;
        stock_imports: { file_name: string } | null;
        session_assignments: Array<{ user_id: string | null }>;
      };
      return {
        id: source.id,
        name: source.name,
        status: source.status,
        category: source.category ?? "All",
        store: source.store,
        stockImportId: source.stock_import_id,
        masterFileName: source.stock_imports?.file_name ?? "",
        productIds: [
          ...new Set(
            typedMappings
              .filter((mapping) => mapping.session_id === source.id)
              .map((mapping) => mapping.products?.id)
              .filter(Boolean)
          )
        ],
        assignees: [],
        createdAt: source.created_at
      };
    });
    return NextResponse.json({
      userId: profile.id,
      sessions,
      products,
      entries: mapCountEntries((entries ?? []) as unknown as RawCountEntry[])
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load assigned sessions";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
