import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testProduct } from "@/components/test-data";
import { ImportStock } from "./import-stock";

vi.mock("xlsx", () => ({
  default: {},
  read: vi.fn(() => ({ Sheets: {}, SheetNames: [] }))
}));

vi.mock("@/lib/gofrugal-import", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gofrugal-import")>(
    "@/lib/gofrugal-import"
  );
  return {
    ...actual,
    parseStockWorkbook: vi.fn(() => ({
      format: "gofrugal-current-stock",
      products: [
        {
          ...testProduct,
          product: testProduct.name,
          location: "Aisle 1",
          batchCount: 1,
          batches: [
            {
              batchKey: "b1",
              batchNo: "",
              expiryDate: "2027-02-28",
              inwardTranno: "MR1042",
              transactionDate: null,
              currentStock: 48,
              purchasePrice: null,
              landingCost: null,
              distributor: ""
            }
          ]
        }
      ],
      warnings: [],
      metadata: {
        store: "Main Store",
        category: "Beverages",
        grandTotal: 48,
        batchRows: 1
      }
    }))
  };
});

describe("ImportStock", () => {
  it("previews parsed workbook data before confirming import", async () => {
    render(<ImportStock />);

    const input = document.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const file = {
      name: "stock.xlsx",
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    };
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("stock.xlsx")).toBeInTheDocument()
    );
    expect(screen.getByText("Pocari Sweat 500ml")).toBeInTheDocument();
    expect(screen.getByText("Main Store")).toBeInTheDocument();
  });
});
