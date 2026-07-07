import type { CountEntry, CountSession, Product, SyncIssue } from "@/lib/types";

export const demoProducts: Product[] = [
  {
    id: "p1",
    barcode: "4902430780006",
    sku: "JP-DR-001",
    name: "Pocari Sweat 500ml",
    category: "Beverages",
    store: "Main Store",
    systemQty: 48,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b1",
        inwardTranno: "MR1042",
        expiryDate: "2027-02-28",
        systemQty: 48,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p2",
    barcode: "4902102035442",
    sku: "JP-DR-014",
    name: "Calpis Water 500ml",
    category: "Beverages",
    store: "Main Store",
    systemQty: 32,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b2",
        inwardTranno: "MR1098",
        expiryDate: "2027-01-31",
        systemQty: 32,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p3",
    barcode: "4901005510017",
    sku: "JP-SN-023",
    name: "Pocky Chocolate",
    category: "Snacks",
    store: "Main Store",
    systemQty: 24,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b3a",
        inwardTranno: "MR1210",
        expiryDate: "2026-10-31",
        systemQty: 10,
        stockVersion: "2026-07-02T18:00:00.000Z"
      },
      {
        id: "b3b",
        inwardTranno: "MR1384",
        expiryDate: "2027-03-31",
        systemQty: 14,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p4",
    barcode: "4901330573046",
    sku: "JP-SN-041",
    name: "Calbee Seaweed Chips",
    category: "Snacks",
    store: "Main Store",
    systemQty: 18,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b4",
        inwardTranno: "MR1190",
        expiryDate: "2026-12-31",
        systemQty: 18,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p5",
    barcode: "4902505511134",
    sku: "JP-ND-008",
    name: "Nissin Cup Noodles Seafood",
    category: "Noodles",
    store: "Main Store",
    systemQty: 36,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b5",
        inwardTranno: "MR1301",
        expiryDate: "2026-11-30",
        systemQty: 36,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p6",
    barcode: "8801043150624",
    sku: "KR-ND-018",
    name: "Samyang Buldak Original",
    category: "Noodles",
    store: "Main Store",
    systemQty: 40,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b6",
        inwardTranno: "MR1320",
        expiryDate: "2027-01-31",
        systemQty: 40,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p7",
    barcode: "4902881045321",
    sku: "JP-PN-006",
    name: "Meiji Milk Chocolate",
    category: "Confectionery",
    store: "Main Store",
    systemQty: 21,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b7",
        inwardTranno: "MR1350",
        expiryDate: "2027-04-30",
        systemQty: 21,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  },
  {
    id: "p8",
    barcode: "4909411083437",
    sku: "JP-TE-011",
    name: "Kirin Afternoon Tea",
    category: "Beverages",
    store: "Main Store",
    systemQty: 15,
    stockVersion: "2026-07-02T18:00:00.000Z",
    batches: [
      {
        id: "b8",
        inwardTranno: "MR1374",
        expiryDate: "2027-02-28",
        systemQty: 15,
        stockVersion: "2026-07-02T18:00:00.000Z"
      }
    ]
  }
];

export const demoSessions: CountSession[] = [
  {
    id: "s1",
    stockImportId: "imp1",
    masterFileName: "LG04_Beverages_2026-07-03.xls",
    name: "Beverages · Main Store",
    status: "open",
    category: "Beverages",
    store: "Main Store",
    productIds: ["p1", "p2", "p8"],
    assignees: ["Aiko", "Rohan"],
    createdAt: "2026-07-03T00:30:00.000Z"
  },
  {
    id: "s2",
    stockImportId: "imp2",
    masterFileName: "LG04_Snacks_2026-07-03.xls",
    name: "Snacks · Main Store",
    status: "open",
    category: "Snacks",
    store: "Main Store",
    productIds: ["p3", "p4"],
    assignees: ["Meera"],
    createdAt: "2026-07-03T00:35:00.000Z"
  },
  {
    id: "s3",
    stockImportId: "imp3",
    masterFileName: "LG04_Noodles_2026-07-03.xls",
    name: "Noodles · Main Store",
    status: "open",
    category: "Noodles",
    store: "Main Store",
    productIds: ["p5", "p6"],
    assignees: ["Rohan"],
    createdAt: "2026-07-03T00:40:00.000Z"
  }
];

export const demoEntries: CountEntry[] = [
  {
    id: "e1",
    localEntryId: "l1",
    sessionId: "s1",
    productId: "p1",
    stockBatchId: "b1",
    userId: "u1",
    userName: "Aiko",
    quantity: 20,
    area: "Aisle 1",
    isVoided: false,
    createdAt: "2026-07-03T01:10:00.000Z"
  },
  {
    id: "e2",
    localEntryId: "l2",
    sessionId: "s1",
    productId: "p1",
    stockBatchId: "b1",
    userId: "u2",
    userName: "Rohan",
    quantity: 25,
    area: "Back stock",
    isVoided: false,
    createdAt: "2026-07-03T01:18:00.000Z"
  },
  {
    id: "e3",
    localEntryId: "l3",
    sessionId: "s1",
    productId: "p2",
    stockBatchId: "b2",
    userId: "u1",
    userName: "Aiko",
    quantity: 30,
    area: "Aisle 1",
    isVoided: false,
    createdAt: "2026-07-03T01:20:00.000Z"
  },
  {
    id: "e4",
    localEntryId: "l4",
    sessionId: "s2",
    productId: "p3",
    stockBatchId: "b3a",
    userId: "u3",
    userName: "Meera",
    quantity: 26,
    area: "Aisle 3",
    isVoided: false,
    createdAt: "2026-07-03T01:25:00.000Z"
  }
];

export const demoIssues: SyncIssue[] = [
  {
    id: "i1",
    localEntryId: "issue-local-1",
    code: "unusually_high_quantity",
    message: "Quantity 240 is unusually high for Pocky Chocolate.",
    severity: "warning",
    status: "open"
  },
  {
    id: "i2",
    localEntryId: "issue-local-2",
    code: "barcode_not_found",
    message: "Barcode 8850123456789 was not found in this stock import.",
    severity: "error",
    status: "open"
  }
];
