import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  testEntry,
  testProduct,
  testProductTwo,
  testSession,
  testStaff
} from "@/components/test-data";
import { SessionDetail } from "./session-detail";

vi.mock("@/lib/runtime", () => ({ isDemoMode: () => false }));
vi.mock("@/components/admin/export-button", () => ({
  ExportButton: () => <button type="button">Export XLSX</button>
}));
vi.mock("@/hooks/use-admin-session-detail", () => ({
  useAdminSessionDetail: vi.fn()
}));

const { useAdminSessionDetail } = await import(
  "@/hooks/use-admin-session-detail"
);
const mockedUseAdminSessionDetail = vi.mocked(useAdminSessionDetail);

function sessionDetailHook(
  overrides: Partial<ReturnType<typeof useAdminSessionDetail>> = {}
) {
  return {
    sessionData: testSession,
    setSessionData: vi.fn(),
    products: [testProduct, testProductTwo],
    setProducts: vi.fn(),
    entries: [testEntry],
    setEntries: vi.fn(),
    staff: testStaff.filter((person) => person.role === "staff"),
    setStaff: vi.fn(),
    loading: false,
    error: "",
    refresh: vi.fn(),
    refreshSession: vi.fn(),
    closeSession: vi.fn(),
    changeEntry: vi.fn(),
    addPeople: vi.fn(),
    renameSession: vi.fn(),
    ...overrides
  };
}

describe("SessionDetail", () => {
  it("renders variance rows and entry history", async () => {
    mockedUseAdminSessionDetail.mockReturnValue(sessionDetailHook());

    render(<SessionDetail session={testSession} />);

    expect(
      screen.getByRole("button", { name: "Beverages · Main Store" })
    ).toBeInTheDocument();
    expect(screen.getByText("Pocari Sweat 500ml")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Entry history" })
    );

    expect(
      screen.getByText(
        (_, element) =>
          (element?.tagName.toLowerCase() === "p" &&
            element.textContent?.includes("Aiko") &&
            element.textContent.includes("added") &&
            element.textContent.includes("Pocari Sweat 500ml")) ??
          false
      )
    ).toBeInTheDocument();
  });

  it("renames a session on blur", async () => {
    const renameSession = vi.fn().mockResolvedValue("Updated Session");
    mockedUseAdminSessionDetail.mockReturnValue(
      sessionDetailHook({ renameSession })
    );

    render(<SessionDetail session={testSession} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Beverages · Main Store" })
    );
    await userEvent.clear(screen.getByLabelText("Session name"));
    await userEvent.type(
      screen.getByLabelText("Session name"),
      "Updated Session"
    );
    await userEvent.tab();

    await waitFor(() =>
      expect(renameSession).toHaveBeenCalledWith("Updated Session")
    );
  });

  it("adds people through the detail hook", async () => {
    const addPeople = vi.fn().mockResolvedValue(undefined);
    mockedUseAdminSessionDetail.mockReturnValue(
      sessionDetailHook({ addPeople })
    );

    render(<SessionDetail session={testSession} />);
    await userEvent.click(screen.getByRole("button", { name: "Add people" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Rohan/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Add selected people" })
    );

    await waitFor(() => expect(addPeople).toHaveBeenCalledWith(["u2"]));
  });
});
