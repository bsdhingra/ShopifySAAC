const { test, expect } = require("@playwright/test");
const path = require("path");

const FRONT_BACK_PRODUCT_PATH =
  process.env.PLAYWRIGHT_PRODUCT_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back";
const TUMBLER_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TUMBLER_PATH ||
  "/products/custom-print-20-oz-insulated-tumbler-dual-lids?_pos=1&_psq=custom+tumbler+dual&_ss=e&_v=1.0";
const GENERIC_UPLOAD1_PRODUCT_PATH =
  process.env.PLAYWRIGHT_GENERIC_UPLOAD1_PATH ||
  "/products/custom-print-15-oz-ceramic-mug?_pos=1&_psq=Custom+mugs&_ss=e&_v=1.0";
const GENERIC_UPLOAD12_PRODUCT_PATH =
  process.env.PLAYWRIGHT_GENERIC_UPLOAD12_PATH ||
  "/products/custom-design-printed-hoodie-adults-and-kids-with-print-on-front-left-cheast-area-and-back";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");
const BACK_FILE = path.resolve(__dirname, "fixtures", "26.png");

const RAW_SLOT2_METADATA = [
  "Design 2 public_id",
  "Design 2 width",
  "Design 2 height",
  "Design 2 filename",
  "_Design 2 URL",
  "_Design 2 public_id",
  "_Design 2 width",
  "_Design 2 height",
  "_Design 2 filename"
];

test.describe.configure({ timeout: 180_000 });

async function clearCart(page, baseURL) {
  await page.goto(`${baseURL}/cart/clear`, { waitUntil: "domcontentloaded" });
  await page.goto(`${baseURL}/cart`, { waitUntil: "domcontentloaded" });
}

async function openFrontBackDesigner(page) {
  await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#cf-tshirt-preview-container")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /start designing/i }).click();
  await expect(page.getByRole("button", { name: /^upload front$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^upload back$/i })).toBeVisible();
}

async function uploadSide(page, side, filePath) {
  if (side === "back") {
    await page.getByRole("tab", { name: /^back$/i }).click();
  } else {
    await page.getByRole("tab", { name: /^front$/i }).click();
  }

  const input = page.locator(
    side === "back" ? '#cfUploadBack[data-upload-input="2"]' : '#cfUploadFront[data-upload-input="1"]'
  );
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

async function addToCart(page) {
  const addToCartButton = page.locator('product-form form[action*="/cart/add"] button[type="submit"]').first();
  await expect(addToCartButton).toBeEnabled({ timeout: 30_000 });
  const addResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/cart/add") &&
      response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await addToCartButton.click();
  await addResponse.catch(() => null);
}

async function expectCartNotificationVisible(page) {
  const dialog = page.getByRole("dialog", { name: /item added to your cart/i });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

async function expectNoRawSlot2MetadataVisible(page) {
  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  for (const label of RAW_SLOT2_METADATA) {
    expect(bodyText).not.toContain(label);
  }
}

function expectNoRawSlot2MetadataInText(text) {
  const normalizedText = String(text || "").replace(/\s+/g, " ");
  for (const label of RAW_SLOT2_METADATA) {
    expect(normalizedText).not.toContain(label);
  }
}

async function getCartDrawerSectionMarkup(page) {
  const response = await page.request.get("/cart?section_id=cart-drawer");
  expect(response.ok()).toBeTruthy();
  return response.text();
}

async function getPropertyValue(page, name) {
  return page.locator(`[name="${name}"]`).inputValue();
}

async function waitForPropertyValue(page, name) {
  await expect
    .poll(async () => getPropertyValue(page, name), { timeout: 60_000 })
    .not.toBe("");
  return getPropertyValue(page, name);
}

test.describe("Slot 2 compatibility", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("front/back uploader writes canonical slot 2 fields and cart page supports _Design 2 URL fallback", async ({
    page
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only regression flow");

    await openFrontBackDesigner(page);

    await uploadSide(page, "front", FRONT_FILE);
    await applyCrop(page);
    await uploadSide(page, "back", BACK_FILE);
    await applyCrop(page);

    const frontUrl = await waitForPropertyValue(page, "properties[Design 1 URL]");
    const backUrl = await waitForPropertyValue(page, "properties[Design 2 URL]");
    const canonicalBackUrl = await waitForPropertyValue(page, "properties[_Design 2 URL]");
    const canonicalBackPublicId = await waitForPropertyValue(page, "properties[_Design 2 public_id]");
    const legacyBackPublicId = await waitForPropertyValue(page, "properties[Design 2 public_id]");
    const canonicalBackWidth = await waitForPropertyValue(page, "properties[_Design 2 width]");
    const legacyBackWidth = await waitForPropertyValue(page, "properties[Design 2 width]");
    const canonicalBackHeight = await waitForPropertyValue(page, "properties[_Design 2 height]");
    const legacyBackHeight = await waitForPropertyValue(page, "properties[Design 2 height]");
    const canonicalBackFilename = await waitForPropertyValue(page, "properties[_Design 2 filename]");
    const legacyBackFilename = await waitForPropertyValue(page, "properties[Design 2 filename]");

    expect(frontUrl).toBeTruthy();
    expect(backUrl).toBeTruthy();
    expect(canonicalBackUrl).toBe(backUrl);
    expect(canonicalBackPublicId).toBeTruthy();
    expect(legacyBackPublicId).toBe(canonicalBackPublicId);
    expect(canonicalBackWidth).toBeTruthy();
    expect(legacyBackWidth).toBe(canonicalBackWidth);
    expect(canonicalBackHeight).toBeTruthy();
    expect(legacyBackHeight).toBe(canonicalBackHeight);
    expect(canonicalBackFilename).toBeTruthy();
    expect(legacyBackFilename).toBe(canonicalBackFilename);

    const variantId = await page.locator('product-form form[action*="/cart/add"] [name="id"]').inputValue();
    const addResponse = await page.request.post("/cart/add.js", {
      form: {
        id: variantId,
        quantity: "1",
        "properties[Design 1 URL]": frontUrl,
        "properties[_Design 2 URL]": canonicalBackUrl,
        "properties[Design 2 public_id]": "legacy-slot2-public-id",
        "properties[Design 2 width]": "1234",
        "properties[Design 2 height]": "2345",
        "properties[Design 2 filename]": "legacy-slot2-name.png"
      }
    });
    expect(addResponse.ok()).toBeTruthy();

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/cart(?:\?|$)/);
    await expect(page.getByText(/back uploaded image/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`a[href="${canonicalBackUrl}"]`).first()).toBeVisible({ timeout: 30_000 });
    await expectNoRawSlot2MetadataVisible(page);

    const drawerMarkup = await getCartDrawerSectionMarkup(page);
    expect(drawerMarkup).toContain("Back uploaded image");
    expect(drawerMarkup).toContain(`href="${canonicalBackUrl}"`);
    expectNoRawSlot2MetadataInText(drawerMarkup);
  });

  test("generic upload-1-only product still adds to cart and notification shows upload image without slot-2 leakage", async ({
    page
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only regression flow");

    await page.goto(GENERIC_UPLOAD1_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    const uploadInput = page.locator('[data-cf-uploader] [data-upload-input="1"]').first();
    await uploadInput.setInputFiles(FRONT_FILE);
    await expect.poll(async () => getPropertyValue(page, "properties[Design 1 URL]"), { timeout: 60_000 }).not.toBe("");

    await addToCart(page);
    const notification = await expectCartNotificationVisible(page);
    await expect(notification.getByText(/front uploaded image|uploaded design|uploaded image/i)).toBeVisible({
      timeout: 30_000
    });
    await expectNoRawSlot2MetadataVisible(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href*="res.cloudinary.com"]').first()).toBeVisible({ timeout: 30_000 });
    await expectNoRawSlot2MetadataVisible(page);
  });

  test("generic upload-1+2 product keeps second upload visible in notification and cart without raw metadata leakage", async ({
    page
  }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only regression flow");

    await page.goto(GENERIC_UPLOAD12_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    const upload1 = page.locator('[data-cf-uploader] [data-upload-input="1"]').first();
    const upload2 = page.locator('[data-cf-uploader] [data-upload-input="2"]').first();

    await upload1.setInputFiles(FRONT_FILE);
    await upload2.setInputFiles(BACK_FILE);

    const upload1Url = await waitForPropertyValue(page, "properties[Design 1 URL]");
    const upload2Url = await waitForPropertyValue(page, "properties[Design 2 URL]");
    const canonicalUpload2Url = await waitForPropertyValue(page, "properties[_Design 2 URL]");
    const canonicalBackPublicId = await waitForPropertyValue(page, "properties[_Design 2 public_id]");
    const legacyBackPublicId = await waitForPropertyValue(page, "properties[Design 2 public_id]");

    expect(upload1Url).toBeTruthy();
    expect(upload2Url).toBeTruthy();
    expect(canonicalUpload2Url).toBe(upload2Url);
    expect(legacyBackPublicId).toBe(canonicalBackPublicId);

    await addToCart(page);
    const notification = await expectCartNotificationVisible(page);
    await expect(notification.getByText(/back uploaded image/i)).toBeVisible({ timeout: 30_000 });
    await expectNoRawSlot2MetadataVisible(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="${upload2Url}"]`).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/back uploaded image/i)).toBeVisible({ timeout: 30_000 });
    await expectNoRawSlot2MetadataVisible(page);
  });

  test("tumbler add-to-cart remains unaffected by slot 2 compatibility changes", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "desktop-only smoke");

    await page.goto(TUMBLER_PRODUCT_PATH, { waitUntil: "domcontentloaded" });

    const tumblerContainer = page.locator("#cf-tumbler-preview-container");
    await expect(tumblerContainer).toBeVisible({ timeout: 30_000 });
    await tumblerContainer.locator("[data-cf-start-btn]").click();

    const uploadInput = page.locator('[data-cf-uploader] [data-upload-input="1"]').first();
    await uploadInput.setInputFiles(FRONT_FILE);

    await expect(tumblerContainer.locator("[data-cf-tumbler-design-wrap]")).toBeVisible({ timeout: 30_000 });

    await addToCart(page);
    await expectCartNotificationVisible(page);
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /custom print\s+20 oz insulated tumbler/i }).first()).toBeVisible({
      timeout: 30_000
    });
    await expectNoRawSlot2MetadataVisible(page);
  });
});
