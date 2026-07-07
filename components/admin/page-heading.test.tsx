import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeading } from "./page-heading";

describe("PageHeading", () => {
  it("renders heading copy and optional action", () => {
    render(
      <PageHeading
        eyebrow="Live count"
        title="Count overview"
        description="Review progress."
        action={<button type="button">Create</button>}
      />
    );

    expect(screen.getByText("Live count")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Count overview" })
    ).toBeInTheDocument();
    expect(screen.getByText("Review progress.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
