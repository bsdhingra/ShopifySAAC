const { test, expect } = require("@playwright/test");
const path = require("path");

const FRONT_ONLY_TSHIRT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_ONLY_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-only?_pos=3&_psq=Custom+T-shirt+front&_ss=e&_v=1.0";
const FRONT_BACK_TSHIRT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_BACK_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back?_pos=3&_psq=front+and+ba&_ss=e&_v=1.0";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");
const BACK_FILE = path.resolve(__dirname, "fixtures", "26.png");

test.describe.configure({ timeout: 300_000 });

async function clearCart(page, baseURL) {
  await page.request.get(`${baseURL}/cart/clear`);
  await page.goto(`${baseURL}/cart`, { waitUntil: "domcontentloaded" });
}

async function openDesigner(page, productPath) {
  await page.goto(productPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /start designing/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /start designing/i }).click();
  await expect(page.locator('[data-cf-uploader] [data-upload-input="1"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('[data-bd-inline-actions="1"]')).toBeVisible({ timeout: 30_000 });
}

async function getUploaderUrl(page, idx) {
  return page.evaluate((slot) => {
    const input = document.querySelector(`[data-cf-uploader] [data-url="${slot}"]`);
    return input instanceof HTMLInputElement ? String(input.value || "").trim() : "";
  }, String(idx));
}

async function uploadApparel(page, selector, filePath) {
  await page.locator(selector).setInputFiles(filePath);
  const slot = selector.includes('data-upload-input="2"') ? "2" : "1";
  await expect.poll(() => getUploaderUrl(page, slot), { timeout: 60_000 }).toMatch(/^https?:\/\//i);
}

async function applyApparelCrop(page, slot = "1") {
  const previousUrl = await getUploaderUrl(page, slot);
  const cropButton = page.locator('[data-bd-inline-crop="1"]');
  await expect(cropButton).toBeVisible({ timeout: 20_000 });
  await cropButton.click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /apply crop/i }).click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => getUploaderUrl(page, slot), { timeout: 60_000 }).toMatch(/^https?:\/\//i);
  if (previousUrl) {
    await expect.poll(() => getUploaderUrl(page, slot), { timeout: 60_000 }).not.toBe(previousUrl);
  }
}

async function finalizeApparel(page) {
  const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');
  await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
  await finalizeButton.click();
  await expect
    .poll(() => getTshirtRestoreState(page), { timeout: 120_000 })
    .toMatchObject({
      designFinalized: true,
      canApproveAddToCart: true
    });
}

async function addToCartAndGoToCart(page) {
  const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
  await expect(addToCartButton).toBeEnabled({ timeout: 30_000 });
  const addResponse = page.waitForResponse(
    (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
    { timeout: 120_000 }
  );
  await addToCartButton.click();
  await addResponse.catch(() => null);
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/i, { timeout: 60_000 });
}

async function getTshirtRestoreState(page) {
  return page.evaluate(() => {
    const state = window.__bdTshirtPreviewState;
    const designPreview = document.querySelector(".cf-preview-design");
    const container = document.getElementById("cf-tshirt-preview-container");
    const frontUrlInput = document.querySelector('[data-cf-uploader] [data-url="1"]');
    const backUrlInput = document.querySelector('[data-cf-uploader] [data-url="2"]');
    const frontPlacementInput = document.getElementById("bd_design_placement_front");
    const backPlacementInput = document.getElementById("bd_design_placement_back");
    const finalizeBtn = document.querySelector('[data-bd-finalize-btn="1"]');
    return {
      resolvedMode: String(container?.dataset?.bdResolvedMode || "").trim(),
      activeSide: state ? state.getActiveSide() : "",
      designFinalized: state ? state.isDesignFinalized() : false,
      canApproveAddToCart: state ? state.canApproveAddToCart() : false,
      frontProofValid: state ? state.isProofValidForSide("front") : false,
      backProofValid: state ? state.isProofValidForSide("back") : false,
      hasFrontDesign: state ? state.hasFrontDesign() : false,
      hasBackDesign: state ? state.hasBackDesign() : false,
      previewVisible: !!(designPreview && !designPreview.hidden && designPreview.naturalWidth > 0),
      frontUrl: String(frontUrlInput?.value || "").trim(),
      backUrl: String(backUrlInput?.value || "").trim(),
      frontPlacementRaw: String(frontPlacementInput?.value || "").trim(),
      backPlacementRaw: String(backPlacementInput?.value || "").trim(),
      finalizeVisible: !!(finalizeBtn && finalizeBtn.offsetParent),
      finalizeEnabled: !!(finalizeBtn && !finalizeBtn.disabled)
    };
  });
}

test.describe("T-shirt restore cycles", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("front-only T-shirt cart-back restore preserves design URL and placement after crop", async ({ page }) => {
    await openDesigner(page, FRONT_ONLY_TSHIRT_PATH);

    await uploadApparel(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyApparelCrop(page, "1");
    await finalizeApparel(page);

    const beforeCart = await getTshirtRestoreState(page);
    expect(beforeCart.resolvedMode).toBe("front-only");
    expect(beforeCart.activeSide).toBe("front");
    expect(beforeCart.hasFrontDesign).toBe(true);
    expect(beforeCart.hasBackDesign).toBe(false);
    expect(beforeCart.frontUrl).toMatch(/^https?:\/\//i);
    expect(beforeCart.frontPlacementRaw).not.toBe("");
    expect(beforeCart.previewVisible).toBe(true);

    await addToCartAndGoToCart(page);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/products\//i, { timeout: 60_000 });

    await expect
      .poll(() => getTshirtRestoreState(page), { timeout: 60_000 })
      .toMatchObject({
        resolvedMode: "front-only",
        activeSide: "front",
        hasFrontDesign: true,
        hasBackDesign: false,
        designFinalized: false,
        canApproveAddToCart: false,
        frontProofValid: false,
        frontUrl: beforeCart.frontUrl,
        frontPlacementRaw: beforeCart.frontPlacementRaw,
        previewVisible: true,
        finalizeVisible: true,
        finalizeEnabled: true
      });
  });

  test("front-back T-shirt cart-back restore preserves both side URLs, placements, and active side", async ({ page }) => {
    await openDesigner(page, FRONT_BACK_TSHIRT_PATH);

    await uploadApparel(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyApparelCrop(page, "1");

    await page.getByRole("tab", { name: /^back$/i }).click();
    await uploadApparel(page, '#cfUploadBack[data-upload-input="2"]', BACK_FILE);
    await applyApparelCrop(page, "2");
    await finalizeApparel(page);

    const beforeCart = await getTshirtRestoreState(page);
    expect(beforeCart.resolvedMode).toBe("front-back");
    expect(beforeCart.activeSide).toBe("back");
    expect(beforeCart.hasFrontDesign).toBe(true);
    expect(beforeCart.hasBackDesign).toBe(true);
    expect(beforeCart.frontUrl).toMatch(/^https?:\/\//i);
    expect(beforeCart.backUrl).toMatch(/^https?:\/\//i);
    expect(beforeCart.frontPlacementRaw).not.toBe("");
    expect(beforeCart.backPlacementRaw).not.toBe("");
    expect(beforeCart.previewVisible).toBe(true);

    await addToCartAndGoToCart(page);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/products\//i, { timeout: 60_000 });

    await expect
      .poll(() => getTshirtRestoreState(page), { timeout: 60_000 })
      .toMatchObject({
        resolvedMode: "front-back",
        activeSide: "back",
        hasFrontDesign: true,
        hasBackDesign: true,
        designFinalized: false,
        canApproveAddToCart: false,
        frontProofValid: false,
        backProofValid: false,
        frontUrl: beforeCart.frontUrl,
        backUrl: beforeCart.backUrl,
        frontPlacementRaw: beforeCart.frontPlacementRaw,
        backPlacementRaw: beforeCart.backPlacementRaw,
        previewVisible: true,
        finalizeVisible: true,
        finalizeEnabled: true
      });
  });
});
