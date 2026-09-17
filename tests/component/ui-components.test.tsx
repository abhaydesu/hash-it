import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("bg-orange-500"); // primary variant
  });

  it("applies variant classes", () => {
    render(<Button variant="outcome-good">Good</Button>);
    const button = screen.getByRole("button", { name: "Good" });
    expect(button.className).toContain("outcome-fill-good");
  });
});

describe("Badge", () => {
  it("renders properly with default variant", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    const { container } = render(<Badge variant="easy">Easy</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-easy");
  });
});

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        title="Are you sure?"
        description="This is destructive."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });

  it("renders in portal when open and handles actions", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    
    render(
      <ConfirmDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        title="Are you sure?"
        description="This is destructive."
        onConfirm={onConfirm}
      />
    );
    
    // Should be in document
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("This is destructive.")).toBeInTheDocument();
    
    // Click cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await userEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    
    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    await userEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  
  it("closes on escape key", async () => {
    const onOpenChange = vi.fn();
    
    render(
      <ConfirmDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        title="Are you sure?"
        description="This is destructive."
        onConfirm={vi.fn()}
      />
    );
    
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
