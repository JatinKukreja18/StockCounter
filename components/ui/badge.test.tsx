import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders status text", () => {
    render(<Badge tone="green">Open</Badge>);

    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});
