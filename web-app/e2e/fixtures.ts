import { test as base } from "@playwright/test";

/**
 * Extended test fixture that automatically captures a full-page screenshot
 * after every test. Screenshots are attached to the Playwright HTML report
 * and saved to test-results/ for CI artifact upload.
 */
export const test = base.extend<{ autoScreenshot: void }>({
  autoScreenshot: [
    async ({ page }, use, testInfo) => {
      await use();

      // Capture a full-page screenshot after each test completes
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`final-state`, {
        body: screenshot,
        contentType: "image/png",
      });
    },
    { auto: true },
  ],
});

/**
 * Helper: take a named screenshot mid-test and attach it to the report.
 */
export async function takeStepScreenshot(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string
) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png",
  });
}

export { expect } from "@playwright/test";
