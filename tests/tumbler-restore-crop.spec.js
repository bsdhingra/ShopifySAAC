const { test, expect } = require("@playwright/test");
const path = require("path");

const TUMBLER_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TUMBLER_PATH ||
  "/products/custom-print-20-oz-insulated-tumbler-dual-lids?_pos=1&_psq=custom+tumbler+dual&_ss=e&_v=1.0";
const UPLOAD_FILE = path.resolve(__dirname, "fixtures", "26.png");

test.describe.configure({ timeout: 240_000 });

async function clearCart(page, baseURL) {
  await page.request.get(`${baseURL}/cart/clear`);
  await page.goto(`${baseURL}/cart`, { waitUntil: "domcontentloaded" });
}

async function getTumblerState(page) {
  return page.evaluate(() => {
    const root = document.getElementById("cf-tumbler-preview-container");
    const designWrap = root?.querySelector("[data-cf-tumbler-design-wrap]");
    const handle = root?.querySelector("[data-cf-tumbler-handle]");
    const cropBtn = root?.querySelector("[data-cf-tumbler-crop-btn]");
    const resetBtn = root?.querySelector("[data-cf-tumbler-reset-btn]");
    const loadOriginalBtn = root?.querySelector("[data-cf-tumbler-load-original-btn]");
    const designUrlInput = document.querySelector('[data-cf-uploader] [data-url="1"]');
    const wrapRect = designWrap ? designWrap.getBoundingClientRect() : null;
    const handleRect = handle ? handle.getBoundingClientRect() : null;
    const transform = designWrap instanceof HTMLElement ? designWrap.style.transform || "" : "";
    const match = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/i.exec(transform);
    return {
      designWrapVisible: !!(designWrap && designWrap.offsetParent),
      handleVisible: !!(handle && !handle.hidden && handle.offsetParent),
      cropVisible: !!(cropBtn && cropBtn.offsetParent),
      resetVisible: !!(resetBtn && resetBtn.offsetParent),
      loadOriginalVisible: !!(loadOriginalBtn && loadOriginalBtn.offsetParent),
      designUrl: String(designUrlInput?.value || "").trim(),
      wrapWidth: wrapRect ? Math.round(wrapRect.width) : 0,
      wrapHeight: wrapRect ? Math.round(wrapRect.height) : 0,
      handleX: handleRect ? Math.round(handleRect.x) : 0,
      handleY: handleRect ? Math.round(handleRect.y) : 0,
      translateX: match ? Number(match[1]) : 0,
      translateY: match ? Number(match[2]) : 0
    };
  });
}

async function dragByPointerEvents(page, downSelector, moveTargetSelector, dx, dy) {
  await page.evaluate(
    ({ downSelector: downSel, moveTargetSelector: moveSel, dx: moveX, dy: moveY }) => {
      const downTarget = document.querySelector(downSel);
      const moveTarget = document.querySelector(moveSel);
      if (!downTarget) throw new Error(`Missing drag target: ${downSel}`);
      if (!moveTarget) throw new Error(`Missing move target: ${moveSel}`);
      const rect = downTarget.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const pointerId = 1;
      const dispatch = (target, type, clientX, clientY) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            buttons: type === "pointerup" ? 0 : 1,
            clientX,
            clientY
          })
        );
      };
      dispatch(downTarget, "pointerdown", startX, startY);
      dispatch(moveTarget, "pointermove", startX + moveX, startY + moveY);
      dispatch(moveTarget, "pointerup", startX + moveX, startY + moveY);
    },
    { downSelector, moveTargetSelector, dx, dy }
  );
}

function expectPlacementClose(actual, expected, tolerance = 4) {
  expect(Math.abs(actual.wrapWidth - expected.wrapWidth)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.wrapHeight - expected.wrapHeight)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.translateX - expected.translateX)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.translateY - expected.translateY)).toBeLessThanOrEqual(tolerance);
}

async function waitForTumblerReady(page) {
  await expect
    .poll(() => getTumblerState(page), { timeout: 60_000 })
    .toMatchObject({
      designWrapVisible: true,
      cropVisible: true,
      resetVisible: true
    });
  await expect
    .poll(async () => (await getTumblerState(page)).designUrl, { timeout: 60_000 })
    .toMatch(/^https?:\/\//i);
}

async function openTumblerDesigner(page) {
  await page.goto(TUMBLER_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
  const root = page.locator("#cf-tumbler-preview-container");
  await expect(root).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /start designing/i }).click();
  await expect(root.locator("[data-cf-tumbler-stage]")).toBeVisible({ timeout: 30_000 });
}

async function uploadTumblerDesign(page) {
  await page.locator('[data-cf-uploader] [data-upload-input="1"]').setInputFiles(UPLOAD_FILE);
  await waitForTumblerReady(page);
}

async function openCrop(page) {
  await page.getByRole("button", { name: /^crop image$/i }).click();
  await expect(page.getByRole("button", { name: /apply crop/i })).toBeVisible({ timeout: 30_000 });
}

async function applyCrop(page) {
  const previousUrl = await page.evaluate(() => String(document.querySelector('[data-cf-uploader] [data-url="1"]')?.value || "").trim());
  await page.getByRole("button", { name: /apply crop/i }).click();
  await expect(page.getByRole("button", { name: /apply crop/i })).toBeHidden({ timeout: 60_000 });
  await expect
    .poll(async () => (await getTumblerState(page)).designUrl, { timeout: 60_000 })
    .not.toBe(previousUrl);
}

async function addTumblerToCart(page) {
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
}

test.describe("Tumbler restore crop", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("desktop/mobile tumbler restore keeps crop button after cart back", async ({ page }) => {
    await openTumblerDesigner(page);
    await uploadTumblerDesign(page);
    await addTumblerToCart(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/i, { timeout: 30_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() => getTumblerState(page), { timeout: 60_000 })
      .toMatchObject({
        designWrapVisible: true,
        cropVisible: true,
        resetVisible: true
      });
  });

  test("tumbler cart-back restore preserves moved and resized placement", async ({ page }) => {
    await openTumblerDesigner(page);
    await uploadTumblerDesign(page);

    await dragByPointerEvents(
      page,
      "#cf-tumbler-preview-container [data-cf-tumbler-handle]",
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      120,
      90
    );
    await dragByPointerEvents(
      page,
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      -48,
      36
    );

    const beforeCart = await getTumblerState(page);
    await addTumblerToCart(page);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });

    await expect
      .poll(() => getTumblerState(page), { timeout: 60_000 })
      .toMatchObject({
        designWrapVisible: true,
        handleVisible: true,
        cropVisible: true
      });

    const afterBack = await getTumblerState(page);
    expectPlacementClose(afterBack, beforeCart);
  });

  test("tumbler cart-back restore preserves cropped placement", async ({ page }) => {
    await openTumblerDesigner(page);
    await uploadTumblerDesign(page);
    await openCrop(page);
    await applyCrop(page);

    await dragByPointerEvents(
      page,
      "#cf-tumbler-preview-container [data-cf-tumbler-handle]",
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      88,
      64
    );
    await dragByPointerEvents(
      page,
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      "#cf-tumbler-preview-container [data-cf-tumbler-design-wrap]",
      42,
      -28
    );

    const beforeCart = await getTumblerState(page);
    await addTumblerToCart(page);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });

    await expect
      .poll(() => getTumblerState(page), { timeout: 60_000 })
      .toMatchObject({
        designWrapVisible: true,
        handleVisible: true,
        cropVisible: true
      });

    const afterBack = await getTumblerState(page);
    expectPlacementClose(afterBack, beforeCart);
  });
});
