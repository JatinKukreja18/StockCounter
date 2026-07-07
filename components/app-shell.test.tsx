import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn()
}));
vi.mock("@/components/user-badge", () => ({
  UserBadge: () => <div>User badge</div>
}));

const { usePathname } = await import("next/navigation");
const mockedUsePathname = vi.mocked(usePathname);

describe("AppShell", () => {
  it("renders admin navigation outside the count screen", () => {
    mockedUsePathname.mockReturnValue("/admin/sessions");

    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>
    );

    expect(screen.getByText("SEKAI ICHIBA")).toBeInTheDocument();
    expect(screen.getAllByText("Sessions")[0]).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders login pages without shell chrome", () => {
    mockedUsePathname.mockReturnValue("/login");

    render(
      <AppShell>
        <p>Login content</p>
      </AppShell>
    );

    expect(screen.getByText("Login content")).toBeInTheDocument();
    expect(screen.queryByText("SEKAI ICHIBA")).not.toBeInTheDocument();
  });
});
