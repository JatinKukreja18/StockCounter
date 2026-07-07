import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testDashboard } from "@/components/test-data";
import { AdminDashboard } from "./admin-dashboard";

vi.mock("@/hooks/use-admin-dashboard", () => ({
  useAdminDashboard: vi.fn()
}));

const { useAdminDashboard } = await import("@/hooks/use-admin-dashboard");
const mockedUseAdminDashboard = vi.mocked(useAdminDashboard);

describe("AdminDashboard", () => {
  it("renders dashboard stats and activity", () => {
    mockedUseAdminDashboard.mockReturnValue({
      data: testDashboard,
      loading: false,
      error: "",
      refresh: vi.fn()
    });

    render(<AdminDashboard />);

    expect(
      screen.getByRole("heading", { name: "Count overview" })
    ).toBeInTheDocument();
    expect(screen.getByText("Overall progress")).toBeInTheDocument();
    expect(screen.getAllByText("50%")[0]).toBeInTheDocument();
    expect(screen.getByText(/Aiko added/)).toBeInTheDocument();
  });

  it("renders hook errors", () => {
    mockedUseAdminDashboard.mockReturnValue({
      data: null,
      loading: false,
      error: "Could not load dashboard.",
      refresh: vi.fn()
    });

    render(<AdminDashboard />);

    expect(screen.getByText("Could not load dashboard.")).toBeInTheDocument();
  });
});
