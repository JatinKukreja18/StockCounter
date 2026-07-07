import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "staff"]);
export const sessionStatus = pgEnum("session_status", [
  "draft",
  "open",
  "closed"
]);
export const issueStatus = pgEnum("issue_status", [
  "open",
  "accepted",
  "corrected",
  "voided"
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: userRole("role").notNull().default("staff"),
  groupName: text("group_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow()
});

export const stockImports = pgTable("stock_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  importedBy: uuid("imported_by")
    .notNull()
    .references(() => users.id),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  rowCount: numeric("row_count", { precision: 10, scale: 0 }).notNull(),
  isActive: boolean("is_active").notNull().default(true)
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockImportId: uuid("stock_import_id")
      .notNull()
      .references(() => stockImports.id, { onDelete: "cascade" }),
    barcode: text("barcode").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    store: text("store").notNull(),
    systemQty: numeric("system_qty", { precision: 14, scale: 3 }).notNull(),
    stockVersion: timestamp("stock_version", { withTimezone: true }).notNull()
  },
  (table) => [
    index("products_barcode_idx").on(table.barcode),
    index("products_sku_idx").on(table.sku),
    uniqueIndex("products_import_store_sku_unique").on(
      table.stockImportId,
      table.store,
      table.sku
    )
  ]
);

export const stockBatches = pgTable(
  "stock_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchKey: text("batch_key").notNull(),
    batchNo: text("batch_no"),
    inwardTranno: text("inward_tranno"),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    transactionDate: timestamp("transaction_date", { withTimezone: true }),
    currentQty: numeric("current_qty", { precision: 14, scale: 3 }).notNull(),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }),
    landingCost: numeric("landing_cost", { precision: 14, scale: 2 }),
    distributor: text("distributor"),
    stockVersion: timestamp("stock_version", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("stock_batches_product_key_unique").on(
      table.productId,
      table.batchKey
    ),
    index("stock_batches_expiry_idx").on(table.expiryDate)
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: sessionStatus("status").notNull().default("draft"),
    category: text("category"),
    store: text("store").notNull(),
    stockImportId: uuid("stock_import_id")
      .notNull()
      .references(() => stockImports.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("sessions_stock_import_unique").on(table.stockImportId)
  ]
);

export const sessionProducts = pgTable(
  "session_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    stockBatchId: uuid("stock_batch_id")
      .notNull()
      .references(() => stockBatches.id),
    systemQtySnapshot: numeric("system_qty_snapshot", {
      precision: 14,
      scale: 3
    }).notNull(),
    stockVersionSnapshot: timestamp("stock_version_snapshot", {
      withTimezone: true
    }).notNull()
  },
  (table) => [
    uniqueIndex("session_batch_unique").on(table.sessionId, table.stockBatchId),
    index("session_products_product_idx").on(table.productId)
  ]
);

export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupName: text("group_name")
  },
  (table) => [index("session_assignments_session_idx").on(table.sessionId)]
);

export const countEntries = pgTable(
  "count_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localEntryId: uuid("local_entry_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    stockBatchId: uuid("stock_batch_id")
      .notNull()
      .references(() => stockBatches.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    area: text("area"),
    note: text("note"),
    isVoided: boolean("is_voided").notNull().default(false),
    createdOnDeviceAt: timestamp("created_on_device_at", {
      withTimezone: true
    }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    correctedFromId: uuid("corrected_from_id")
  },
  (table) => [
    uniqueIndex("count_entries_local_entry_unique").on(table.localEntryId),
    index("count_entries_session_product_idx").on(
      table.sessionId,
      table.productId
    )
  ]
);

export const syncIssues = pgTable(
  "sync_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localEntryId: uuid("local_entry_id").notNull(),
    entryId: uuid("entry_id").references(() => countEntries.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    barcode: text("barcode").notNull(),
    productId: uuid("product_id").references(() => products.id),
    stockBatchId: uuid("stock_batch_id").references(() => stockBatches.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    code: text("code").notNull(),
    message: text("message").notNull(),
    payload: text("payload").notNull(),
    status: issueStatus("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [index("sync_issues_status_idx").on(table.status)]
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  before: text("before"),
  after: text("after"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow()
});
