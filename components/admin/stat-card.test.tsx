import { PackageSearch } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renders metric label, value, and detail", () => {
    render(
      <StatCard
        label="Open sessions"
        value="3"
        detail="Currently accepting syncs"
        icon={PackageSearch}
      />
    );

    expect(screen.getByText("Open sessions")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Currently accepting syncs")).toBeInTheDocument();
  });
});
