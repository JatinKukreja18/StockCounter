import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const batchSchema = z.object({
  batchKey: z.string().min(1),
  batchNo: z.string(),
  expiryDate: z.string().nullable(),
  inwardTranno: z.string(),
  transactionDate: z.string().nullable(),
  currentStock: z.number(),
  purchasePrice: z.number().nullable(),
  landingCost: z.number().nullable(),
  distributor: z.string()
});
const productSchema = z.object({
  barcode: z.string(),
  sku: z.string().min(1),
  product: z.string().min(1),
  category: z.string(),
  department: z.string(),
  store: z.string(),
  location: z.string(),
  systemQty: z.number(),
  sellingPrice: z.number().nullable(),
  mrp: z.number().nullable(),
  batchCount: z.number(),
  batches: z.array(batchSchema).min(1)
});
const createSchema = z.object({
  name: z.string().min(2).max(150),
  fileName: z.string().min(1).max(255),
  products: z.array(productSchema).min(1).max(5000),
  assigneeIds: z.array(z.string().uuid()).min(1)
});

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from("sessions")
      .select("id,name,status,category,store,stock_import_id,created_at,closed_at,stock_imports(file_name),session_assignments(user_id,users(full_name)),session_products(product_id)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const sessions = (data ?? []).map((row) => {
      const source = row as unknown as {
        id: string; name: string; status: "draft" | "open" | "closed"; category: string | null; store: string;
        stock_import_id: string; created_at: string; closed_at: string | null;
        stock_imports: { file_name: string } | null;
        session_assignments: Array<{ user_id: string | null; users: { full_name: string } | null }>;
        session_products: Array<{ product_id: string }>;
      };
      return {
        id: source.id,
        name: source.name,
        stockImportId: source.stock_import_id,
        masterFileName: source.stock_imports?.file_name ?? "",
        status: source.status,
        category: source.category ?? "All",
        store: source.store,
        productIds: [...new Set(source.session_products.map((item) => item.product_id))],
        assignees: source.session_assignments.map((item) => item.users?.full_name).filter(Boolean),
        createdAt: source.created_at,
        closedAt: source.closed_at ?? undefined
      };
    });
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid session import", details: parsed.error.flatten() }, { status: 400 });
    const { data, error } = await supabase.rpc("create_count_session", {
      p_name: parsed.data.name,
      p_file_name: parsed.data.fileName,
      p_products: parsed.data.products,
      p_assignee_ids: parsed.data.assigneeIds
    });
    if (error) throw error;
    return NextResponse.json({ sessionId: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
