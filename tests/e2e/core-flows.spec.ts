import { test, expect } from "@playwright/test";

test.describe("Hash-It Core E2E Flows", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Sign in via local credentials form
    await page.goto("/auth/signin");
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill("e2e-tester@example.com");
      await page.locator('input[name="name"]').fill("E2E Tester");
      await page.locator('button[type="submit"]:has-text("Continue as local account")').click();
    }
    // Wait for redirect to /today
    await page.waitForURL("**/today", { timeout: 30000 });
  });

  test("1. Login and Today dashboard loads correctly", async ({ page }) => {
    await expect(page).toHaveURL(/.*today/);
    await expect(page.locator("h1")).toContainText(/Today/i, { timeout: 15000 });
  });

  test("2. Settings page adjusts retention target and persists", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText(/Settings/i);

    // Adjust daily cap
    const capInput = page.locator('input[type="number"]').first();
    await capInput.fill("7");

    // Save
    await page.locator('button:has-text("Save settings")').click();
    await expect(page.locator("text=Settings saved successfully")).toBeVisible();

    // Reload page and check persistence
    await page.reload();
    await expect(capInput).toHaveValue("7");
  });

  test("3. Command bar opens with shortcut and logs a problem", async ({ page }) => {
    await page.goto("/problems");
    await expect(page).toHaveURL(/.*problems/);

    // Press Cmd+K or click Search trigger
    await page.keyboard.press("Meta+k");
    
    // Command bar input visible
    const commandInput = page.locator('input[placeholder*="Type problem number"]');
    await expect(commandInput).toBeVisible({ timeout: 10000 });

    // Type problem search
    await commandInput.fill("Two Sum");

    // Click first result
    const resultItem = page.locator('button:has-text("Two Sum")').first();
    await expect(resultItem).toBeVisible({ timeout: 10000 });
    await resultItem.click();

    // Fill minutes and submit
    const minutesInput = page.locator('input[placeholder="25"]');
    await expect(minutesInput).toBeVisible({ timeout: 10000 });
    await minutesInput.fill("15");

    const submitBtn = page.locator('button:has-text("Log Solve")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify problem appears in catalog
    await page.goto("/problems");
    await expect(page.locator("text=Two Sum").first()).toBeVisible({ timeout: 15000 });
  });

  test("4. CSV Import wizard dry-run and commit flow", async ({ page }) => {
    await page.goto("/import");
    await expect(page.locator("h1")).toContainText(/Import workflow/i);

    // Create a temporary CSV in memory to upload
    const csvContent = `Problem Name,Problem Link,Topic,Pattern,Idea,What I did wrong,Status,Revisit?,Source\nE2E Import Problem ${Date.now()},https://leetcode.com/problems/two-sum,Algorithms,Hash Table,Map lookup,,Solved (Unaided),Yes,LeetCode`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    // Run dry run
    const dryRunBtn = page.locator('button:has-text("Run dry-run verification")');
    await dryRunBtn.click();

    // Verify dry run summary appears
    await expect(page.locator("text=Total rows")).toBeVisible();
    await expect(page.locator('button:has-text("Commit 1 problems to database")')).toBeVisible();

    // Commit batch
    await page.locator('button:has-text("Commit 1 problems to database")').click();
    await expect(page.locator("text=Import committed successfully")).toBeVisible({ timeout: 15000 });
  });
});
