import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { barcodeIssue, testIssue } from "@/components/test-data";
import { IssuesQueue } from "./issues-queue";

vi.mock("@/lib/runtime", () => ({ isDemoMode: () => false }));
vi.mock("@/hooks/use-admin-issues", () => ({
  useAdminIssues: vi.fn()
}));

const { useAdminIssues } = await import("@/hooks/use-admin-issues");
const mockedUseAdminIssues = vi.mocked(useAdminIssues);

describe("IssuesQueue", () => {
  it("resolves an issue through the hook", async () => {
    const resolveIssue = vi.fn().mockResolvedValue(undefined);
    mockedUseAdminIssues.mockReturnValue({
      issues: [testIssue],
      setIssues: vi.fn(),
      loading: false,
      refresh: vi.fn(),
      resolveIssue,
      searchOptions: vi.fn()
    });

    render(<IssuesQueue />);

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(resolveIssue).toHaveBeenCalledWith({
      issueId: "i1",
      resolution: "accepted",
      quantity: undefined
    });
  });

  it("assigns barcode issues to a searched product option", async () => {
    const resolveIssue = vi.fn().mockResolvedValue(undefined);
    const searchOptions = vi
      .fn()
      .mockResolvedValue([
        { sessionId: "s1", stockBatchId: "b1", label: "Pocari" }
      ]);
    vi.spyOn(window, "prompt").mockReturnValue("Pocari");
    mockedUseAdminIssues.mockReturnValue({
      issues: [barcodeIssue],
      setIssues: vi.fn(),
      loading: false,
      refresh: vi.fn(),
      resolveIssue,
      searchOptions
    });

    render(<IssuesQueue />);
    await userEvent.click(
      screen.getByRole("button", { name: "Assign product & session" })
    );

    await waitFor(() => expect(searchOptions).toHaveBeenCalledWith("Pocari"));
    expect(resolveIssue).toHaveBeenCalledWith({
      issueId: "i2",
      resolution: "assigned",
      sessionId: "s1",
      stockBatchId: "b1"
    });
  });
});
