import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PwaRegister } from "./pwa-register";

describe("PwaRegister", () => {
  it("renders no visible UI", () => {
    const { container } = render(<PwaRegister />);

    expect(container).toBeEmptyDOMElement();
  });
});
