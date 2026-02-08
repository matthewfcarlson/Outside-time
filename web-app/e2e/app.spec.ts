import { test, expect, takeStepScreenshot } from "./fixtures";

test.describe("Home page", () => {
  test("loads and shows main UI elements", async ({ page }, testInfo) => {
    await page.goto("/");

    await takeStepScreenshot(page, testInfo, "01-initial-load");

    // Header
    await expect(page.locator("h1")).toHaveText("Outside Time");
    await expect(page.locator(".tagline")).toHaveText(
      "Track your outdoor time, privately."
    );

    // Timer section with "Go Outside" button
    await expect(page.locator("button.timer-btn.start")).toBeVisible();
    await expect(page.locator("button.timer-btn.start")).toHaveText(
      /Go Outside/
    );

    // Summary cards
    await expect(page.locator(".summary-card")).toHaveCount(2);

    // Session log
    await expect(page.locator("text=Session Log")).toBeVisible();
  });
});

test.describe("Timer", () => {
  test("start and stop a session", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-before-start");

    // Timer should show 0:00:00 initially
    await expect(page.locator(".timer-display")).toHaveText("0:00:00");

    // Click "Go Outside"
    await page.click("button.timer-btn.start");
    await takeStepScreenshot(page, testInfo, "02-timer-started");

    // Button should now say "Come Back In"
    await expect(page.locator("button.timer-btn.stop")).toBeVisible();
    await expect(page.locator("button.timer-btn.stop")).toHaveText(
      /Come Back In/
    );

    // Timer display should have the running class
    await expect(page.locator(".timer-display.running")).toBeVisible();

    // Wait a moment for the timer to tick
    await page.waitForTimeout(1500);
    await takeStepScreenshot(page, testInfo, "03-timer-running");

    // Stop the timer
    await page.click("button.timer-btn.stop");
    await takeStepScreenshot(page, testInfo, "04-timer-stopped");

    // Should be back to "Go Outside"
    await expect(page.locator("button.timer-btn.start")).toBeVisible();

    // A session should now appear in the log
    await expect(page.locator(".session-item")).toHaveCount(1);
    await takeStepScreenshot(page, testInfo, "05-session-created");
  });
});

test.describe("Goals", () => {
  test("add and delete a goal", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-goals-initial");

    // Should show empty state
    await expect(
      page.locator("text=No goals set. Add one to track your progress!")
    ).toBeVisible();

    // Open the add goal form
    await page.click("button.add-btn", {
      // There are multiple add-btn (Goals + SessionLog), pick the first one in Goals
    });
    // Goals section has the first "Add Goal" button — let's be more specific
    const goalsSection = page.locator(".goals");
    await goalsSection.locator("button.add-btn").click();
    await takeStepScreenshot(page, testInfo, "02-goal-form-open");

    // Fill in the form: 1 hour daily goal
    await goalsSection.locator("select").selectOption("day");
    const numberInputs = goalsSection.locator('input[type="number"]');
    await numberInputs.first().fill("1"); // hours
    await numberInputs.nth(1).fill("0"); // minutes

    await takeStepScreenshot(page, testInfo, "03-goal-form-filled");

    // Save
    await goalsSection.locator("button.save").click();
    await takeStepScreenshot(page, testInfo, "04-goal-saved");

    // Goal should appear in the list
    await expect(goalsSection.locator(".goal-item")).toHaveCount(1);
    await expect(goalsSection.locator(".goal-period")).toHaveText("Daily");
    await expect(goalsSection.locator(".goal-target")).toHaveText("1h 0m");

    // Delete the goal
    page.on("dialog", (dialog) => dialog.accept());
    await goalsSection.locator("button.delete").click();
    await takeStepScreenshot(page, testInfo, "05-goal-deleted");

    // Should be back to empty state
    await expect(
      page.locator("text=No goals set. Add one to track your progress!")
    ).toBeVisible();
  });
});

test.describe("Manual session entry", () => {
  test("add a manual session via the form", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-session-log-initial");

    // Open the manual entry form
    const sessionLog = page.locator(".session-log");
    await sessionLog.locator("button.add-btn").click();
    await takeStepScreenshot(page, testInfo, "02-manual-form-open");

    // Fill in start and end times (1 hour ago to now)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const inputs = sessionLog.locator('input[type="datetime-local"]');
    await inputs.first().fill(fmt(oneHourAgo));
    await inputs.nth(1).fill(fmt(now));
    await takeStepScreenshot(page, testInfo, "03-manual-form-filled");

    // Save
    await sessionLog.locator("button.save").click();
    await takeStepScreenshot(page, testInfo, "04-manual-session-saved");

    // Session should appear in the log
    await expect(sessionLog.locator(".session-item")).toHaveCount(1);
    // Duration should show approximately 1h
    await expect(sessionLog.locator(".session-duration")).toContainText("1h");
  });
});

test.describe("Settings", () => {
  test("open settings panel and view identity", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-before-settings");

    // Click Settings
    await page.click('button:has-text("Settings")');
    await takeStepScreenshot(page, testInfo, "02-settings-open");

    // Identity section should be visible
    await expect(page.locator(".identity-section")).toBeVisible();
    await expect(page.locator(".pubkey")).toBeVisible();

    // Sync status should be visible
    await expect(page.locator(".sync-dot")).toBeVisible();

    // Debug mode toggle should be visible
    await expect(page.locator("text=Debug mode")).toBeVisible();

    // Close settings
    await page.click('button:has-text("Close")');
    await takeStepScreenshot(page, testInfo, "03-settings-closed");

    // Settings panel should be hidden
    await expect(page.locator(".settings-panel")).not.toBeVisible();
  });
});

test.describe("About page", () => {
  test("navigate to and from the about page", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-home-page");

    // Click About
    await page.click('button:has-text("About")');
    await takeStepScreenshot(page, testInfo, "02-about-page");

    // Should show about content
    await expect(page.locator("text=What is this?")).toBeVisible();
    await expect(page.locator("text=Privacy first")).toBeVisible();
    await expect(page.locator("text=How it works")).toBeVisible();
    await expect(page.locator("text=Cross-device sync")).toBeVisible();

    // Go back
    await page.click("button.back-btn");
    await takeStepScreenshot(page, testInfo, "03-back-home");

    // Should be back on main page
    await expect(page.locator("button.timer-btn.start")).toBeVisible();
  });
});
