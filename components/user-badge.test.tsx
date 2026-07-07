import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserBadge } from "./user-badge";

const replace = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh })
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: vi.fn()
}));
vi.mock("@/lib/runtime", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } })
}));

const { useMe } = await import("@/hooks/use-me");
const mockedUseMe = vi.mocked(useMe);

describe("UserBadge", () => {
  it("shows admin shortcut for admins and signs out", async () => {
    mockedUseMe.mockReturnValue({
      profile: {
        id: "u1",
        email: "admin@example.com",
        phone: null,
        fullName: "Admin User",
        role: "admin"
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
      isDemo: false
    });

    render(<UserBadge />);

    expect(
      screen.getByRole("link", { name: "Admin dashboard" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalled();
  });
});
