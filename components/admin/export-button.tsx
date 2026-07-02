"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoEntries, demoProducts } from "@/lib/demo-data";

export function ExportButton({ sessionId = "s1" }: { sessionId?: string }) {
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const rows = demoProducts.flatMap((product) => product.batches.map((batch) => {
      const count = demoEntries
        .filter((entry) => entry.sessionId === sessionId && entry.productId === product.id && entry.stockBatchId === batch.id && !entry.isVoided)
        .reduce((sum, entry) => sum + entry.quantity, 0);
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
