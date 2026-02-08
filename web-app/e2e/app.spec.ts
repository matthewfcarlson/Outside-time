import { test, expect, takeStepScreenshot } from "./fixtures";

test.describe("Home page", () => {
  test("loads and shows main UI elements", async ({ page }, testInfo) => {
    await page.goto("/");

    await takeStepScreenshot(page, testInfo, "01-initial-load",
      "Page loaded. Checking: h1 says 'Outside Time', tagline says 'Track your outdoor time, privately.', 'Go Outside' button visible, 2 summary cards, and 'Session Log' heading.");

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
    await takeStepScreenshot(page, testInfo, "01-before-start",
      "Timer page loaded. Checking: timer display shows '0:00:00'.");

    // Timer should show 0:00:00 initially
    await expect(page.locator(".timer-display")).toHaveText("0:00:00");

    // Click "Go Outside"
    await page.click("button.timer-btn.start");
    await takeStepScreenshot(page, testInfo, "02-timer-started",
      "Clicked 'Go Outside'. Checking: 'Come Back In' stop button visible, timer display has 'running' class.");

    // Button should now say "Come Back In"
    await expect(page.locator("button.timer-btn.stop")).toBeVisible();
    await expect(page.locator("button.timer-btn.stop")).toHaveText(
      /Come Back In/
    );

    // Timer display should have the running class
    await expect(page.locator(".timer-display.running")).toBeVisible();

    // Wait a moment for the timer to tick
    await page.waitForTimeout(1500);
    await takeStepScreenshot(page, testInfo, "03-timer-running",
      "Waited 1.5s for timer to tick. Timer should be incrementing.");

    // Stop the timer
    await page.click("button.timer-btn.stop");
    await takeStepScreenshot(page, testInfo, "04-timer-stopped",
      "Clicked 'Come Back In'. Checking: 'Go Outside' start button returns.");

    // Should be back to "Go Outside"
    await expect(page.locator("button.timer-btn.start")).toBeVisible();

    // A session should now appear in the log
    await expect(page.locator(".session-item")).toHaveCount(1);
    await takeStepScreenshot(page, testInfo, "05-session-created",
      "Timer stopped. Checking: exactly 1 session item appears in the session log.");
  });
});

test.describe("Goals", () => {
  test("add and delete a goal", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-goals-initial",
      "Goals section loaded. Checking: empty state message 'No goals set. Add one to track your progress!' is visible.");

    // Should show empty state
    await expect(
      page.locator("text=No goals set. Add one to track your progress!")
    ).toBeVisible();

    // Goals section has the "Add Goal" button
    const goalsSection = page.locator(".goals");
    await goalsSection.locator("button.add-btn").click();
    await takeStepScreenshot(page, testInfo, "02-goal-form-open",
      "Clicked 'Add Goal' button. Goal form should now be visible with period selector, hours, and minutes inputs.");

    // Fill in the form: 1 hour daily goal
    await goalsSection.locator("select").selectOption("day");
    const numberInputs = goalsSection.locator('input[type="number"]');
    await numberInputs.first().fill("1"); // hours
    await numberInputs.nth(1).fill("0"); // minutes

    await takeStepScreenshot(page, testInfo, "03-goal-form-filled",
      "Filled goal form: period='day', hours=1, minutes=0. About to click Save.");

    // Save
    await goalsSection.locator("button.save").click();
    await takeStepScreenshot(page, testInfo, "04-goal-saved",
      "Clicked Save. Checking: 1 goal item visible, period label says 'Daily', target says '1h 0m'.");

    // Goal should appear in the list
    await expect(goalsSection.locator(".goal-item")).toHaveCount(1);
    await expect(goalsSection.locator(".goal-period")).toHaveText("Daily");
    await expect(goalsSection.locator(".goal-target")).toHaveText("1h 0m");

    // Delete the goal
    page.on("dialog", (dialog) => dialog.accept());
    await goalsSection.locator("button.delete").click();
    await takeStepScreenshot(page, testInfo, "05-goal-deleted",
      "Clicked Delete and confirmed dialog. Checking: empty state message 'No goals set. Add one to track your progress!' returns.");

    // Should be back to empty state
    await expect(
      page.locator("text=No goals set. Add one to track your progress!")
    ).toBeVisible();
  });
});

test.describe("Manual session entry", () => {
  test("add a manual session via the form", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-session-log-initial",
      "Session log section loaded. About to open the manual entry form.");

    // Open the manual entry form
    const sessionLog = page.locator(".session-log");
    await sessionLog.locator("button.add-btn").click();
    await takeStepScreenshot(page, testInfo, "02-manual-form-open",
      "Clicked 'Add' button in session log. Manual entry form should be visible with datetime-local inputs.");

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
    await takeStepScreenshot(page, testInfo, "03-manual-form-filled",
      "Filled start time (1 hour ago) and end time (now). About to click Save.");

    // Save
    await sessionLog.locator("button.save").click();
    await takeStepScreenshot(page, testInfo, "04-manual-session-saved",
      "Clicked Save. Checking: 1 session item visible in session log, duration text contains '1h'.");

    // Session should appear in the log
    await expect(sessionLog.locator(".session-item")).toHaveCount(1);
    // Duration should show approximately 1h
    await expect(sessionLog.locator(".session-duration")).toContainText("1h");
  });
});

test.describe("Settings", () => {
  test("open settings and view identity", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-before-settings",
      "Home page loaded. About to click Settings button.");

    // Click Settings
    await page.click('button:has-text("Settings")');
    await takeStepScreenshot(page, testInfo, "02-settings-open",
      "Clicked Settings. Checking: .identity-section visible, 'Your Identity' heading, .pubkey in format [8hex]...[8hex], .sync-text visible, 'Sync Now' button, 'Debug mode' toggle.");

    // Identity section should be visible with public key
    await expect(page.locator(".identity-section")).toBeVisible();
    await expect(page.locator("text=Your Identity")).toBeVisible();
    await expect(page.locator(".pubkey")).toBeVisible();
    // Public key should be in short format (8 chars...8 chars)
    await expect(page.locator(".pubkey")).toHaveText(/^[a-f0-9]{8}\.\.\.[a-f0-9]{8}$/);

    // Sync status should show "Not synced" or similar (no backend)
    await expect(page.locator(".sync-text")).toBeVisible();
    await expect(page.locator("button.sync-btn")).toBeVisible();
    await expect(page.locator("button.sync-btn")).toHaveText("Sync Now");

    // Debug mode toggle
    await expect(page.locator("text=Debug mode")).toBeVisible();

    // Close settings
    await page.click('button:has-text("Close")');
    await takeStepScreenshot(page, testInfo, "03-settings-closed",
      "Clicked Close. Checking: .settings-panel is no longer visible.");
    await expect(page.locator(".settings-panel")).not.toBeVisible();
  });

  test("generate QR code for device sync", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.click('button:has-text("Settings")');
    await takeStepScreenshot(page, testInfo, "01-settings-panel",
      "Settings panel opened. About to click 'Generate QR Code for Device Sync'.");

    // Click "Generate QR Code for Device Sync"
    await page.click('button:has-text("Generate QR Code for Device Sync")');
    await takeStepScreenshot(page, testInfo, "02-security-warning",
      "Clicked 'Generate QR Code for Device Sync'. Checking: .warning-box visible, 'Security Warning' text, 'private key' mention, 'Never share it with anyone else.' text.");

    // Security warning should appear
    await expect(page.locator(".warning-box")).toBeVisible();
    await expect(page.locator("text=Security Warning")).toBeVisible();
    await expect(page.locator("text=private key")).toBeVisible();
    await expect(
      page.locator("text=Never share it with anyone else.")
    ).toBeVisible();

    // Confirm to see the QR code
    await page.click('button:has-text("I understand, show QR code")');
    await takeStepScreenshot(page, testInfo, "03-qr-code-visible",
      "Clicked 'I understand, show QR code'. Checking: img.qr-image visible, 'Scan on another device to sync your identity.' text, 'Copy URL to Clipboard' button, 'Hide QR Code' button.");

    // QR code image should be visible
    await expect(page.locator("img.qr-image")).toBeVisible();
    await expect(
      page.locator("text=Scan on another device to sync your identity.")
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Copy URL to Clipboard")')
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Hide QR Code")')
    ).toBeVisible();

    // Hide the QR code
    await page.click('button:has-text("Hide QR Code")');
    await takeStepScreenshot(page, testInfo, "04-qr-hidden",
      "Clicked 'Hide QR Code'. Checking: img.qr-image hidden, 'Generate QR Code for Device Sync' button visible again.");

    // QR should be gone, back to the generate button
    await expect(page.locator("img.qr-image")).not.toBeVisible();
    await expect(
      page.locator('button:has-text("Generate QR Code for Device Sync")')
    ).toBeVisible();
  });

  test("toggle debug mode", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.click('button:has-text("Settings")');

    // Debug checkbox should be unchecked
    const checkbox = page.locator('.debug-label input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
    await takeStepScreenshot(page, testInfo, "01-debug-off",
      "Settings open. Confirmed: debug checkbox is unchecked. About to enable it.");

    // Enable debug mode
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await takeStepScreenshot(page, testInfo, "02-debug-on",
      "Checked debug checkbox. Confirmed: checkbox is now checked. About to close and reopen settings to test persistence.");

    // Close and re-open settings — should persist
    await page.click('button:has-text("Close")');
    await page.click('button:has-text("Settings")');
    await expect(
      page.locator('.debug-label input[type="checkbox"]')
    ).toBeChecked();
    await takeStepScreenshot(page, testInfo, "03-debug-persisted",
      "Closed and reopened settings. Checking: debug checkbox is still checked (state persisted across panel close/open).");
  });
});

test.describe("About page", () => {
  test("navigate to about and verify content", async ({ page }, testInfo) => {
    await page.goto("/");
    await takeStepScreenshot(page, testInfo, "01-home-page",
      "Home page loaded. About to navigate to About page.");

    // Click About
    await page.click('button:has-text("About")');
    await takeStepScreenshot(page, testInfo, "02-about-page-top",
      "Clicked About. Checking: 'What is this?' card with description, 'Privacy first' card with encryption mention, 'How it works' card with 'Go Outside' and 'I'm Back Inside', 'Cross-device sync' card with QR code mention.");

    // Verify all about cards are present
    await expect(page.locator("text=What is this?")).toBeVisible();
    await expect(
      page.locator(
        "text=Outside Time helps you track how much time you spend outdoors."
      )
    ).toBeVisible();

    await expect(page.locator("text=Privacy first")).toBeVisible();
    await expect(
      page.locator("text=Your data is encrypted on your device")
    ).toBeVisible();

    await expect(page.locator("text=How it works")).toBeVisible();
    await expect(page.locator("text=Go Outside")).toBeVisible();
    await expect(page.locator("text=I'm Back Inside")).toBeVisible();

    await expect(page.locator("text=Cross-device sync")).toBeVisible();
    await expect(
      page.locator("text=scan the QR code on another device")
    ).toBeVisible();

    await takeStepScreenshot(page, testInfo, "03-about-all-cards",
      "All about page cards verified. About to click Back.");

    // Back button returns to main page
    await page.click("button.back-btn");
    await takeStepScreenshot(page, testInfo, "04-back-to-home",
      "Clicked Back. Checking: timer 'Go Outside' button visible, .about-content hidden.");

    // Verify we're back — timer button visible, about cards gone
    await expect(page.locator("button.timer-btn.start")).toBeVisible();
    await expect(page.locator(".about-content")).not.toBeVisible();
  });

  test("about page hides main app controls", async ({ page }, testInfo) => {
    await page.goto("/");

    // Main controls should be visible
    await expect(page.locator("button.timer-btn.start")).toBeVisible();
    await expect(page.locator(".summary")).toBeVisible();

    // Navigate to About
    await page.click('button:has-text("About")');
    await takeStepScreenshot(page, testInfo, "01-about-no-controls",
      "Navigated to About page. Checking: timer button hidden, .summary hidden, .session-log hidden, .goals hidden, back button visible with 'Back' text.");

    // Main controls should be hidden
    await expect(page.locator("button.timer-btn")).not.toBeVisible();
    await expect(page.locator(".summary")).not.toBeVisible();
    await expect(page.locator(".session-log")).not.toBeVisible();
    await expect(page.locator(".goals")).not.toBeVisible();

    // About back button should be visible
    await expect(page.locator("button.back-btn")).toBeVisible();
    await expect(page.locator("button.back-btn")).toHaveText(/Back/);
  });
});
