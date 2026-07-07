"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoEntries, demoProducts } from "@/lib/demo-data";
import { indexActiveProductCountQuantities } from "@/lib/counting";
import type { CountEntry, Product } from "@/lib/types";

export function ExportButton({
  sessionId = "s1",
  products = demoProducts,
  entries = demoEntries
}: {
  sessionId?: string;
  products?: Product[];
  entries?: CountEntry[];
}) {
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const countsByProduct = indexActiveProductCountQuantities(
      entries,
      sessionId
    );
    const rows = products
      .map((product) => {
        const count = countsByProduct.get(product.id) ?? 0;
        return {
          Barcode: product.barcode,
          SKU: product.sku,
          Product: product.name,
          "System Qty": product.systemQty,
          "Count Qty": count,
          Difference: count - product.systemQty,
          "Batch allocation":
            "Assign any adjustment to the appropriate GoFrugal batch",
          Notes: ""
        };
      })
      .filter((_, index) => countsByProduct.has(products[index].id));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Adjustments");
    XLSX.writeFile(
      book,
      `sekai-stock-adjustment-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }
  return (
    <Button variant="secondary" onClick={exportXlsx}>
      <Download size={17} /> Export XLSX
    </Button>
  );
}
