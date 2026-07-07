import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { testEntry, testProduct } from "@/components/test-data";
import { ExportButton } from "./export-button";

const writeFile = vi.fn();
const bookAppendSheet = vi.fn();
const jsonToSheet = vi.fn(() => ({ sheet: true }));
const bookNew = vi.fn(() => ({ book: true }));

vi.mock("xlsx", () => ({
  default: {},
  utils: {
    json_to_sheet: jsonToSheet,
    book_new: bookNew,
    book_append_sheet: bookAppendSheet
  },
  writeFile
}));

describe("ExportButton", () => {
  it("exports counted product rows", async () => {
    render(
      <ExportButton
        sessionId="s1"
        products={[testProduct]}
        entries={[testEntry]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Export XLSX" }));

    await waitFor(() =>
      expect(jsonToSheet).toHaveBeenCalledWith([
        expect.objectContaining({
          Product: "Pocari Sweat 500ml",
          "Count Qty": 45
        })
      ])
    );
    expect(bookAppendSheet).toHaveBeenCalledWith(
      { book: true },
      { sheet: true },
      "Adjustments"
    );
    expect(writeFile).toHaveBeenCalled();
  });
});
