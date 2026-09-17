import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { TodayPageActions } from "@/components/today-page-actions";
import { UserMenu } from "@/components/user-menu";
import { ScheduleReviewToggle } from "@/components/schedule-review-toggle";

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "light", setTheme: vi.fn() })),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Mock server actions
vi.mock("@/app/actions/entry-actions", () => ({
  toggleScheduleReview: vi.fn(),
}));

describe("Logo", () => {
  it("renders correctly with accessibility label", () => {
    render(<Logo data-testid="logo" />);
    const logo = screen.getByTestId("logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("aria-label", "Hash-It logo");
  });
});

describe("ThemeToggle", () => {
  it("renders toggle button and calls setTheme on click", async () => {
    const { useTheme } = await import("next-themes");
    const setThemeMock = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "light", setTheme: setThemeMock, themes: [], systemTheme: "light" });

    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Toggle theme" });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});

describe("TodayPageActions", () => {
  it("dispatches open-command-bar event on click (default)", async () => {
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    render(<TodayPageActions />);
    
    const button = screen.getByRole("button", { name: /add problem/i });
    await userEvent.click(button);
    
    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("open-command-bar");
  });

  it("dispatches open-command-bar event on click (compact)", async () => {
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    render(<TodayPageActions compact />);
    
    const button = screen.getByRole("button", { name: /log a new problem/i });
    await userEvent.click(button);
    
    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("open-command-bar");
  });
});

describe("UserMenu", () => {
  const mockUser = {
    name: "Test User",
    email: "test@example.com",
    image: "https://example.com/avatar.png",
  };

  it("renders user avatar and toggles menu on click", async () => {
    render(<UserMenu user={mockUser} />);
    
    const toggleButton = screen.getByRole("button", { name: /test user/i });
    expect(toggleButton).toBeInTheDocument();
    
    // Menu should be closed initially
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    
    // Open menu
    await userEvent.click(toggleButton);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    
    // Close menu by clicking outside
    await userEvent.click(document.body);
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("calls signOut when sign out button is clicked", async () => {
    const { signOut } = await import("next-auth/react");
    render(<UserMenu user={mockUser} />);
    
    await userEvent.click(screen.getByRole("button", { name: /test user/i }));
    await userEvent.click(screen.getByText("Sign out"));
    
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/auth/signin" });
  });
});

describe("ScheduleReviewToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correct state and toggles on click", async () => {
    const { toggleScheduleReview } = await import("@/app/actions/entry-actions");
    vi.mocked(toggleScheduleReview).mockResolvedValue({ success: true, scheduled: true });

    render(<ScheduleReviewToggle entryId="123" initialScheduled={false} />);
    
    const button = screen.getByRole("button", { name: /schedule reviews/i });
    expect(button).toBeInTheDocument();
    
    await userEvent.click(button);
    
    expect(toggleScheduleReview).toHaveBeenCalledWith("123", true);
    
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /scheduled for review/i })).toBeInTheDocument();
    });
  });

  it("reverts state on failure", async () => {
    const { toggleScheduleReview } = await import("@/app/actions/entry-actions");
    vi.mocked(toggleScheduleReview).mockRejectedValue(new Error("Failed"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ScheduleReviewToggle entryId="123" initialScheduled={false} />);
    
    const button = screen.getByRole("button", { name: /schedule reviews/i });
    await userEvent.click(button);
    
    // Wait for the transition and failure to revert
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /schedule reviews/i })).toBeInTheDocument();
    });
    
    expect(alertSpy).toHaveBeenCalledWith("Failed to update review schedule.");
    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
