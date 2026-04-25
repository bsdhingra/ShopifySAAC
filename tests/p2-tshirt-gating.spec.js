const { test, expect } = require("@playwright/test");
const path = require("path");

const FRONT_ONLY_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_ONLY_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-only?_pos=3&_psq=Custom+T-shirt+front&_ss=e&_v=1.0";
const FRONT_BACK_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_BACK_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back?_pos=3&_psq=front+and+ba&_ss=e&_v=1.0";
const GENERIC_UPLOAD_PRODUCT_PATH =
  process.env.PLAYWRIGHT_GENERIC_UPLOAD12_PATH ||
  "/products/custom-printed-canvas-totes";
const NON_CUSTOM_PRODUCT_PATH =
  process.env.PLAYWRIGHT_NON_CUSTOM_PATH ||
  "/products/best-dad-ever-t-shirt";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");
const BACK_FILE = path.resolve(__dirname, "fixtures", "26.png");

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

async function expectCartHasProduct(page, productNameRegex) {
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: productNameRegex }).first()).toBeVisible({ timeout: 30_000 });
}

async function getPreviewState(page) {
  return page.evaluate(() => {
    const state = window.__bdTshirtPreviewState;
    if (!state) return null;
    return {
      activeSide: state.getActiveSide(),
      canApproveAddToCart: state.canApproveAddToCart(),
      finalizeInProgress: state.isFinalizeInProgress(),
      designFinalized: state.isDesignFinalized(),
      cropPending: state.isCropPending(),
      approvedProofState: state.getApprovedProofState(),
      frontProofValid: state.isProofValidForSide("front"),
      backProofValid: state.isProofValidForSide("back")
    };
  });
}

async function getDesignPreviewSnapshot(page) {
  return page.evaluate(() => {
    const img = document.querySelector(".cf-preview-design");
    if (!(img instanceof HTMLImageElement)) return null;
    return {
      hidden: img.hidden,
      src: img.currentSrc || img.src || "",
      naturalWidth: img.naturalWidth || 0,
      naturalHeight: img.naturalHeight || 0
    };
  });
}

async function getCartUiState(page) {
  return page.evaluate(() => {
    const notification = document.getElementById("cart-notification");
    const drawer = document.querySelector("cart-drawer");
    return {
      notificationActive: !!(notification && notification.classList.contains("active")),
      drawerActive: !!(drawer && drawer.classList.contains("active")),
      bodyLocked: document.body.classList.contains("overflow-hidden")
    };
  });
}

async function getUploaderDesignUrl(page, idx) {
  return page.evaluate((slot) => {
    const input = document.querySelector(`[data-cf-uploader] [data-url="${slot}"]`);
    return input instanceof HTMLInputElement ? String(input.value || "").trim() : "";
  }, String(idx));
}

test.describe("P2 T-shirt gating stabilization", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("front/back second finalize removes loading copy while finalize stays in progress", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    const reviewStatus = page.locator('[data-bd-finalize-status="1"]');
    const ctaStatus = page.locator(".bd-tshirt-status").first();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');
    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    await finalizeButton.click();

    await expect
      .poll(() => getPreviewState(page), { timeout: 120_000 })
      .toMatchObject({
        finalizeInProgress: false,
        frontProofValid: true
      });

    await page.getByRole("tab", { name: /^back$/i }).click();
    await uploadFile(page, '#cfUploadBack[data-upload-input="2"]', BACK_FILE);
    await applyCrop(page);

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    await finalizeButton.click();

    await expect
      .poll(() => getPreviewState(page), { timeout: 15_000 })
      .toMatchObject({
        activeSide: "back",
        finalizeInProgress: true
      });
    await expect(page.locator('[data-bd-generating-overlay="1"]')).toHaveCount(0);

    const reviewText = ((await reviewStatus.textContent()) || "").trim();
    const ctaText = ((await ctaStatus.textContent()) || "").trim();
    expect(reviewText).not.toContain("Generating preview...");
    expect(ctaText).not.toContain("Generating preview...");
  });

  test("front-only product still opens designer and keeps add-to-cart gated before finalize", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(FRONT_ONLY_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /start designing/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /start designing/i }).click();

    const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');

    await expect(addToCartButton).toBeDisabled();
    await expect(finalizeButton).toBeDisabled();
    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(() => getPreviewState(page), { timeout: 30_000 })
      .toMatchObject({
        activeSide: "front",
        cropPending: false,
        designFinalized: false,
        finalizeInProgress: false,
        frontProofValid: false
      });
    await expect(finalizeButton).toBeEnabled();
    await expect(addToCartButton).toBeDisabled();
  });

  test("front-only same-side re-upload after crop renders on first replacement cycle", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(FRONT_ONLY_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe("");

    const firstSnapshot = await getDesignPreviewSnapshot(page);
    expect(firstSnapshot && firstSnapshot.naturalWidth).toBeGreaterThan(0);
    expect(firstSnapshot && firstSnapshot.naturalHeight).toBeGreaterThan(0);
    expect(firstSnapshot && firstSnapshot.hidden).toBe(false);
    expect(firstSnapshot && firstSnapshot.src).toBeTruthy();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', BACK_FILE);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe(firstSnapshot.src);
  });

  test("front/back same-side re-upload after crop renders on first replacement cycle", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe("");

    const initialFrontSnapshot = await getDesignPreviewSnapshot(page);
    expect(initialFrontSnapshot && initialFrontSnapshot.hidden).toBe(false);
    expect(initialFrontSnapshot && initialFrontSnapshot.naturalWidth).toBeGreaterThan(0);
    expect(initialFrontSnapshot && initialFrontSnapshot.src).toBeTruthy();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', BACK_FILE);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe(initialFrontSnapshot.src);
  });

  test("front/back back-side same-side re-upload after crop renders on first replacement cycle", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();
    await page.getByRole("tab", { name: /^back$/i }).click();

    await uploadFile(page, '#cfUploadBack[data-upload-input="2"]', BACK_FILE);
    await applyCrop(page);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe("");

    const initialBackSnapshot = await getDesignPreviewSnapshot(page);
    expect(initialBackSnapshot && initialBackSnapshot.hidden).toBe(false);
    expect(initialBackSnapshot && initialBackSnapshot.naturalWidth).toBeGreaterThan(0);
    expect(initialBackSnapshot && initialBackSnapshot.src).toBeTruthy();

    await uploadFile(page, '#cfUploadBack[data-upload-input="2"]', FRONT_FILE);

    await expect
      .poll(async () => {
        const snapshot = await getDesignPreviewSnapshot(page);
        return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0 ? snapshot.src : "";
      }, { timeout: 30_000 })
      .not.toBe(initialBackSnapshot.src);
  });

  test("front-only cart back restores editable draft and clears proof approval", async ({ page }) => {
    test.skip(
      !["desktop-chromium", "mobile-chromium"].includes(test.info().project.name),
      "Chromium-only browser validation"
    );

    await page.goto(FRONT_ONLY_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(() => getUploaderDesignUrl(page, 1), { timeout: 30_000 })
      .toMatch(/^https?:\/\//i);

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    await finalizeButton.click();

    await expect
      .poll(() => getPreviewState(page), { timeout: 120_000 })
      .toMatchObject({
        activeSide: "front",
        finalizeInProgress: false,
        designFinalized: true,
        canApproveAddToCart: true,
        frontProofValid: true
      });

    await expect(addToCartButton).toBeEnabled({ timeout: 30_000 });
    const addResponse = page.waitForResponse(
      (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
      { timeout: 60_000 }
    );
    await addToCartButton.click();
    await addResponse.catch(() => null);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/i, { timeout: 60_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/products\//i, { timeout: 60_000 });

    await expect
      .poll(async () => {
        const state = await getPreviewState(page);
        const overlay = await getDesignPreviewSnapshot(page);
        return {
          state,
          overlay
        };
      }, { timeout: 60_000 })
      .toMatchObject({
        state: {
          activeSide: "front",
          finalizeInProgress: false,
          designFinalized: false,
          canApproveAddToCart: false,
          frontProofValid: false,
          approvedProofState: null
        },
        overlay: {
          hidden: false
        }
      });

    const restoredOverlay = await getDesignPreviewSnapshot(page);
    await expect.poll(() => getCartUiState(page), { timeout: 30_000 }).toMatchObject({
      notificationActive: false,
      drawerActive: false,
      bodyLocked: false
    });
    expect(restoredOverlay && restoredOverlay.src).toMatch(/^https?:\/\//i);
    expect(restoredOverlay && restoredOverlay.naturalWidth).toBeGreaterThan(0);
    await expect(addToCartButton).toBeDisabled();
    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
  });

  test("front/back cart back preserves restored active side without switching to front first", async ({ page }) => {
    test.skip(
      !["desktop-chromium", "mobile-chromium"].includes(test.info().project.name),
      "Chromium-only browser validation"
    );

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);
    await page.getByRole("tab", { name: /^back$/i }).click();
    await uploadFile(page, '#cfUploadBack[data-upload-input="2"]', BACK_FILE);
    await applyCrop(page);

    await expect
      .poll(() => getUploaderDesignUrl(page, 2), { timeout: 30_000 })
      .toMatch(/^https?:\/\//i);

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    await finalizeButton.click();

    await expect
      .poll(() => getPreviewState(page), { timeout: 120_000 })
      .toMatchObject({
        activeSide: "back",
        finalizeInProgress: false,
        designFinalized: true,
        canApproveAddToCart: true,
        frontProofValid: true,
        backProofValid: true
      });

    const addResponse = page.waitForResponse(
      (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
      { timeout: 60_000 }
    );
    await addToCartButton.click();
    await addResponse.catch(() => null);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/i, { timeout: 60_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/products\//i, { timeout: 60_000 });

    await expect
      .poll(async () => {
        const state = await getPreviewState(page);
        const overlay = await getDesignPreviewSnapshot(page);
        const cartUi = await getCartUiState(page);
        return {
          state,
          overlay,
          cartUi
        };
      }, { timeout: 60_000 })
      .toMatchObject({
        state: {
          activeSide: "back",
          finalizeInProgress: false,
          designFinalized: false,
          canApproveAddToCart: false,
          frontProofValid: false,
          backProofValid: false,
          approvedProofState: null
        },
        overlay: {
          hidden: false
        },
        cartUi: {
          notificationActive: false,
          drawerActive: false,
          bodyLocked: false
        }
      });
  });

  test("non-custom product add-to-cart remains unaffected", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    await page.goto(NON_CUSTOM_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
    await expect(addToCartButton).toBeEnabled({ timeout: 30_000 });

    const addResponse = page.waitForResponse(
      (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
      { timeout: 60_000 }
  );
  await addToCartButton.click();
  await addResponse.catch(() => null);

  await expectCartHasProduct(page, /best dad ever t-shirt/i);
});

test("generic upload regression product still adds to cart", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

  await page.goto(GENERIC_UPLOAD_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
  await uploadFile(page, '[data-cf-uploader] [data-upload-input="1"]', FRONT_FILE);

  const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
  await expect(addToCartButton).toBeEnabled({ timeout: 30_000 });

    const addResponse = page.waitForResponse(
      (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
      { timeout: 60_000 }
  );
  await addToCartButton.click();
  await addResponse.catch(() => null);

  await expectCartHasProduct(page, /custom printed canvas totes/i);
});
});
