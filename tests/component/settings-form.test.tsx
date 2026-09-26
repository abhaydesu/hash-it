import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";

// Mock actions
vi.mock("@/app/actions/settings-actions", () => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  optimizeFSRSParams: vi.fn(),
  getCustomFields: vi.fn().mockResolvedValue([]),
  saveCustomFields: vi.fn(),
}));

describe("SettingsPage", () => {
  const mockSettings = {
    dailyResolveCap: 5,
    desiredRetention: 0.85,
    timezone: "UTC",
    easyBaseline: 10,
    mediumBaseline: 20,
    hardBaseline: 30,
    fsrsParams: [0.1, 0.2, 0.3],
    attemptCount: 1200,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays user settings", async () => {
    const { getUserSettings } = await import("@/app/actions/settings-actions");
    vi.mocked(getUserSettings).mockResolvedValue(mockSettings as any);

    render(<SettingsPage />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      expect(screen.getByDisplayValue("0.85")).toBeInTheDocument();
      expect(screen.getByDisplayValue("UTC")).toBeInTheDocument();
      expect(screen.getByText("1200 / 1000 reviews")).toBeInTheDocument();
    });
  });

  it("saves modified settings", async () => {
    const { getUserSettings, updateUserSettings } = await import("@/app/actions/settings-actions");
    vi.mocked(getUserSettings).mockResolvedValue(mockSettings as any);
    vi.mocked(updateUserSettings).mockResolvedValue(undefined as any);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    });

    const capInput = screen.getByDisplayValue("5");
    fireEvent.change(capInput, { target: { value: "10" } });

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyResolveCap: 10,
        })
      );
      expect(screen.getByText("Settings saved successfully.")).toBeInTheDocument();
    });
  });

  it("triggers FSRS optimization when attemptCount >= 1000", async () => {
    const { getUserSettings, optimizeFSRSParams } = await import("@/app/actions/settings-actions");
    vi.mocked(getUserSettings).mockResolvedValue(mockSettings as any);
    vi.mocked(optimizeFSRSParams).mockResolvedValue({ fsrsParams: [0.4, 0.5, 0.6] } as any);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /optimize fsrs parameters/i })).not.toBeDisabled();
    });

    const optimizeButton = screen.getByRole("button", { name: /optimize fsrs parameters/i });
    fireEvent.click(optimizeButton);

    await waitFor(() => {
      expect(optimizeFSRSParams).toHaveBeenCalled();
      expect(screen.getByText(/fsrs weights optimized/i)).toBeInTheDocument();
    });
  });
});
