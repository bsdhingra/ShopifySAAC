const { test, expect } = require("@playwright/test");

const PRODUCT_PATH =
  process.env.PLAYWRIGHT_PRODUCT_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back";

test.describe("Front/back designer entry", () => {
  test("front/back product exposes the expected designer controls", async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("button", { name: /start designing/i })).toBeVisible();

    await page.getByRole("button", { name: /start designing/i }).click();

    await expect(page.locator("#cf-tshirt-preview-container")).toBeVisible();
    await expect(page.getByRole("tab", { name: /^front$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^back$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^upload front$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^upload back$/i })).toBeVisible();

    const frontButton = page.getByRole("button", { name: /^upload front$/i });
    const backButton = page.getByRole("button", { name: /^upload back$/i });

    await expect(frontButton).toBeEnabled();
    await expect(backButton).toBeDisabled();

    await page.getByRole("tab", { name: /^back$/i }).click();

    await expect(frontButton).toBeDisabled();
    await expect(backButton).toBeEnabled();
  });
});
