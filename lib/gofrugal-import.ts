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
const normalizeHeader = (value: unknown) => clean(value).toUpperCase().replace(/\s+/g, " ");

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

function normalizedHeaderIndex(row: unknown[], name: string) {
  const target = normalizeHeader(name);
  return row.findIndex((value) => normalizeHeader(value) === target);
}

function findNormalizedHeaderRow(rows: unknown[][], requiredHeaders: string[]) {
  const required = requiredHeaders.map(normalizeHeader);
  return rows.findIndex((row) => {
    const values = new Set(row.map(normalizeHeader));
    return required.every((header) => values.has(header));
  });
}

function reportCategory(rows: unknown[][]) {
  for (const row of rows.slice(0, 10)) {
    for (const value of row) {
      const match = clean(value).match(/CATEGORY\s*[:=]\s*([^;\n]+)/i);
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

function reportCompany(rows: unknown[][]) {
  for (const row of rows.slice(0, 10)) {
    for (const value of row) {
      const text = clean(value);
      const labelled = text.match(/^Company Name\s*:\s*(.+)$/i);
      if (labelled) return labelled[1].trim();
      if (/ASIANA FOOD AND BEVERAGE LLP/i.test(text)) return "ASIANA FOOD AND BEVERAGE LLP";
    }
  }
  return "ASIANA FOOD AND BEVERAGE LLP";
}

function productTotalBatch(product: ImportedStockProduct): ImportedStockProduct {
  const purchasePrices = new Set(product.batches.map((batch) => batch.purchasePrice));
  const landingCosts = new Set(product.batches.map((batch) => batch.landingCost));
  const distributors = new Set(product.batches.map((batch) => batch.distributor).filter(Boolean));
  return {
    ...product,
    batchCount: 1,
    batches: [{
      batchKey: `${product.sku}::product-total`,
      batchNo: "",
      expiryDate: null,
      inwardTranno: "",
      transactionDate: null,
      currentStock: product.systemQty,
      purchasePrice: purchasePrices.size === 1 ? [...purchasePrices][0] : null,
      landingCost: landingCosts.size === 1 ? [...landingCosts][0] : null,
      distributor: distributors.size === 1 ? [...distributors][0] : ""
    }]
  };
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
  const company = reportCompany(rows);
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
      products.push(productTotalBatch(current));
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

function parseGoFrugalFlatSheet(
  XLSX: typeof import("xlsx"),
  sheet: WorkSheet,
  sheetName: string
): GoFrugalImportResult {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true
  });
  const headerRowIndex = findNormalizedHeaderRow(rows.slice(0, 20), ["ITEM CODE", "CURRENT STK.", "EAN CODE"]);
  if (headerRowIndex < 0) throw new Error("This sheet does not contain GoFrugal Current Stock Detail columns.");

  const headers = rows[headerRowIndex];
  const columns = {
    category: normalizedHeaderIndex(headers, "CATEGORY"),
    subCategory: normalizedHeaderIndex(headers, "SUB CATEGORY"),
    itemCode: normalizedHeaderIndex(headers, "ITEM CODE"),
    currentStock: normalizedHeaderIndex(headers, "CURRENT STK."),
    ean: normalizedHeaderIndex(headers, "EAN CODE"),
    barcodeValue: normalizedHeaderIndex(headers, "BARCODE VALUE"),
    selling: normalizedHeaderIndex(headers, "SELLING"),
    purchasePrice: normalizedHeaderIndex(headers, "PUR PRICE"),
    mrp: normalizedHeaderIndex(headers, "MRP"),
    landingCost: normalizedHeaderIndex(headers, "LANDING COST"),
    batchNo: normalizedHeaderIndex(headers, "BATCH NO"),
    expiryDate: normalizedHeaderIndex(headers, "EXPIRY DATE"),
    inwardTranno: normalizedHeaderIndex(headers, "INWARD TRANNO"),
    transactionDate: normalizedHeaderIndex(headers, "TRAN DATE"),
    distributor: normalizedHeaderIndex(headers, "DIST. NAME"),
    rack: normalizedHeaderIndex(headers, "RACK"),
    shelf: normalizedHeaderIndex(headers, "SHELF"),
    box: normalizedHeaderIndex(headers, "BOX")
  };

  const category = reportCategory(rows);
  const company = reportCompany(rows);
  const address = rows.slice(0, 10).flat().map(clean).find((value) => /^Company Address:/i.test(value));
  const addressParts = address?.replace(/^Company Address:/i, "").split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const store = addressParts.length > 1 ? `${addressParts[0]} · ${addressParts[1]}` : addressParts[0] || "Main Store";
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
      products.push(productTotalBatch(current));
    }
    current = null;
  }

  for (const [offset, row] of rows.slice(headerRowIndex + 1).entries()) {
    const firstCell = clean(row[0]);
    const itemMatch = firstCell.match(/^ITEM NAME\s*:\s*(.+)$/i);
    if (itemMatch) {
      finishCurrent();
      current = {
        barcode: "",
        sku: "",
        product: itemMatch[1].trim(),
        category,
        department: "",
        store,
        location: "",
        systemQty: 0,
        sellingPrice: null,
        mrp: null,
        batchCount: 0,
        batches: []
      };
      continue;
    }

    if (/^GROUP TOTAL\b/i.test(firstCell) && current) {
      current.systemQty = numberFrom(row[columns.currentStock]) ?? current.systemQty;
      finishCurrent();
      continue;
    }

    if (/^(NET|GRAND) TOTAL\b/i.test(firstCell)) {
      finishCurrent();
      grandTotal = numberFrom(row[columns.currentStock]);
      break;
    }

    const itemCode = clean(row[columns.itemCode]);
    if (!itemCode || !current) continue;
    batchRows += 1;
    current.batchCount += 1;
    current.sku ||= itemCode;
    current.barcode ||= clean(row[columns.ean]) || clean(row[columns.barcodeValue]);
    current.category ||= clean(row[columns.category]);
    current.department ||= clean(row[columns.subCategory]);
    current.sellingPrice ??= numberFrom(row[columns.selling]);
    current.mrp ??= numberFrom(row[columns.mrp]);
    const location = [
      clean(row[columns.rack]) && `Rack ${clean(row[columns.rack])}`,
      clean(row[columns.shelf]) && `Shelf ${clean(row[columns.shelf])}`,
      clean(row[columns.box]) && `Box ${clean(row[columns.box])}`
    ].filter(Boolean).join(" · ");
    current.location ||= location;
    const rawBatchNo = clean(row[columns.batchNo]);
    const batchNo = rawBatchNo && !["none", "null", "."].includes(rawBatchNo.toLowerCase()) ? rawBatchNo : "";
    const inwardTranno = clean(row[columns.inwardTranno]);
    const expiryDate = clean(row[columns.expiryDate]) || null;
    current.batches.push({
      batchKey: [itemCode, batchNo || inwardTranno || `row-${headerRowIndex + offset + 2}`, expiryDate || "no-expiry"].join("::"),
      batchNo,
      expiryDate,
      inwardTranno,
      transactionDate: clean(row[columns.transactionDate]) || null,
      currentStock: numberFrom(row[columns.currentStock]) ?? 0,
      purchasePrice: numberFrom(row[columns.purchasePrice]),
      landingCost: numberFrom(row[columns.landingCost]),
      distributor: clean(row[columns.distributor])
    });
  }
  finishCurrent();

  const productTotal = products.reduce((sum, product) => sum + product.systemQty, 0);
  if (grandTotal !== null && Math.abs(productTotal - grandTotal) > 0.001) {
    warnings.push(`Product stock total ${productTotal} does not match report Net Total ${grandTotal}.`);
  }
  return {
    format: "gofrugal-current-stock",
    products,
    warnings,
    metadata: { company, store, category, sheetName, sourceRows: rows.length, batchRows, grandTotal }
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
  if (goFrugalHeader >= 0) return parseGoFrugalSheet(XLSX, sheet, sheetName);
  const flatGoFrugalHeader = findNormalizedHeaderRow(preview.slice(0, 20), ["ITEM CODE", "CURRENT STK.", "EAN CODE"]);
  return flatGoFrugalHeader >= 0
    ? parseGoFrugalFlatSheet(XLSX, sheet, sheetName)
    : parseGenericSheet(XLSX, sheet, sheetName);
}
