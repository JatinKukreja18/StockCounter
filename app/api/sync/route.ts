import { NextResponse } from "next/server";
import { z } from "zod";
import { demoProducts, demoSessions } from "@/lib/demo-data";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import type { IssueCode, SyncEntryResult } from "@/lib/types";

const entrySchema = z.object({
  localEntryId: z.string().uuid(),
  sessionId: z.string().min(1),
  productId: z.string().optional(),
  barcode: z.string().min(1).max(100),
  sku: z.string().optional(),
  productName: z.string().optional(),
  stockBatchId: z.string().min(1),
  batchNo: z.string().optional(),
  inwardTranno: z.string().optional(),
  expiryDate: z.string().optional(),
  quantity: z.number().positive().max(100000),
  area: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  deviceId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stockVersion: z.string().datetime().optional()
});

const payloadSchema = z.object({ entries: z.array(entrySchema).min(1).max(250) });

type DbProduct = {
  id: string;
  barcode: string;
  stock_version: string;
};

type DbEntry = {
  id: string;
  local_entry_id: string;
  quantity: number | string;
  area: string | null;
  note: string | null;
};

type DbBatch = {
  id: string;
  product_id: string;
  stock_version: string;
};

type DbSessionProduct = {
  session_id: string;
  stock_batch_id: string;
  stock_version_snapshot: string;
  sessions: { id: string; status: "draft" | "open" | "closed" } | null;
};

function issue(
  localEntryId: string,
  code: IssueCode,
  message: string,
  severity: "warning" | "error" = "error"
): SyncEntryResult {
  return { localEntryId, status: "issue", issue: { code, message, severity } };
}

function demoSync(entries: z.infer<typeof entrySchema>[]) {
  return entries.map<SyncEntryResult>((entry) => {
    const product = demoProducts.find((item) => item.id === entry.productId || item.barcode === entry.barcode);
    if (!product) return issue(entry.localEntryId, "barcode_not_found", `Barcode ${entry.barcode} was not found in the active stock import.`);
    if (!product.batches.some((batch) => batch.id === entry.stockBatchId)) {
      return issue(entry.localEntryId, "no_open_session", `${product.name} batch ${entry.batchNo || entry.inwardTranno || entry.stockBatchId} is not in the cached stock import.`);
    }
    const sessions = demoSessions.filter((session) => session.id === entry.sessionId && session.status === "open" && session.productIds.includes(product.id));
    if (!sessions.length) return issue(entry.localEntryId, "no_open_session", `${product.name} does not belong to an open count session.`);
    if (sessions.length > 1) return issue(entry.localEntryId, "multiple_open_sessions", `${product.name} matches ${sessions.length} open sessions.`);
    if (entry.quantity >= 100) return issue(entry.localEntryId, "unusually_high_quantity", `Quantity ${entry.quantity} is unusually high. Entry is queued for admin review.`, "warning");
    return { localEntryId: entry.localEntryId, status: "synced", serverEntryId: crypto.randomUUID() };
  });
}

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sync batch", details: parsed.error.flatten() }, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ results: demoSync(parsed.data.entries), syncedAt: new Date().toISOString() });
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const results: SyncEntryResult[] = [];

    for (const entry of parsed.data.entries) {
      const { data: existingRaw } = await supabase
        .from("count_entries")
        .select("id,local_entry_id,quantity,area,note")
        .eq("local_entry_id", entry.localEntryId)
        .maybeSingle();
      const existing = existingRaw as DbEntry | null;

      if (existing) {
        const edited = Number(existing.quantity) !== entry.quantity ||
          (existing.area ?? "") !== (entry.area ?? "") ||
          (existing.note ?? "") !== (entry.note ?? "");
        if (edited) {
          results.push(issue(entry.localEntryId, "edited_after_sync", "This device entry was changed after it had already synced."));
        } else {
          results.push({
            localEntryId: entry.localEntryId,
            status: "duplicate",
            serverEntryId: existing.id,
            issue: {
              code: "duplicate_local_entry",
              message: "This local entry was already synced; no duplicate count was added.",
              severity: "warning"
            }
          });
        }
        continue;
      }

      const { data: productRaw } = await supabase
        .from("products")
        .select("id,barcode,stock_version")
        .eq(entry.productId ? "id" : "barcode", entry.productId ?? entry.barcode)
        .limit(2);
      const product = (productRaw as DbProduct[] | null)?.[0];
      if (!product) {
        const result = issue(entry.localEntryId, "barcode_not_found", `Barcode ${entry.barcode} was not found in the active stock import.`);
        await supabase.from("sync_issues").insert({
          local_entry_id: entry.localEntryId,
          user_id: user.id,
          barcode: entry.barcode,
          code: result.issue?.code,
          message: result.issue?.message,
          payload: entry
        });
        results.push(result);
        continue;
      }

      const { data: batchRaw } = await supabase
        .from("stock_batches")
        .select("id,product_id,stock_version")
        .eq("id", entry.stockBatchId)
        .eq("product_id", product.id)
        .maybeSingle();
      const batch = batchRaw as DbBatch | null;
      if (!batch) {
        const result = issue(entry.localEntryId, "no_open_session", "This product batch is no longer present in the active stock import.");
        await supabase.from("sync_issues").insert({
          local_entry_id: entry.localEntryId,
          user_id: user.id,
          barcode: entry.barcode,
          product_id: product.id,
          code: result.issue?.code,
          message: result.issue?.message,
          payload: entry
        });
        results.push(result);
        continue;
      }

      const { data: mappingsRaw } = await supabase
        .from("session_products")
        .select("session_id,stock_batch_id,stock_version_snapshot,sessions!inner(id,status)")
        .eq("stock_batch_id", batch.id)
        .eq("session_id", entry.sessionId);
      const mappings = (mappingsRaw as unknown as DbSessionProduct[] | null) ?? [];
      const openMappings = mappings.filter((mapping) => mapping.sessions?.status === "open");

      let result: SyncEntryResult | null = null;
      if (!openMappings.length) {
        result = issue(entry.localEntryId, mappings.some((mapping) => mapping.sessions?.status === "closed") ? "session_closed" : "no_open_session",
          mappings.some((mapping) => mapping.sessions?.status === "closed")
            ? "The matching count session is already closed."
            : "This product does not belong to an open count session."
        );
      } else if (openMappings.length > 1) {
        result = issue(entry.localEntryId, "multiple_open_sessions", `This product matches ${openMappings.length} open sessions.`);
      }

      if (result) {
        await supabase.from("sync_issues").insert({
          local_entry_id: entry.localEntryId,
          user_id: user.id,
          barcode: entry.barcode,
          product_id: product.id,
          stock_batch_id: batch.id,
          code: result.issue?.code,
          message: result.issue?.message,
          payload: entry
        });
        results.push(result);
        continue;
      }

      const mapping = openMappings[0];
      const warnings: Array<{ code: IssueCode; message: string }> = [];
      if (entry.stockVersion && new Date(batch.stock_version).getTime() > new Date(entry.stockVersion).getTime()) {
        warnings.push({ code: "stock_changed", message: "This batch's stock changed after the session was created." });
      }
      if (entry.quantity >= 100) {
        warnings.push({ code: "unusually_high_quantity", message: `Quantity ${entry.quantity} is unusually high.` });
      }

      const { data: insertedRaw, error } = await supabase
        .from("count_entries")
        .insert({
          local_entry_id: entry.localEntryId,
          device_id: entry.deviceId,
          session_id: mapping.session_id,
          product_id: product.id,
          stock_batch_id: batch.id,
          user_id: user.id,
          quantity: entry.quantity,
          area: entry.area,
          note: entry.note,
          created_on_device_at: entry.createdAt
        })
        .select("id")
        .single();
      if (error) throw error;
      const inserted = insertedRaw as { id: string };

      for (const warning of warnings) {
        await supabase.from("sync_issues").insert({
          local_entry_id: entry.localEntryId,
          entry_id: inserted.id,
          user_id: user.id,
          barcode: entry.barcode,
          product_id: product.id,
          stock_batch_id: batch.id,
          session_id: mapping.session_id,
          code: warning.code,
          message: warning.message,
          payload: entry
        });
      }

      results.push(warnings.length
        ? { localEntryId: entry.localEntryId, status: "synced", serverEntryId: inserted.id, issue: { ...warnings[0], severity: "warning" } }
        : { localEntryId: entry.localEntryId, status: "synced", serverEntryId: inserted.id }
      );
    }

    return NextResponse.json({ results, syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
