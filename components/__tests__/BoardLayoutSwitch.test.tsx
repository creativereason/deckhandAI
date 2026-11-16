import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BoardLayoutSwitch from "@/components/BoardLayoutSwitch";

describe("BoardLayoutSwitch", () => {
  it("marks the current layout as pressed", () => {
    render(<BoardLayoutSwitch layout="pipeline" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Pipeline" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the layout the user picks", () => {
    const onChange = vi.fn();
    render(<BoardLayoutSwitch layout="list" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Pipeline" }));

    expect(onChange).toHaveBeenCalledWith("pipeline");
  });
});
