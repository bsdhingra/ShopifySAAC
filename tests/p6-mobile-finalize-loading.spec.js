const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FRONT_BACK_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_BACK_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back?_pos=3&_psq=front+and+ba&_ss=e&_v=1.0";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");

test.describe.configure({ timeout: 180_000 });

async function clearCart(page, baseURL) {
  await page.goto(`${baseURL}/cart/clear`, { waitUntil: "domcontentloaded" });
}

async function uploadFile(page, selector, filePath) {
  const input = page.locator(selector);
  await input.setInputFiles(filePath);
  await expect.poll(async () => input.evaluate((node) => node.files.length), { timeout: 15_000 }).toBeGreaterThan(0);
}

async function applyCrop(page) {
  const cropButton = page.locator('[data-bd-inline-crop="1"]');
  await expect(cropButton).toBeVisible({ timeout: 15_000 });
  await cropButton.click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /apply crop/i }).click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeHidden({ timeout: 15_000 });
}

test.describe("P6 mobile finalize waiting UI revert", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("mobile finalize avoids loading copy and recovers to proof-ready", async ({ page }, testInfo) => {
    test.skip(test.info().project.name !== "mobile-chromium", "mobile-only browser validation");

    await page.addInitScript(() => {
      window.__BD_DEBUG_FINALIZE_RECOVERY = true;
    });

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');
    const reviewStatus = page.locator('[data-bd-finalize-status="1"]');
    const reviewWrap = page.locator('[data-bd-proof-review-wrap="1"]');

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    await finalizeButton.click();

    await expect
      .poll(() =>
        page.evaluate(() => ({
          finalizeInProgress: !!window.__bdTshirtPreviewState?.isFinalizeInProgress?.(),
          designFinalized: !!window.__bdTshirtPreviewState?.isDesignFinalized?.()
        })),
      { timeout: 15_000 })
      .toMatchObject({ finalizeInProgress: true, designFinalized: false });

    await expect(page.locator('[data-bd-generating-overlay="1"]')).toHaveCount(0);
    await expect(reviewWrap).toBeHidden();
    await expect(reviewStatus).toContainText(/finalize/i, { timeout: 15_000 });

    const writeRecoveryLog = async () => {
      const recoveryLog = await page.evaluate(() => window.__bdDumpFinalizeRecoveryDebug?.() || []);
      const outPath = testInfo.outputPath("finalize-recovery-log.json");
      fs.writeFileSync(outPath, JSON.stringify(recoveryLog, null, 2));
      await testInfo.attach("finalize-recovery-log", {
        path: outPath,
        contentType: "application/json"
      });
    };

    try {
      await expect
        .poll(() =>
          page.evaluate(() => ({
            finalizeInProgress: !!window.__bdTshirtPreviewState?.isFinalizeInProgress?.(),
            designFinalized: !!window.__bdTshirtPreviewState?.isDesignFinalized?.(),
            canApproveAddToCart: !!window.__bdTshirtPreviewState?.canApproveAddToCart?.(),
            frontProofValid: !!window.__bdTshirtPreviewState?.isProofValidForSide?.("front")
          })),
        { timeout: 120_000 })
        .toMatchObject({
          finalizeInProgress: false,
          designFinalized: true,
          canApproveAddToCart: true,
          frontProofValid: true
        });
    } catch (error) {
      await writeRecoveryLog();
      throw error;
    }

    await writeRecoveryLog();

    await expect(reviewWrap).toBeVisible({ timeout: 15_000 });
  });
});
