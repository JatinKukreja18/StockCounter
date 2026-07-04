"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoEntries, demoProducts } from "@/lib/demo-data";
import { indexActiveCountQuantities } from "@/lib/counting";
import type { CountEntry, Product } from "@/lib/types";

export function ExportButton({ sessionId = "s1", products = demoProducts, entries = demoEntries }: { sessionId?: string; products?: Product[]; entries?: CountEntry[] }) {
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const countsByBatch = indexActiveCountQuantities(entries, sessionId);
    const rows = products.flatMap((product) => product.batches.map((batch) => {
      const count = countsByBatch.get(batch.id) ?? 0;
      return {
        Barcode: product.barcode,
        SKU: product.sku,
        Product: product.name,
        "Batch / Inward Ref": batch.batchNo || batch.inwardTranno || "",
        "Expiry Date": batch.expiryDate || "",
        "System Qty": batch.systemQty,
        "Count Qty": count,
        Difference: count - batch.systemQty,
        Notes: ""
      };
    })).filter((row) => row["Count Qty"] > 0);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Adjustments");
    XLSX.writeFile(book, `sekai-stock-adjustment-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  return <Button variant="secondary" onClick={exportXlsx}><Download size={17} /> Export XLSX</Button>;
}
