import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "./barcode-scanner";

describe("BarcodeScanner", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <BarcodeScanner open={false} onClose={vi.fn()} onScan={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows scanner UI and closes from the close button", async () => {
    const onClose = vi.fn();
    render(<BarcodeScanner open onClose={onClose} onScan={vi.fn()} />);

    expect(screen.getByText("Scan barcode")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Close scanner" })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
