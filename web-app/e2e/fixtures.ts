import { test as base } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path where step descriptions are written for the CI PR-comment script.
 * Maps "TestKey/screenshot-name" → human-readable description.
 */
const STEP_DESCRIPTIONS_PATH = path.join(
  __dirname,
  "..",
  "test-results",
  "step-descriptions.json"
);

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
 * An optional `description` explains what was just done and what assertions
 * follow — this text is displayed in PR comments alongside the image.
 */
export async function takeStepScreenshot(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
  description?: string
) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png",
  });

  if (description) {
    let descriptions: Record<string, string> = {};
    try {
      descriptions = JSON.parse(
        fs.readFileSync(STEP_DESCRIPTIONS_PATH, "utf8")
      );
    } catch {
      // File doesn't exist yet
    }

    // Key matches the directory structure Playwright creates:
    // "Suite-Title-Test-Title/screenshot-name"
    const titleParts = testInfo.titlePath.slice(1);
    const testKey = titleParts.join("-").replace(/\s+/g, "-");
    const key = `${testKey}/${name}`;
    descriptions[key] = description;

    fs.mkdirSync(path.dirname(STEP_DESCRIPTIONS_PATH), { recursive: true });
    fs.writeFileSync(
      STEP_DESCRIPTIONS_PATH,
      JSON.stringify(descriptions, null, 2)
    );
  }
}

export { expect } from "@playwright/test";
