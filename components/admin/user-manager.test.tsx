import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { testStaff } from "@/components/test-data";
import { UserManager } from "./user-manager";

vi.mock("@/hooks/use-admin-users", () => ({
  useAdminUsers: vi.fn()
}));

const { useAdminUsers } = await import("@/hooks/use-admin-users");
const mockedUseAdminUsers = vi.mocked(useAdminUsers);

describe("UserManager", () => {
  it("renders users and creates a staff account", async () => {
    const saveUser = vi.fn().mockResolvedValue({ existing: false, users: [] });
    mockedUseAdminUsers.mockReturnValue({
      users: testStaff,
      setUsers: vi.fn(),
      loading: false,
      error: "",
      setError: vi.fn(),
      refresh: vi.fn(),
      saveUser
    });

    render(<UserManager />);

    expect(screen.getByText("Aiko")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Full name"), "Meera");
    await userEvent.type(
      screen.getByPlaceholderText("10-digit mobile number"),
      "9876543210"
    );
    await userEvent.type(screen.getByPlaceholderText("6-digit PIN"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /Create staff user/ })
    );

    await waitFor(() =>
      expect(saveUser).toHaveBeenCalledWith({
        authMethod: "phone",
        fullName: "Meera",
        role: "staff",
        mobile: "9876543210",
        pin: "123456"
      })
    );
  });

  it("switches to edit mode for staff users", async () => {
    mockedUseAdminUsers.mockReturnValue({
      users: testStaff,
      setUsers: vi.fn(),
      loading: false,
      error: "",
      setError: vi.fn(),
      refresh: vi.fn(),
      saveUser: vi.fn()
    });

    render(<UserManager />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Aiko" }));

    expect(
      screen.getByRole("heading", { name: "Edit staff account" })
    ).toBeInTheDocument();
  });
});
