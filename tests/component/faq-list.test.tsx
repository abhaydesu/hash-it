import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqList } from "@/components/faq-list";

describe("FaqList", () => {
  const mockItems = [
    { q: "How does it work?", a: "It uses spaced repetition." },
    { q: "Is it free?", a: "Yes, completely free." },
  ];

  it("renders questions and answers in the document", () => {
    render(<FaqList items={mockItems} />);

    expect(screen.getByText("How does it work?")).toBeInTheDocument();
    expect(screen.getByText("Is it free?")).toBeInTheDocument();
    expect(screen.getByText("It uses spaced repetition.")).toBeInTheDocument();
    expect(screen.getByText("Yes, completely free.")).toBeInTheDocument();
  });

  it("starts collapsed with aria-expanded=false", () => {
    render(<FaqList items={mockItems} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
  });

  it("smoothly expands on click and toggles aria-expanded", async () => {
    render(<FaqList items={mockItems} />);

    const button = screen.getByRole("button", { name: /How does it work\?/i });
    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");

    const panelId = button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).toHaveClass("grid-rows-[1fr]");
    expect(panel).toHaveClass("opacity-100");

    // Click again to close
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveClass("grid-rows-[0fr]");
    expect(panel).toHaveClass("opacity-0");
  });
});
