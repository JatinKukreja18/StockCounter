export type Role = "admin" | "staff";
export type SessionStatus = "draft" | "open" | "closed";
export type SyncState = "pending" | "syncing" | "synced" | "failed";
export type IssueCode =
  | "duplicate_local_entry"
  | "multiple_open_sessions"
  | "no_open_session"
  | "session_closed"
  | "stock_changed"
  | "edited_after_sync"
  | "unusually_high_quantity"
  | "barcode_not_found";

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string;
  store: string;
  systemQty: number;
  stockVersion: string;
  batches: StockBatch[];
}

export interface StockBatch {
  id: string;
  batchNo?: string;
  inwardTranno?: string;
  expiryDate?: string;
  systemQty: number;
  stockVersion: string;
}

export interface CountSession {
  id: string;
  name: string;
  stockImportId: string;
  masterFileName: string;
  status: SessionStatus;
  category: string;
  store: string;
  productIds: string[];
  assignees: string[];
  createdAt: string;
  closedAt?: string;
  completedProductCount?: number;
  entryCount?: number;
}

export interface LocalCountEntry {
  localEntryId: string;
  sessionId: string;
  productId?: string;
  barcode: string;
  sku?: string;
  productName?: string;
  stockBatchId?: string;
  batchNo?: string;
  inwardTranno?: string;
  expiryDate?: string;
  quantity: number;
  area?: string;
  note?: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  stockVersion?: string;
  syncState: SyncState;
  syncError?: string;
  serverEntryId?: string;
}

export interface SyncIssue {
  id: string;
  localEntryId: string;
  code: IssueCode;
  message: string;
  severity: "warning" | "error";
  status: "open" | "accepted" | "corrected" | "voided";
  createdAt?: string;
}

export interface SyncEntryResult {
  localEntryId: string;
  status: "synced" | "duplicate" | "issue";
  serverEntryId?: string;
  issue?: Pick<SyncIssue, "code" | "message" | "severity">;
}

export interface CountEntry {
  id: string;
  localEntryId: string;
  sessionId: string;
  productId: string;
  stockBatchId: string;
  userId: string;
  userName: string;
  quantity: number;
  area?: string;
  note?: string;
  isVoided: boolean;
  createdAt: string;
}
