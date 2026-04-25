const { test, expect } = require("@playwright/test");
const path = require("path");

const FRONT_ONLY_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_ONLY_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-only?_pos=3&_psq=Custom+T-shirt+front&_ss=e&_v=1.0";
const FRONT_BACK_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_BACK_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back?_pos=3&_psq=front+and+ba&_ss=e&_v=1.0";
const TUMBLER_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TUMBLER_PATH ||
  "/products/custom-print-20-oz-insulated-tumbler-dual-lids?_pos=8&_psq=custom+tumbler+dua&_v=1.0";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");

test.describe.configure({ timeout: 180_000 });

function attachConsoleCapture(page) {
  const errors = [];

  page.on("pageerror", (error) => {
    errors.push(String(error));
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  return () =>
    errors.filter(
      (entry) =>
        !/Failed to load resource/i.test(entry) &&
        !/Framing 'https:\/\/shop\.app\/' violates the following Content Security Policy directive/i.test(entry)
    );
}

async function uploadFile(page, selector, filePath) {
  const input = page.locator(selector);
  await input.setInputFiles(filePath);
  await expect
    .poll(async () => input.evaluate((node) => node.files.length), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

async function applyCrop(page) {
  const cropButton = page.locator('[data-bd-inline-crop="1"]');
  await expect(cropButton).toBeVisible({ timeout: 15_000 });
  await cropButton.click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /apply crop/i }).click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeHidden({ timeout: 15_000 });
}

async function getGallerySnapshot(page) {
  return page.evaluate(() => {
    const gallery = document.querySelector("media-gallery");
    if (!gallery) return null;

    const activeSlide = gallery.querySelector('[data-media-id].is-active');
    const currentThumb = gallery.querySelector('#Slider-Thumbnails [aria-current="true"], [id^="Slider-Thumbnails-"] [aria-current="true"]');
    const previewSlide = gallery.querySelector('[data-bd-design-preview-slide="1"]');
    const counterCurrent = gallery.querySelector(".slider-counter--current");
    const counterTotal = gallery.querySelector(".slider-counter--total");

    return {
      activeMediaId: activeSlide ? activeSlide.getAttribute("data-media-id") : "",
      activeThumbTarget: currentThumb ? currentThumb.getAttribute("data-target") : "",
      visiblePreviewMediaId:
        previewSlide && !previewSlide.hidden ? previewSlide.getAttribute("data-media-id") || "" : "",
      counterCurrent: counterCurrent ? counterCurrent.textContent.trim() : "",
      counterTotal: counterTotal ? counterTotal.textContent.trim() : "",
      thumbnailTargets: Array.from(
        gallery.querySelectorAll('[id^="Slider-Thumbnails-"] [data-target], #Slider-Thumbnails [data-target]')
      ).map((node) => node.getAttribute("data-target")),
    };
  });
}

async function clickFirstNonActiveThumbnail(page) {
  const gallery = page.locator("media-gallery").first();
  const buttons = gallery.locator('[id^="Slider-Thumbnails-"] button.thumbnail, #Slider-Thumbnails button.thumbnail');
  const count = await buttons.count();

  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    const ariaCurrent = await button.getAttribute("aria-current");
    if (ariaCurrent !== "true") {
      await button.click();
      return button;
    }
  }

  return null;
}

test.describe("P4 gallery risk hardening", () => {
  test("front-only synthetic preview slide activates without thumbnail errors and real thumbnails still resync gallery", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    const getErrors = attachConsoleCapture(page);

    await page.goto(FRONT_ONLY_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot && snapshot.visiblePreviewMediaId ? snapshot.visiblePreviewMediaId : "";
      }, { timeout: 30_000 })
      .not.toBe("");

    const previewMediaId = (await getGallerySnapshot(page)).visiblePreviewMediaId;

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeMediaId : "";
      }, { timeout: 30_000 })
      .toBe(previewMediaId);

    const snapshotAfterPreview = await getGallerySnapshot(page);
    expect(snapshotAfterPreview.thumbnailTargets).not.toContain(previewMediaId);

    const clickedThumbnail = await clickFirstNonActiveThumbnail(page);
    expect(clickedThumbnail, "Expected at least one real media thumbnail").toBeTruthy();

    const targetMediaId = await clickedThumbnail.getAttribute("data-target");
    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeMediaId : "";
      }, { timeout: 15_000 })
      .toBe(targetMediaId);

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeThumbTarget : "";
      }, { timeout: 15_000 })
      .toBe(targetMediaId);

    const snapshotAfterThumbClick = await getGallerySnapshot(page);
    expect(Number(snapshotAfterThumbClick.counterCurrent)).toBeGreaterThanOrEqual(1);
    expect(Number(snapshotAfterThumbClick.counterTotal)).toBeGreaterThanOrEqual(1);
    expect(getErrors()).toEqual([]);
  });

  test("front/back variant interaction keeps an active gallery item after synthetic preview activation", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    const getErrors = attachConsoleCapture(page);

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /start designing/i }).click();

    await uploadFile(page, '#cfUploadFront[data-upload-input="1"]', FRONT_FILE);
    await applyCrop(page);

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot && snapshot.visiblePreviewMediaId ? snapshot.visiblePreviewMediaId : "";
      }, { timeout: 30_000 })
      .not.toBe("");

    const variantOptions = page.locator('variant-selects input[type="radio"]');
    const variantCount = await variantOptions.count();
    test.skip(variantCount < 2, "requires at least two variant radio options");

    let switched = false;
    for (let i = 0; i < variantCount; i += 1) {
      const option = variantOptions.nth(i);
      if (!(await option.isChecked())) {
        const optionId = await option.getAttribute("id");
        const label = optionId ? page.locator(`label[for="${optionId}"]`).first() : null;
        if (!label || !(await label.count())) continue;

        await label.click({ force: true });
        try {
          await expect(option).toBeChecked({ timeout: 5_000 });
          switched = true;
          break;
        } catch (error) {
          continue;
        }
      }
    }

    test.skip(!switched, "no alternate variant option available");

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeMediaId : "";
      }, { timeout: 15_000 })
      .not.toBe("");

    expect(getErrors()).toEqual([]);
  });

  test("tumbler product media gallery still loads and thumbnail clicks keep active media in sync", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only browser validation");

    const getErrors = attachConsoleCapture(page);

    await page.goto(TUMBLER_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.locator("media-gallery")).toBeVisible({ timeout: 30_000 });

    const clickedThumbnail = await clickFirstNonActiveThumbnail(page);
    expect(clickedThumbnail, "Expected a tumbler thumbnail to be clickable").toBeTruthy();

    const targetMediaId = await clickedThumbnail.getAttribute("data-target");

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeMediaId : "";
      }, { timeout: 15_000 })
      .toBe(targetMediaId);

    await expect
      .poll(async () => {
        const snapshot = await getGallerySnapshot(page);
        return snapshot ? snapshot.activeThumbTarget : "";
      }, { timeout: 15_000 })
      .toBe(targetMediaId);

    expect(getErrors()).toEqual([]);
  });
});
