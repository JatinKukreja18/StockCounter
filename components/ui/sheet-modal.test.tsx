import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SheetModal } from "./sheet-modal";

describe("SheetModal", () => {
  it("renders title, description, and children when open", () => {
    render(
      <SheetModal
        open
        onClose={vi.fn()}
        title="Add people"
        description="Beverages"
      >
        Modal body
      </SheetModal>
    );

    expect(screen.getByText("Add people")).toBeInTheDocument();
    expect(screen.getByText("Beverages")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();
  });

  it("calls onClose from the close button", async () => {
    const onClose = vi.fn();
    render(
      <SheetModal open onClose={onClose} title="Modal">
        Body
      </SheetModal>
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <SheetModal open={false} onClose={vi.fn()} title="Hidden">
        Body
      </SheetModal>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
