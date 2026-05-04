const { test, expect } = require("@playwright/test");
const path = require("path");

const CIRCLE_PRODUCT_PATH =
  process.env.PLAYWRIGHT_CIRCLE_PATH ||
  "/products/custom-made-wooden-door-sign?variant=47451864367269";
const UPLOAD_FILE = path.resolve(__dirname, "fixtures", "circle-test.svg");
const INVALID_PNG_FILE = path.resolve(__dirname, "fixtures", "26.png");

test.describe.configure({ timeout: 240_000 });

async function clearCart(page, baseURL) {
  await page.request.get(`${baseURL}/cart/clear`);
  await page.goto(`${baseURL}/cart`, { waitUntil: "domcontentloaded" });
}

async function openCircleDesigner(page) {
  await page.goto(CIRCLE_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
  const root = page.locator("#cf-circle-preview-container");
  await expect(root).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /start designing/i }).click();
  await expect(root.locator("[data-cf-circle-upload-btn]")).toBeVisible({ timeout: 30_000 });
  await expect(root.locator("[data-cf-circle-stage]")).toBeVisible({ timeout: 30_000 });
  await expect(root.locator("[data-cf-circle-preview-stage]")).toBeVisible({ timeout: 30_000 });
  return root;
}

async function getCircleState(page) {
  return page.evaluate(() => {
    const root = document.getElementById("cf-circle-preview-container");
    const designWrap = root?.querySelector("[data-cf-circle-design-wrap]");
    const previewWrap = root?.querySelector("[data-cf-circle-preview-design-wrap]");
    const resetBtn = root?.querySelector("[data-cf-circle-reset-btn]");
    const sliderRow = root?.querySelector("[data-cf-circle-frame-slider-row]");
    const slider = root?.querySelector("[data-cf-circle-frame-slider]");
    const designUrlInput = document.querySelector('[data-cf-uploader] [data-url="1"]');
    const proofInput = document.querySelector("#cf_circle_proof_mockup_url");
    const proofNoticeInput = document.querySelector("#cf_circle_proof_notice");
    const status = root?.querySelector("[data-cf-circle-status]");
    const helper = Array.from(root?.querySelectorAll(".cf-circle-status") || []).find((el) =>
      /accepted format/i.test(String(el.textContent || ""))
    );
    const hiddenUploaderStatus = document.querySelector('[data-cf-uploader] [data-status="1"]');
    const frame = root?.querySelector("[data-cf-circle-frame]");
    const handle = root?.querySelector("[data-cf-circle-handle]");
    return {
      designWrapVisible: !!(designWrap && designWrap.offsetParent),
      previewWrapVisible: !!(previewWrap && previewWrap.offsetParent),
      resetVisible: !!(resetBtn && resetBtn.offsetParent),
      sliderVisible: !!(sliderRow && sliderRow.offsetParent),
      sliderValue: slider ? String(slider.value || "") : "",
      designUrl: String(designUrlInput?.value || "").trim(),
      proofUrl: String(proofInput?.value || "").trim(),
      proofNotice: String(proofNoticeInput?.value || "").trim(),
      statusText: String(status?.textContent || "").trim(),
      helperText: String(helper?.textContent || "").trim(),
      hiddenUploaderStatusText: String(hiddenUploaderStatus?.textContent || "").trim(),
      frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
      handleVisible: !!(handle && !handle.hidden && handle.offsetParent)
    };
  });
}

async function uploadCircleDesign(page) {
  await page.locator('[data-cf-uploader] [data-upload-input="1"]').setInputFiles(UPLOAD_FILE);
  await expect
    .poll(() => getCircleState(page), { timeout: 60_000 })
    .toMatchObject({
      designWrapVisible: true,
      previewWrapVisible: true,
      resetVisible: true,
      sliderVisible: true,
      handleVisible: true
    });
  await expect
    .poll(async () => (await getCircleState(page)).designUrl, { timeout: 60_000 })
    .toMatch(/^https?:\/\//i);
}

async function adjustFrameSize(page) {
  const before = await getCircleState(page);
  await page.evaluate(() => {
    const button = document.querySelector("[data-cf-circle-frame-increase]");
    if (!(button instanceof HTMLElement)) {
      throw new Error("Missing circle frame increase button");
    }
    button.click();
  });
  await expect
    .poll(async () => Number((await getCircleState(page)).sliderValue || 0), { timeout: 30_000 })
    .toBeGreaterThan(Number(before.sliderValue || 0));
}

async function resizeCircleDesign(page) {
  const handle = page.locator("[data-cf-circle-handle]");
  await expect(handle).toBeVisible({ timeout: 30_000 });
  const handleBox = await handle.boundingBox();
  if (!handleBox) return;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 50, handleBox.y + handleBox.height / 2 + 50, {
    steps: 12
  });
  await page.mouse.up();
}

async function addCircleToCart(page) {
  const submit = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  const addResponse = page.waitForResponse(
    (response) => response.url().includes("/cart/add") && response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await submit.click();
  await addResponse.catch(() => null);
  const dialog = page.getByRole("dialog", { name: /item added to your cart/i });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect(dialog.getByRole("link", { name: /view cart/i })).toBeVisible({ timeout: 30_000 });
}

test.describe("Circle full cycle", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("desktop/mobile circle cycle covers upload, edit, add to cart, and browser-back restore", async ({ page }) => {
    await openCircleDesigner(page);
    await uploadCircleDesign(page);

    await adjustFrameSize(page);
    await resizeCircleDesign(page);
    const beforeCart = await getCircleState(page);
    expect(beforeCart.designUrl).toMatch(/^https?:\/\//i);
    expect(Number(beforeCart.sliderValue || 0)).toBeGreaterThan(0);
    expect(beforeCart.handleVisible).toBe(true);

    await addCircleToCart(page);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/i, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /custom made wooden door sign/i }).first()).toBeVisible({ timeout: 30_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() => getCircleState(page), { timeout: 60_000 })
      .toMatchObject({
        designWrapVisible: true,
        previewWrapVisible: true,
        resetVisible: true,
        sliderVisible: true,
        designUrl: beforeCart.designUrl,
        sliderValue: beforeCart.sliderValue,
        handleVisible: true
      });
    await expect(page.locator("#cf-circle-preview-container [data-cf-circle-stage]")).toBeVisible();
  });

  test("desktop/mobile SVG-only door-sign rejects PNG and does not leak preview state", async ({ page }) => {
    await openCircleDesigner(page);

    await expect
      .poll(() => getCircleState(page), { timeout: 30_000 })
      .toMatchObject({
        helperText: "Accepted format: SVG only.",
        designWrapVisible: false,
        previewWrapVisible: false,
        resetVisible: true,
        sliderVisible: true,
        designUrl: ""
      });

    await page.locator('[data-cf-uploader] [data-upload-input="1"]').setInputFiles(INVALID_PNG_FILE);

    await expect
      .poll(() => getCircleState(page), { timeout: 30_000 })
      .toMatchObject({
        designWrapVisible: false,
        previewWrapVisible: false,
        resetVisible: true,
        sliderVisible: true,
        designUrl: "",
        proofUrl: "",
        hiddenUploaderStatusText: "Please upload an SVG file."
      });

    await expect
      .poll(async () => (await getCircleState(page)).statusText, { timeout: 30_000 })
      .toMatch(/please upload an svg file\./i);
  });
});
