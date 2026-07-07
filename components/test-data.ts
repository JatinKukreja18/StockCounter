import type {
  AdminUserRow,
  DashboardData,
  SessionDetailData
} from "@/lib/api-types";
import type {
  CountEntry,
  CountSession,
  LocalCountEntry,
  Product,
  SyncIssue
} from "@/lib/types";

export const testProduct: Product = {
  id: "p1",
  barcode: "4902430780006",
  sku: "JP-DR-001",
  name: "Pocari Sweat 500ml",
  category: "Beverages",
  store: "Main Store",
  systemQty: 48,
  stockVersion: "v1",
  batches: [
    {
      id: "b1",
      inwardTranno: "MR1042",
      expiryDate: "2027-02-28",
      systemQty: 48,
      stockVersion: "v1"
    }
  ]
};

export const testProductTwo: Product = {
  id: "p2",
  barcode: "4902102035442",
  sku: "JP-DR-014",
  name: "Calpis Water 500ml",
  category: "Beverages",
  store: "Main Store",
  systemQty: 32,
  stockVersion: "v1",
  batches: [
    {
      id: "b2",
      inwardTranno: "MR1098",
      expiryDate: "2027-01-31",
      systemQty: 32,
      stockVersion: "v1"
    }
  ]
};

export const testSession: CountSession = {
  id: "s1",
  name: "Beverages · Main Store",
  stockImportId: "imp1",
  masterFileName: "stock.xls",
  status: "open",
  category: "Beverages",
  store: "Main Store",
  productIds: ["p1", "p2"],
  assignees: ["Aiko"],
  assigneeIds: ["u1"],
  createdAt: "2026-07-03T00:30:00.000Z",
  completedProductCount: 1,
  entryCount: 1
};

export const testEntry: CountEntry = {
  id: "e1",
  localEntryId: "l1",
  sessionId: "s1",
  productId: "p1",
  stockBatchId: "b1",
  userId: "u1",
  userName: "Aiko",
  quantity: 45,
  area: "Aisle 1",
  isVoided: false,
  createdAt: "2026-07-03T01:10:00.000Z"
};

export const testLocalEntry: LocalCountEntry = {
  localEntryId: "local-1",
  sessionId: "s1",
  productId: "p1",
  barcode: "4902430780006",
  sku: "JP-DR-001",
  productName: "Pocari Sweat 500ml",
  stockBatchId: "b1",
  inwardTranno: "MR1042",
  expiryDate: "2027-02-28",
  quantity: 3,
  area: "Aisle 1",
  deviceId: "device-1",
  createdAt: "2026-07-03T01:12:00.000Z",
  updatedAt: "2026-07-03T01:12:00.000Z",
  stockVersion: "v1",
  syncState: "pending"
};

export const testStaff: AdminUserRow[] = [
  {
    id: "u1",
    email: "aiko@example.com",
    phone: null,
    full_name: "Aiko",
    role: "staff"
  },
  {
    id: "u2",
    email: "rohan@example.com",
    phone: "+919876543210",
    full_name: "Rohan",
    role: "staff"
  },
  {
    id: "admin-1",
    email: "admin@example.com",
    phone: null,
    full_name: "Admin",
    role: "admin"
  }
];

export const testIssue: SyncIssue = {
  id: "i1",
  localEntryId: "local-1",
  code: "unusually_high_quantity",
  message: "Quantity is unusually high.",
  severity: "warning",
  status: "open",
  createdAt: "2026-07-03T01:10:00.000Z"
};

export const barcodeIssue: SyncIssue = {
  id: "i2",
  localEntryId: "local-2",
  code: "barcode_not_found",
  message: "Barcode was not found.",
  severity: "error",
  status: "open"
};

export const testDashboard: DashboardData = {
  stats: {
    completedProducts: 1,
    totalProducts: 2,
    overallPercent: 50,
    openSessions: 1,
    staffUsers: 2,
    openIssues: 1
  },
  sessions: [
    {
      id: "s1",
      name: "Beverages · Main Store",
      completedProducts: 1,
      totalProducts: 2,
      percent: 50,
      assignees: ["Aiko"]
    }
  ],
  recent: [
    {
      id: "e1",
      quantity: 45,
      area: "Aisle 1",
      syncedAt: "2026-07-03T01:10:00.000Z",
      productName: "Pocari Sweat 500ml",
      userName: "Aiko"
    }
  ]
};

export const testSessionDetail: SessionDetailData = {
  session: testSession,
  products: [testProduct, testProductTwo],
  entries: [testEntry]
};
