import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssistantOverlay from "@/components/AssistantOverlay";

describe("AssistantOverlay", () => {
  it("starts closed, showing only the button", () => {
    render(<AssistantOverlay><div data-testid="chat" /></AssistantOverlay>);

    expect(screen.getByRole("button", { name: "Ask Deckhand" })).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });

  it("opens the assistant from the button and closes it again", () => {
    render(<AssistantOverlay><div data-testid="chat" /></AssistantOverlay>);

    fireEvent.click(screen.getByRole("button", { name: "Ask Deckhand" }));
    expect(screen.getByTestId("chat")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close Deckhand" }));
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });
});
