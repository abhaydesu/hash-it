import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/app-shell";
import { Navbar, SidebarNav } from "@/components/navbar";
import { MonthlyMockProvider } from "@/components/monthly-mock-provider";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "light", setTheme: vi.fn() })),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("AppShell", () => {
  it("renders children and layout components", () => {
    const mockUser = { name: "Test User", email: "test@example.com" };
    render(
      <AppShell user={mockUser}>
        <div data-testid="child-content">Main Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Built by")).toBeInTheDocument();
    // Look for link to root which is the logo link
    const homeLinks = screen.getAllByRole("link");
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it("applies wide container styling on /problems route", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/problems");

    const { container } = render(
      <AppShell user={null}>
        <div>Content</div>
      </AppShell>
    );

    // Look for max-w-[1360px] which indicates wide mode
    const mainWrapper = container.querySelector(".max-w-\\[1360px\\]");
    expect(mainWrapper).toBeInTheDocument();
    expect(screen.queryByText("Built by")).not.toBeInTheDocument();
  });
});

describe("SidebarNav", () => {
  it("renders nothing on marketing page", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/");

    const { container } = render(<SidebarNav />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nav links on dashboard pages", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/today");

    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Problems" })).toBeInTheDocument();
  });

  it("highlights active link", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/problems");

    render(<SidebarNav />);
    const activeLink = screen.getByRole("link", { name: "Problems" });
    // Check if it has the active styling
    expect(activeLink.className).toContain("text-orange-700");
  });
});

describe("Navbar", () => {
  it("renders logo and sign in on marketing page when logged out", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/");

    render(
      <MonthlyMockProvider>
        <Navbar user={null} />
      </MonthlyMockProvider>
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders user menu and log problem button on dashboard", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/today");
    
    const mockUser = { name: "Test User", email: "test@example.com" };
    render(
      <MonthlyMockProvider>
        <Navbar user={mockUser} />
      </MonthlyMockProvider>
    );
    
    expect(screen.getByRole("button", { name: /test user/i })).toBeInTheDocument(); // User menu toggle
    expect(screen.getAllByRole("button", { name: /log problem/i }).length).toBeGreaterThan(0);
  });

  it("dispatches open-command-bar when Log problem is clicked", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/today");
    
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    render(
      <MonthlyMockProvider>
        <Navbar user={null} />
      </MonthlyMockProvider>
    );
    
    const buttons = screen.getAllByRole("button", { name: /log problem/i });
    await userEvent.click(buttons[0]);
    
    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("open-command-bar");
  });
});
