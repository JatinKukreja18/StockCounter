import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  testLocalEntry,
  testProduct,
  testProductTwo,
  testSession
} from "@/components/test-data";
import { CountingScreen } from "./counting-screen";

const mocks = vi.hoisted(() => ({
  loadBootstrap: vi.fn(),
  syncEntries: vi.fn(),
  saveLocalEntry: vi.fn(),
  updateLocalEntry: vi.fn(),
  getLocalEntries: vi.fn()
}));
let localEntries: (typeof testLocalEntry)[] = [];

vi.mock("@/components/barcode-scanner", () => ({
  BarcodeScanner: ({ open }: { open: boolean }) =>
    open ? <div>Scanner open</div> : null
}));
vi.mock("@/hooks/use-staff-bootstrap", () => ({
  useStaffBootstrap: () => ({
    loadBootstrap: mocks.loadBootstrap,
    syncEntries: mocks.syncEntries
  })
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: "u1" } } } })
    }
  })
}));
vi.mock("@/lib/local-db", () => ({
  cacheProducts: vi.fn().mockResolvedValue(undefined),
  deleteLocalEntry: vi.fn().mockResolvedValue(undefined),
  getCachedProducts: vi.fn().mockResolvedValue([]),
  getDeviceId: vi.fn().mockResolvedValue("device-1"),
  getLocalEntries: mocks.getLocalEntries,
  getMeta: vi.fn().mockResolvedValue(null),
  saveLocalEntry: mocks.saveLocalEntry,
  setMeta: vi.fn().mockResolvedValue(undefined),
  updateLocalEntry: mocks.updateLocalEntry
}));

describe("CountingScreen", () => {
  beforeEach(() => {
    localEntries = [];
    mocks.getLocalEntries.mockImplementation(() =>
      Promise.resolve(localEntries)
    );
    mocks.loadBootstrap.mockResolvedValue({
      userId: "u1",
      sessions: [testSession],
      products: [testProduct, testProductTwo],
      entries: []
    });
    mocks.syncEntries.mockResolvedValue({
      results: [],
      syncedAt: "2026-07-03T02:00:00.000Z"
    });
    mocks.saveLocalEntry.mockImplementation(
      async (entry: typeof testLocalEntry) => {
        localEntries = [entry];
      }
    );
    mocks.updateLocalEntry.mockImplementation(
      async (localEntryId: string, patch: Partial<typeof testLocalEntry>) => {
        localEntries = localEntries.map((entry) =>
          entry.localEntryId === localEntryId ? { ...entry, ...patch } : entry
        );
      }
    );
  });

  it("loads assigned products and saves a local count", async () => {
    render(<CountingScreen />);

    await waitFor(() =>
      expect(screen.getByText("Pocari Sweat 500ml")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("Pocari Sweat 500ml"));
    await userEvent.click(screen.getByRole("button", { name: "Add one" }));
    await userEvent.click(screen.getByRole("button", { name: /Add 1/ }));

    await waitFor(() =>
      expect(mocks.saveLocalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "s1",
          productId: "p1",
          quantity: 1,
          syncState: "pending"
        })
      )
    );
    expect(screen.getByText(/Saved on this device/)).toBeInTheDocument();
  });

  it("syncs pending local entries through the hook", async () => {
    localEntries = [testLocalEntry];
    mocks.syncEntries.mockResolvedValue({
      results: [
        { localEntryId: "local-1", status: "synced", serverEntryId: "e1" }
      ],
      syncedAt: "2026-07-03T02:00:00.000Z"
    });

    render(<CountingScreen />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "SYNC NOW" })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole("button", { name: "SYNC NOW" }));

    await waitFor(() =>
      expect(mocks.syncEntries).toHaveBeenCalledWith([testLocalEntry])
    );
    expect(mocks.updateLocalEntry).toHaveBeenCalledWith(
      "local-1",
      expect.objectContaining({ syncState: "synced", serverEntryId: "e1" })
    );
  });
});
