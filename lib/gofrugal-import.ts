import type { WorkBook, WorkSheet } from "xlsx";

export interface ImportedStockProduct {
  barcode: string;
  sku: string;
  product: string;
  category: string;
  department: string;
  store: string;
  location: string;
  systemQty: number;
  sellingPrice: number | null;
  mrp: number | null;
  batchCount: number;
  batches: ImportedStockBatch[];
}

export interface ImportedStockBatch {
  batchKey: string;
  batchNo: string;
  expiryDate: string | null;
  inwardTranno: string;
  transactionDate: string | null;
  currentStock: number;
  purchasePrice: number | null;
  landingCost: number | null;
  distributor: string;
}

export interface GoFrugalImportResult {
  format: "gofrugal-current-stock" | "generic";
  products: ImportedStockProduct[];
  warnings: string[];
  metadata: {
    company: string;
    store: string;
    category: string;
    sheetName: string;
    sourceRows: number;
    batchRows: number;
    grandTotal: number | null;
  };
}

const clean = (value: unknown) => String(value ?? "").trim();

function numberFrom(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = clean(value).replaceAll(",", "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderRow(rows: unknown[][], requiredHeaders: string[]) {
  return rows.findIndex((row) => {
    const values = new Set(row.map(clean));
    return requiredHeaders.every((header) => values.has(header));
  });
}

function headerIndex(row: unknown[], name: string) {
  return row.findIndex((value) => clean(value) === name);
}

function reportCategory(rows: unknown[][]) {
  for (const row of rows.slice(0, 10)) {
    for (const value of row) {
      const match = clean(value).match(/CATEGORY\s*:\s*([^;\n]+)/i);
      if (match) return match[1].trim();
    }
  }
  return "Uncategorised";
}

function reportStore(rows: unknown[][]) {
  const heading = clean(rows[0]?.[0]);
  const companyMatch = heading.match(/^Company\d*:\s*([^,]+),([^,]+?)(?:\d{10})?,GSTNO:/i);
  if (!companyMatch) return "Main Store";
  const code = companyMatch[1].trim();
  const name = companyMatch[2].trim().replace(/(\D)\d{10}$/, "$1");
  return name ? `${code} · ${name}` : code;
}

function parseGoFrugalSheet(
  XLSX: typeof import("xlsx"),
  sheet: WorkSheet,
  sheetName: string
): GoFrugalImportResult {
  // `raw: false` preserves identifier formatting and leading zeroes.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true
  });
  const headerRowIndex = findHeaderRow(rows, ["Item Name", "Item Code", "Current Stock", "EAN Code"]);
  if (headerRowIndex < 0) throw new Error("This sheet does not contain GoFrugal Current Stock Detail columns.");

  const headers = rows[headerRowIndex];
  const columns = {
    itemName: headerIndex(headers, "Item Name"),
    itemCode: headerIndex(headers, "Item Code"),
    currentStock: headerIndex(headers, "Current Stock"),
    ean: headerIndex(headers, "EAN Code"),
    selling: headerIndex(headers, "Selling"),
    purchasePrice: headerIndex(headers, "Pur Price"),
    mrp: headerIndex(headers, "MRP"),
    landingCost: headerIndex(headers, "Landing Cost"),
    batchNo: headerIndex(headers, "Batch No"),
    expiryDate: headerIndex(headers, "Expiry Date"),
    inwardTranno: headerIndex(headers, "Inward Tranno"),
    transactionDate: headerIndex(headers, "Tran Date"),
    distributor: headerIndex(headers, "Dist. Name"),
    department: headerIndex(headers, "Dept. Name"),
    location: headerIndex(headers, "Location")
  };

  const category = reportCategory(rows);
  const store = reportStore(rows);
  const company = clean(rows[1]?.[0]) || "ASIANA FOOD AND BEVERAGE LLP";
  const products: ImportedStockProduct[] = [];
  const warnings: string[] = [];
  let current: ImportedStockProduct | null = null;
  let batchRows = 0;
  let grandTotal: number | null = null;

  function finishCurrent() {
    if (!current) return;
    if (!current.sku) {
      warnings.push(`${current.product}: missing Item Code; row skipped.`);
    } else {
      if (!current.barcode) warnings.push(`${current.product} (${current.sku}): EAN Code is missing; search will still work.`);
      const batchTotal = current.batches.reduce((sum, batch) => sum + batch.currentStock, 0);
      if (Math.abs(batchTotal - current.systemQty) > 0.001) {
        warnings.push(`${current.product} (${current.sku}): batch stock ${batchTotal} does not match product stock ${current.systemQty}.`);
      }
      products.push(current);
    }
    current = null;
  }

  for (const row of rows.slice(headerRowIndex + 1)) {
    const summaryName = clean(row[columns.itemName]);
    const itemCode = clean(row[columns.itemCode]);

    if (summaryName.toLowerCase() === "grand total") {
      finishCurrent();
      grandTotal = numberFrom(row[columns.currentStock]);
      break;
    }

    // JasperReports writes aggregate product values on a summary line, then
    // one or more batch lines containing Item Code/EAN metadata.
    if (summaryName && !itemCode) {
      finishCurrent();
      current = {
        barcode: "",
        sku: "",
        product: summaryName,
        category,
        department: "",
        store,
        location: "",
        systemQty: numberFrom(row[columns.currentStock]) ?? 0,
        sellingPrice: null,
        mrp: null,
        batchCount: 0,
        batches: []
      };
      continue;
    }

    if (itemCode && current) {
      batchRows += 1;
      current.batchCount += 1;
      current.sku ||= itemCode;
      current.barcode ||= clean(row[columns.ean]);
      current.department ||= clean(row[columns.department]);
      current.location ||= clean(row[columns.location]);
      current.sellingPrice ??= numberFrom(row[columns.selling]);
      current.mrp ??= numberFrom(row[columns.mrp]);
      const rawBatchNo = clean(row[columns.batchNo]);
      const batchNo = rawBatchNo && !["none", "null", "."].includes(rawBatchNo.toLowerCase()) ? rawBatchNo : "";
      const inwardTranno = clean(row[columns.inwardTranno]);
      const expiryDate = clean(row[columns.expiryDate]) || null;
      const transactionDate = clean(row[columns.transactionDate]) || null;
      const batchKey = [itemCode, batchNo || inwardTranno || `row-${headerRowIndex + batchRows + 1}`, expiryDate || "no-expiry"].join("::");
      current.batches.push({
        batchKey,
        batchNo,
        expiryDate,
        inwardTranno,
        transactionDate,
        currentStock: numberFrom(row[columns.currentStock]) ?? 0,
        purchasePrice: numberFrom(row[columns.purchasePrice]),
        landingCost: numberFrom(row[columns.landingCost]),
        distributor: clean(row[columns.distributor])
      });

      const batchBarcode = clean(row[columns.ean]);
      if (batchBarcode && current.barcode && batchBarcode !== current.barcode) {
        warnings.push(`${current.product} (${itemCode}) has multiple EAN codes; using ${current.barcode}.`);
      }
    }
  }
  finishCurrent();

  const productTotal = products.reduce((sum, product) => sum + product.systemQty, 0);
  if (grandTotal !== null && Math.abs(productTotal - grandTotal) > 0.001) {
    warnings.push(`Product stock total ${productTotal} does not match report Grand Total ${grandTotal}.`);
  }

  return {
    format: "gofrugal-current-stock",
    products,
    warnings,
    metadata: {
      company,
      store,
      category,
      sheetName,
      sourceRows: rows.length,
      batchRows,
      grandTotal
    }
  };
}

function parseGenericSheet(
  XLSX: typeof import("xlsx"),
  sheet: WorkSheet,
  sheetName: string
): GoFrugalImportResult {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const products = raw.map((row) => ({
    barcode: clean(row.Barcode ?? row.barcode ?? row["Bar Code"] ?? row["EAN Code"]),
    sku: clean(row.SKU ?? row.sku ?? row["Item Code"]),
    product: clean(row.Product ?? row.product ?? row["Item Name"] ?? row.Name),
    category: clean(row.Category ?? row.category) || "Uncategorised",
    department: clean(row.Department ?? row["Dept. Name"]),
    store: clean(row.Store ?? row.store) || "Main Store",
    location: clean(row.Location),
    systemQty: numberFrom(row["System Qty"] ?? row["Current Stock"] ?? row.Stock ?? row.Quantity) ?? 0,
    sellingPrice: numberFrom(row.Selling ?? row["Selling Price"]),
    mrp: numberFrom(row.MRP),
    batchCount: 1,
    batches: [{
      batchKey: `${clean(row.SKU ?? row.sku ?? row["Item Code"])}::default`,
      batchNo: clean(row["Batch No"]),
      expiryDate: clean(row["Expiry Date"]) || null,
      inwardTranno: clean(row["Inward Tranno"]),
      transactionDate: clean(row["Tran Date"]) || null,
      currentStock: numberFrom(row["System Qty"] ?? row["Current Stock"] ?? row.Stock ?? row.Quantity) ?? 0,
      purchasePrice: numberFrom(row["Pur Price"]),
      landingCost: numberFrom(row["Landing Cost"]),
      distributor: clean(row["Dist. Name"])
    }]
  })).filter((row) => row.sku || row.barcode);

  return {
    format: "generic",
    products,
    warnings: products.filter((product) => !product.barcode).map((product) => `${product.product} (${product.sku}): barcode is missing.`),
    metadata: {
      company: "",
      store: products[0]?.store ?? "Main Store",
      category: products[0]?.category ?? "Uncategorised",
      sheetName,
      sourceRows: raw.length + 1,
      batchRows: raw.length,
      grandTotal: null
    }
  };
}

export function parseStockWorkbook(XLSX: typeof import("xlsx"), workbook: WorkBook): GoFrugalImportResult {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a sheet.");
  const sheet = workbook.Sheets[sheetName];
  const preview = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, range: 0 });
  const goFrugalHeader = findHeaderRow(preview.slice(0, 20), ["Item Name", "Item Code", "Current Stock", "EAN Code"]);
  return goFrugalHeader >= 0
    ? parseGoFrugalSheet(XLSX, sheet, sheetName)
    : parseGenericSheet(XLSX, sheet, sheetName);
}
