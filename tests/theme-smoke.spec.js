const { test, expect } = require("@playwright/test");

test.describe("Theme smoke", () => {
  test("product page loads without core editor errors", async ({ page }) => {
    const consoleErrors = [];

    page.on("pageerror", (error) => {
      consoleErrors.push(String(error));
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
    await page.waitForTimeout(1500);

    const relevantErrors = consoleErrors.filter(
      (entry) =>
        !/Failed to load resource/i.test(entry) &&
        !/Framing 'https:\/\/shop\.app\/' violates the following Content Security Policy directive/i.test(entry)
    );

    expect(
      relevantErrors,
      `Unexpected console/page errors:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
  });
});
