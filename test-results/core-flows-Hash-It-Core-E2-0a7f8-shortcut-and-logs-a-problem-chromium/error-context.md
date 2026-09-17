# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-flows.spec.ts >> Hash-It Core E2E Flows >> 3. Command bar opens with shortcut and logs a problem
- Location: tests/e2e/core-flows.spec.ts:39:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=E2E Custom Problem 1789634500309')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=E2E Custom Problem 1789634500309') with timeout 15000ms
  - waiting for locator('text=E2E Custom Problem 1789634500309')

```

```yaml
- banner:
  - link:
    - /url: /
  - button "Log problem ⌘K":
    - img
    - text: Log problem ⌘K
  - button "Toggle theme":
    - img
    - img
    - text: Toggle theme
  - button "ET E2E Tester":
    - text: ET E2E Tester
    - img
- navigation:
  - link "Today":
    - /url: /today
  - link "Problems":
    - /url: /problems
  - link "Roadmap":
    - /url: /roadmap
  - link "Weekly review":
    - /url: /review/weekly
  - link "Monthly review":
    - /url: /review/monthly
  - link "Stats":
    - /url: /stats
  - link "Import":
    - /url: /import
  - link "Settings":
    - /url: /settings
- main:
  - heading "Problems" [level=1]
  - paragraph: Dense spreadsheet of logged problems. Click a core idea or mistake to read it; edit from the panel.
  - button "All (1)"
  - button "Due today"
  - button "Revisit flagged"
  - button "Stuck (≥3)"
  - button "Untagged"
  - button "Export CSV":
    - img
    - text: Export CSV
  - img
  - textbox "Search problems, ideas, mistakes…"
  - combobox:
    - option "All difficulties" [selected]
    - option "Easy"
    - option "Medium"
    - option "Hard"
  - combobox:
    - option "All statuses" [selected]
    - option "Unaided"
    - option "With help"
    - option "Failed"
  - combobox:
    - option "All patterns (26)" [selected]
    - option "Basics"
    - option "Two Pointer"
    - option "Fast and Slow Pointer"
    - option "Sliding Window"
    - option "Merge Intervals"
    - option "Prefix Sum"
    - option "Kadane's Pattern"
    - option "In-place Reversal of LinkedList"
    - option "Dummy Node"
    - option "Stack"
    - option "HashMap"
    - option "Heap"
    - option "Binary Search"
    - option "Backtracking"
    - option "BFS"
    - option "DFS"
    - option "Topological Sort"
    - option "Dynamic Programming"
    - option "Greedy"
    - option "Trie"
    - option "Union Find"
    - option "Bit Manipulation"
    - option "Matrix Traversal"
    - option "Monotonic Stack"
    - option "Intervals"
    - option "Hash Table"
  - table:
    - rowgroup:
      - row "# ↑ Problem Diff Status Pattern Time Core idea Mistake log Solved Next due":
        - columnheader "# ↑"
        - columnheader "Problem"
        - columnheader "Diff"
        - columnheader "Status"
        - columnheader "Pattern"
        - columnheader "Time"
        - columnheader "Core idea"
        - columnheader "Mistake log"
        - columnheader "Solved"
        - columnheader "Next due"
    - rowgroup:
      - row "#1 Two Sum rev Easy Unaided Hash Table - Core idea. Click to read or edit. Mistake. Click to read or edit. Sep 17 Sep 17 (!)":
        - cell "#1"
        - cell "Two Sum rev":
          - link "Two Sum":
            - /url: /problems/cmu59hc8x0006r3m5nryj110c
          - link "Open problem link":
            - /url: https://leetcode.com/problems/two-sum
            - img
          - text: rev
        - cell "Easy"
        - cell "Unaided":
          - img
          - text: Unaided
        - cell "Hash Table"
        - cell "-"
        - cell "Core idea. Click to read or edit.":
          - button "Core idea. Click to read or edit.": Map lookup
        - cell "Mistake. Click to read or edit.":
          - button "Mistake. Click to read or edit.": —
        - cell "Sep 17"
        - cell "Sep 17 (!)"
  - text: Showing 1 of 1 records
  - button "Prev" [disabled]:
    - img
    - text: Prev
  - text: Page 1 of 1
  - button "Next" [disabled]:
    - text: Next
    - img
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Hash-It Core E2E Flows", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // 1. Sign in via local credentials form
  6  |     await page.goto("/auth/signin");
  7  |     const emailInput = page.locator('input[name="email"]');
  8  |     if (await emailInput.isVisible()) {
  9  |       await emailInput.fill("e2e-tester@example.com");
  10 |       await page.locator('input[name="name"]').fill("E2E Tester");
  11 |       await page.locator('button[type="submit"]:has-text("Continue as local account")').click();
  12 |     }
  13 |     // Wait for redirect to /today
  14 |     await page.waitForURL("**/today", { timeout: 30000 });
  15 |   });
  16 | 
  17 |   test("1. Login and Today dashboard loads correctly", async ({ page }) => {
  18 |     await expect(page).toHaveURL(/.*today/);
  19 |     await expect(page.locator("h1")).toContainText(/Today/i, { timeout: 15000 });
  20 |   });
  21 | 
  22 |   test("2. Settings page adjusts retention target and persists", async ({ page }) => {
  23 |     await page.goto("/settings");
  24 |     await expect(page.locator("h1")).toContainText(/Settings/i);
  25 | 
  26 |     // Adjust daily cap
  27 |     const capInput = page.locator('input[type="number"]').first();
  28 |     await capInput.fill("7");
  29 | 
  30 |     // Save
  31 |     await page.locator('button:has-text("Save settings")').click();
  32 |     await expect(page.locator("text=Settings saved successfully")).toBeVisible();
  33 | 
  34 |     // Reload page and check persistence
  35 |     await page.reload();
  36 |     await expect(capInput).toHaveValue("7");
  37 |   });
  38 | 
  39 |   test("3. Command bar opens with shortcut and logs a problem", async ({ page }) => {
  40 |     await page.goto("/problems");
  41 |     await expect(page).toHaveURL(/.*problems/);
  42 | 
  43 |     // Press Cmd+K or click Search trigger
  44 |     await page.keyboard.press("Meta+k");
  45 |     
  46 |     // Command bar input visible
  47 |     const commandInput = page.locator('input[placeholder*="Type problem number"]');
  48 |     await expect(commandInput).toBeVisible({ timeout: 10000 });
  49 | 
  50 |     // Type manual problem title
  51 |     const uniqueTitle = `E2E Custom Problem ${Date.now()}`;
  52 |     await commandInput.fill(uniqueTitle);
  53 | 
  54 |     // Fill minutes and submit
  55 |     const minutesInput = page.locator('input[placeholder="25"]');
  56 |     await expect(minutesInput).toBeVisible({ timeout: 10000 });
  57 |     await minutesInput.fill("15");
  58 | 
  59 |     const submitBtn = page.locator('button:has-text("Log Solve")');
  60 |     await expect(submitBtn).toBeVisible();
  61 |     await submitBtn.click();
  62 | 
  63 |     // Verify problem appears in catalog
  64 |     await page.goto("/problems");
> 65 |     await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 15000 });
     |                                                       ^ Error: expect(locator).toBeVisible() failed
  66 |   });
  67 | 
  68 |   test("4. CSV Import wizard dry-run and commit flow", async ({ page }) => {
  69 |     await page.goto("/import");
  70 |     await expect(page.locator("h1")).toContainText(/Import workflow/i);
  71 | 
  72 |     // Create a temporary CSV in memory to upload
  73 |     const csvContent = `Problem Name,Problem Link,Topic,Pattern,Idea,What I did wrong,Status,Revisit?,Source\nE2E Import Problem ${Date.now()},https://leetcode.com/problems/two-sum,Algorithms,Hash Table,Map lookup,,Solved (Unaided),Yes,LeetCode`;
  74 |     
  75 |     const fileInput = page.locator('input[type="file"]');
  76 |     await fileInput.setInputFiles({
  77 |       name: "import.csv",
  78 |       mimeType: "text/csv",
  79 |       buffer: Buffer.from(csvContent),
  80 |     });
  81 | 
  82 |     // Run dry run
  83 |     const dryRunBtn = page.locator('button:has-text("Run dry-run verification")');
  84 |     await dryRunBtn.click();
  85 | 
  86 |     // Verify dry run summary appears
  87 |     await expect(page.locator("text=Total rows")).toBeVisible();
  88 |     await expect(page.locator('button:has-text("Commit 1 problems to database")')).toBeVisible();
  89 | 
  90 |     // Commit batch
  91 |     await page.locator('button:has-text("Commit 1 problems to database")').click();
  92 |     await expect(page.locator("text=Import committed successfully")).toBeVisible({ timeout: 15000 });
  93 |   });
  94 | });
  95 | 
```