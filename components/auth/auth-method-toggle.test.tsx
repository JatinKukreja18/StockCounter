import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthMethodToggle } from "./auth-method-toggle";

describe("AuthMethodToggle", () => {
  it("marks the selected method and emits changes", async () => {
    const onChange = vi.fn();
    render(<AuthMethodToggle value="phone" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Phone + PIN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Email + password" })
    );

    expect(onChange).toHaveBeenCalledWith("email");
  });
});
