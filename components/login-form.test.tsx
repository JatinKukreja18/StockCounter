import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const single = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) })
  })
}));

describe("LoginForm", () => {
  it("signs in with phone credentials and routes staff to count", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null
    });
    single.mockResolvedValue({ data: { role: "staff" }, error: null });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Mobile number"), "9876543210");
    await userEvent.type(screen.getByLabelText("6-digit PIN"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/count");
    expect(refresh).toHaveBeenCalled();
  });

  it("switches login fields for email", async () => {
    render(<LoginForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Email + password" })
    );

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
