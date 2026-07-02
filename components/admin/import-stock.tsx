"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseStockWorkbook, type GoFrugalImportResult } from "@/lib/gofrugal-import";

export function ImportStock() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<GoFrugalImportResult | null>(null);
  const rows = (result?.products ?? []).flatMap((product) =>
    product.batches.map((batch) => ({ product, batch }))
  );
  const [reading, setReading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function readFile(file: File) {
    setReading(true);
    setDone(false);
    setError("");
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const parsed = parseStockWorkbook(XLSX, book);
      if (!parsed.products.length) throw new Error("No stock products were found in this workbook.");
      setFileName(file.name);
      setResult(parsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read this workbook.");
      setResult(null);
    } finally {
      setReading(false);
    }
  }

  return (
    <div>
      {!rows.length ? (
        <button onClick={() => inputRef.current?.click()} className="group grid w-full place-items-center rounded-2xl border-2 border-dashed border-[#cfd7d2] bg-white px-5 py-12 text-center hover:border-[#63a982] hover:bg-[#fbfdfb]">
          {reading ? <LoaderCircle className="mb-4 animate-spin text-[#18794e]" size={32} /> : <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#e9f6ef] text-[#18794e]"><Upload size={25} /></span>}
          <span className="font-bold">{reading ? "Reading spreadsheet…" : "Choose GoFrugal XLSX export"}</span>
          <span className="mt-2 text-sm text-[#7a847e]">GoFrugal XLS or XLSX · nothing is imported until you confirm</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfe5e1] bg-white">
          <div className="flex items-center gap-3 border-b border-[#e8ece9] p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e9f6ef] text-[#18794e]"><FileSpreadsheet size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{fileName}</p>
              <p className="text-xs text-[#7a847e]">{result?.products.length} products · {result?.metadata.batchRows} countable batches</p>
            </div>
            <button onClick={() => { setResult(null); setDone(false); }} className="text-[#7a847e]"><X size={18} /></button>
          </div>
          {result?.format === "gofrugal-current-stock" && (
            <div className="grid gap-3 border-b border-[#e8ece9] bg-[#f7f9f7] px-4 py-3 text-xs sm:grid-cols-3">
              <div><span className="block text-[#7a847e]">Store</span><b>{result.metadata.store}</b></div>
              <div><span className="block text-[#7a847e]">Report category</span><b>{result.metadata.category}</b></div>
              <div><span className="block text-[#7a847e]">Current stock total</span><b>{result.metadata.grandTotal?.toLocaleString("en-IN") ?? "—"}</b></div>
            </div>
          )}
          {result?.warnings.length ? (
            <div className="flex items-start gap-2 border-b border-[#f2dfaa] bg-[#fff8e7] px-4 py-3 text-xs text-[#874300]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span><b>{result.warnings.length} import {result.warnings.length === 1 ? "warning" : "warnings"}.</b> Most are products without an EAN; they remain searchable by item code or name.</span>
            </div>
          ) : null}
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="sticky top-0 bg-[#f7f9f7] text-[#68726c]">
                <tr>{["EAN Code", "Item Code", "Product", "Batch / inward ref", "Expiry", "Location", "Batch stock"].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
              </thead>
              <tbody>{rows.slice(0, 50).map(({ product, batch }, index) => (
                <tr key={`${batch.batchKey}-${index}`} className="border-t border-[#eef1ef]">
                  <td className="px-4 py-3">{product.barcode || <span className="text-[#b45309]">Missing</span>}</td><td className="px-4 py-3 font-semibold">{product.sku}</td><td className="px-4 py-3">{product.product}</td><td className="px-4 py-3">{batch.batchNo || batch.inwardTranno || "Unlabelled"}</td><td className={`px-4 py-3 font-semibold ${batch.expiryDate ? "" : "text-[#b45309]"}`}>{batch.expiryDate || "No expiry"}</td><td className="px-4 py-3">{product.location || "—"}</td><td className="px-4 py-3 font-bold">{batch.currentStock.toLocaleString("en-IN")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e8ece9] p-4">
            <p className="text-xs text-[#7a847e]">{rows.length > 50 ? `Previewing 50 of ${rows.length} batches` : "All batches shown"}</p>
            <Button onClick={() => setDone(true)} disabled={done}>{done ? <Check size={17} /> : <Upload size={17} />}{done ? "Imported" : `Import ${result?.products.length ?? 0} products / ${rows.length} batches`}</Button>
          </div>
        </div>
      )}
      {error && <div className="mt-3 rounded-xl border border-[#f2c4bf] bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b]">{error}</div>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => event.target.files?.[0] && void readFile(event.target.files[0])} />
    </div>
  );
}
