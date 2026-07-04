import type { CountEntry, Product } from "@/lib/types";

export interface SessionProductMapping {
  system_qty_snapshot: number | string;
  stock_version_snapshot: string;
  products: {
    id: string;
    barcode: string;
    sku: string;
    name: string;
    category: string;
    store: string;
  } | null;
  stock_batches: {
    id: string;
    batch_no: string | null;
    inward_tranno: string | null;
    expiry_date: string | null;
  } | null;
}

export interface RawCountEntry {
  id: string;
  local_entry_id: string;
  session_id: string;
  product_id: string;
  stock_batch_id: string;
  user_id: string;
  quantity: number | string;
  area: string | null;
  note: string | null;
  is_voided: boolean;
  created_on_device_at: string;
  users?: { full_name: string } | null;
}

export function mapSessionProducts(mappings: readonly SessionProductMapping[]): Product[] {
  const products = new Map<string, Product>();

  for (const mapping of mappings) {
    if (!mapping.products || !mapping.stock_batches) continue;
    const product = products.get(mapping.products.id) ?? {
      ...mapping.products,
      systemQty: 0,
      stockVersion: mapping.stock_version_snapshot,
      batches: []
    };
    const systemQty = Number(mapping.system_qty_snapshot);
    product.systemQty += systemQty;
    product.batches.push({
      id: mapping.stock_batches.id,
      batchNo: mapping.stock_batches.batch_no ?? undefined,
      inwardTranno: mapping.stock_batches.inward_tranno ?? undefined,
      expiryDate: mapping.stock_batches.expiry_date?.slice(0, 10),
      systemQty,
      stockVersion: mapping.stock_version_snapshot
    });
    products.set(product.id, product);
  }

  return [...products.values()];
}

export function mapCountEntries(entries: readonly RawCountEntry[]): CountEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    localEntryId: entry.local_entry_id,
    sessionId: entry.session_id,
    productId: entry.product_id,
    stockBatchId: entry.stock_batch_id,
    userId: entry.user_id,
    userName: entry.users?.full_name ?? "Staff",
    quantity: Number(entry.quantity),
    area: entry.area ?? undefined,
    note: entry.note ?? undefined,
    isVoided: entry.is_voided,
    createdAt: entry.created_on_device_at
  }));
}
