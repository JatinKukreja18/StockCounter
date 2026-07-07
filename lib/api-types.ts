import type { ImportedStockProduct } from "@/lib/gofrugal-import";
import type {
  CountEntry,
  CountSession,
  SyncEntryResult,
  SyncIssue
} from "@/lib/types";
import type { Product } from "@/lib/types";

export type UserProfile = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: "admin" | "staff";
};

export type AdminUserRow = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: "admin" | "staff";
  group_name?: string | null;
  created_at?: string;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
  existing?: boolean;
};

export type AdminSessionsResponse = {
  sessions: CountSession[];
};

export type DashboardData = {
  stats: {
    completedProducts: number;
    totalProducts: number;
    overallPercent: number;
    openSessions: number;
    staffUsers: number;
    openIssues: number;
  };
  sessions: Array<{
    id: string;
    name: string;
    completedProducts: number;
    totalProducts: number;
    percent: number;
    assignees: string[];
  }>;
  recent: Array<{
    id: string;
    quantity: number;
    area: string | null;
    syncedAt: string;
    productName: string;
    userName: string;
  }>;
};

export type SessionDetailData = {
  session: CountSession;
  products: Product[];
  entries: CountEntry[];
};

export type AdminIssuesResponse = {
  issues: SyncIssue[];
};

export type IssueOptionsResponse = {
  options: IssueOption[];
};

export type BootstrapData = {
  userId: string;
  sessions: CountSession[];
  products: Product[];
  entries: CountEntry[];
};

export type SyncResponse = {
  results: SyncEntryResult[];
  syncedAt: string;
};

export type IssueOption = {
  sessionId: string;
  stockBatchId: string;
  label: string;
};

export type CreateSessionPayload = {
  name: string;
  fileName: string;
  products: ImportedStockProduct[];
  assigneeIds: string[];
};

export type CreateSessionResponse = {
  sessionId?: string;
  error?: string;
  details?: string;
  hint?: string;
};

export type CreateUserPayload = {
  authMethod: "phone" | "email";
  fullName: string;
  role?: "admin" | "staff";
  mobile?: FormDataEntryValue | null;
  pin?: FormDataEntryValue | null;
  email?: FormDataEntryValue | null;
  password?: FormDataEntryValue | null;
};

export type UpdateUserPayload = CreateUserPayload & {
  id: string;
};

export type IssueResolution =
  | {
      issueId: string;
      resolution: "accepted" | "corrected" | "voided";
      quantity?: number;
    }
  | {
      issueId: string;
      resolution: "assigned";
      sessionId: string;
      stockBatchId: string;
    };

export type { SyncIssue };
