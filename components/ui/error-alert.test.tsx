import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorAlert } from "./error-alert";

describe("ErrorAlert", () => {
  it("renders an error message", () => {
    render(<ErrorAlert message="Could not save" />);

    expect(screen.getByText("Could not save")).toBeInTheDocument();
  });

  it("renders nothing without a message", () => {
    const { container } = render(<ErrorAlert message="" />);

    expect(container).toBeEmptyDOMElement();
  });
});
