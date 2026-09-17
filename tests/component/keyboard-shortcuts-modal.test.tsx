import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";

// Mock next/navigation
vi.mock("next/navigation", () => {
  const push = vi.fn();
  return {
    useRouter: vi.fn(() => ({ push })),
  };
});

describe("KeyboardShortcutsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render initially", () => {
    render(<KeyboardShortcutsModal />);
    expect(screen.queryByRole("heading", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens when '?' is pressed", () => {
    render(<KeyboardShortcutsModal />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("closes when 'Escape' is pressed", () => {
    render(<KeyboardShortcutsModal />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("does not open if input is focused", () => {
    render(
      <div>
        <input data-testid="input" />
        <KeyboardShortcutsModal />
      </div>
    );
    const input = screen.getByTestId("input");
    
    // simulate typing ? in input
    fireEvent.keyDown(input, { key: "?" });
    expect(screen.queryByRole("heading", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("navigates on 'g' then 't' sequence", async () => {
    const { useRouter } = await import("next/navigation");
    const pushMock = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as any);

    render(<KeyboardShortcutsModal />);
    
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "t" });

    expect(pushMock).toHaveBeenCalledWith("/today");
  });
});
