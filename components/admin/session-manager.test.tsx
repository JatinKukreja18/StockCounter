import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { testSession, testStaff } from "@/components/test-data";
import { SessionManager } from "./session-manager";

vi.mock("@/lib/runtime", () => ({ isDemoMode: () => false }));
vi.mock("@/hooks/use-admin-sessions", () => ({
  useAdminSessions: vi.fn()
}));

const { useAdminSessions } = await import("@/hooks/use-admin-sessions");
const mockedUseAdminSessions = vi.mocked(useAdminSessions);

describe("SessionManager", () => {
  it("renders session progress from the sessions hook", () => {
    mockedUseAdminSessions.mockReturnValue({
      sessions: [testSession],
      setSessions: vi.fn(),
      staff: testStaff.filter((person) => person.role === "staff"),
      setStaff: vi.fn(),
      loading: false,
      error: "",
      setError: vi.fn(),
      refresh: vi.fn(),
      createSession: vi.fn(),
      addPeople: vi.fn()
    });

    render(<SessionManager />);

    expect(screen.getByText("Beverages · Main Store")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 SKUs")).toBeInTheDocument();
  });

  it("adds people through the sessions hook", async () => {
    const addPeople = vi.fn().mockResolvedValue(undefined);
    mockedUseAdminSessions.mockReturnValue({
      sessions: [testSession],
      setSessions: vi.fn(),
      staff: testStaff.filter((person) => person.role === "staff"),
      setStaff: vi.fn(),
      loading: false,
      error: "",
      setError: vi.fn(),
      refresh: vi.fn(),
      createSession: vi.fn(),
      addPeople
    });

    render(<SessionManager />);
    await userEvent.click(screen.getByRole("button", { name: "Add people" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Rohan/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Add selected people" })
    );

    await waitFor(() => expect(addPeople).toHaveBeenCalledWith("s1", ["u2"]));
  });
});
