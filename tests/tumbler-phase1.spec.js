const { test, expect } = require("@playwright/test");

const PRODUCT_PATH =
  process.env.PLAYWRIGHT_TUMBLER_PATH ||
  "/products/custom-print-20-oz-insulated-tumbler-dual-lids?_pos=1&_psq=custom+tumbler+dual&_ss=e&_v=1.0";
const UPLOAD_FILE = process.env.PLAYWRIGHT_TUMBLER_FILE || "tests/fixtures/sample-upload.svg";

async function resizeTumblerDesign(page, tumblerContainer) {
  const editWrap = tumblerContainer.locator("[data-cf-tumbler-design-wrap]");
  const handle = tumblerContainer.locator('[data-cf-tumbler-handle="se"]');

  await expect(editWrap).toBeVisible();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  if (!handleBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 70, handleBox.y + handleBox.height / 2 + 35, {
    steps: 12
  });
  await page.mouse.up();
}

test.describe("Tumbler Phase 1 shell", () => {
  test("tumbler designer shell opens and exposes upload action", async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toBeVisible();
    const tumblerContainer = page.locator("#cf-tumbler-preview-container");
    const startButton = tumblerContainer.locator("[data-cf-start-btn]");

    await expect(tumblerContainer).toBeVisible();
    await expect(startButton).toBeVisible();

    await startButton.click();

    await expect(tumblerContainer).toBeVisible();
    await expect(tumblerContainer.locator("[data-cf-tumbler-upload-btn]")).toBeVisible();
    await expect(tumblerContainer.locator(".cf-tumbler-base")).toBeVisible();
    await expect(page.getByText(/move and resize your design on the flat editor/i)).toBeVisible();
  });

  test("upload populates editable design stage and tumbler preview", async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: "domcontentloaded" });

    const tumblerContainer = page.locator("#cf-tumbler-preview-container");
    await tumblerContainer.locator("[data-cf-start-btn]").click();

    const realInput = page.locator('[data-cf-uploader] [data-upload-input="1"]');
    await realInput.setInputFiles(UPLOAD_FILE);

    const editWrap = tumblerContainer.locator("[data-cf-tumbler-design-wrap]");
    await expect(editWrap).toBeVisible();
    await expect(tumblerContainer.locator('[data-cf-preview-slot="center"]')).toBeVisible();
    await expect(tumblerContainer.locator("[data-cf-tumbler-status]")).not.toHaveText(/upload one design/i);
    await resizeTumblerDesign(page, tumblerContainer);

    await page.screenshot({
      path: "debug/tumbler-playwright-latest.png",
      fullPage: true
    });
  });

  test("upload captures a focused tumbler preview screenshot for review", async ({ page }) => {
    await page.goto(PRODUCT_PATH, { waitUntil: "domcontentloaded" });

    const tumblerContainer = page.locator("#cf-tumbler-preview-container");
    await tumblerContainer.locator("[data-cf-start-btn]").click();

    const realInput = page.locator('[data-cf-uploader] [data-upload-input="1"]');
    await realInput.setInputFiles(UPLOAD_FILE);

    await expect(tumblerContainer.locator("[data-cf-tumbler-design-wrap]")).toBeVisible();
    await expect(tumblerContainer.locator('[data-cf-preview-slot="center"]')).toBeVisible();
    await resizeTumblerDesign(page, tumblerContainer);

    await tumblerContainer.screenshot({
      path: "debug/tumbler-playwright-focused.png"
    });
  });
});
