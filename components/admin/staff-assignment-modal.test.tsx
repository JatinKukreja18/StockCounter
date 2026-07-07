import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { testStaff } from "@/components/test-data";
import { StaffAssignmentModal } from "./staff-assignment-modal";

describe("StaffAssignmentModal", () => {
  it("submits selected staff ids", async () => {
    const onSubmit = vi.fn();
    render(
      <StaffAssignmentModal
        open
        sessionName="Beverages"
        staff={testStaff}
        assignedIds={["u1"]}
        saving={false}
        error=""
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByText("Aiko")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Rohan/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Add selected people" })
    );

    expect(onSubmit).toHaveBeenCalledWith(["u2"]);
  });

  it("shows an already assigned message when nobody is available", () => {
    render(
      <StaffAssignmentModal
        open
        sessionName="Beverages"
        staff={testStaff.filter((person) => person.role === "staff")}
        assignedIds={["u1", "u2"]}
        saving={false}
        error=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText("Everyone is already assigned to this session.")
    ).toBeInTheDocument();
  });
});
