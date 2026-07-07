import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("renders its content", () => {
    render(<Card>Inventory card</Card>);

    expect(screen.getByText("Inventory card")).toBeInTheDocument();
  });
});
