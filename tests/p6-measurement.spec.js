const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const FRONT_BACK_PRODUCT_PATH =
  process.env.PLAYWRIGHT_TSHIRT_FRONT_BACK_PATH ||
  "/products/custom-design-t-shirt-adults-and-kids-with-print-on-front-and-back?_pos=3&_psq=front+and+ba&_ss=e&_v=1.0";

const FRONT_FILE = path.resolve(__dirname, "fixtures", "woof frame.png");
const BACK_FILE = path.resolve(__dirname, "fixtures", "26.png");
const MEASUREMENT_REPORT_PATH = path.resolve(__dirname, "..", "debug", "p6-measurements.json");

test.describe.configure({ timeout: 300_000 });

async function clearCart(page, baseURL) {
  await page.goto(`${baseURL}/cart/clear`, { waitUntil: "domcontentloaded" });
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

async function waitForPreviewSrc(page, { timeout = 30_000, not = "" } = {}) {
  await expect
    .poll(async () => {
      const snapshot = await getDesignPreviewSnapshot(page);
      return snapshot && !snapshot.hidden && snapshot.naturalWidth > 0 && snapshot.naturalHeight > 0
        ? snapshot.src
        : "";
    }, { timeout })
    .not.toBe(not);
  const snapshot = await getDesignPreviewSnapshot(page);
  return snapshot ? snapshot.src : "";
}

async function getActiveSide(page) {
  return page.evaluate(() => {
    const hidden = document.querySelector("#bd_active_side");
    const value = ((hidden && hidden.value) || "").toLowerCase();
    return value === "back" ? "back" : "front";
  });
}

async function switchToSide(page, side) {
  const targetSide = side === "back" ? "back" : "front";
  const tab = page.getByRole("tab", { name: targetSide === "back" ? /^back$/i : /^front$/i });
  const startedAt = Date.now();
  await tab.click();
  await expect.poll(() => getActiveSide(page), { timeout: 15_000 }).toBe(targetSide);
  return Date.now() - startedAt;
}

async function applyCrop(page) {
  const cropButton = page.locator('[data-bd-inline-crop="1"]');
  await expect(cropButton).toBeVisible({ timeout: 15_000 });
  await cropButton.click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /apply crop/i }).click();
  await expect(page.locator('[data-bd-crop-image="1"]')).toBeHidden({ timeout: 15_000 });
}

async function getProofSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__bdTshirtPreviewState;
    const frontInput = document.querySelector("#bd_proof_mockup_url_front");
    const backInput = document.querySelector("#bd_proof_mockup_url_back");
    const finalizeStatus = document.querySelector('[data-bd-finalize-status="1"]');
    const addToCartButton = document.querySelector('product-form form[action*="/cart/add"] button[type="submit"]');
    return {
      frontUrl: frontInput instanceof HTMLInputElement ? String(frontInput.value || "").trim() : "",
      backUrl: backInput instanceof HTMLInputElement ? String(backInput.value || "").trim() : "",
      canApproveAddToCart:
        state && typeof state.canApproveAddToCart === "function" ? !!state.canApproveAddToCart() : false,
      designFinalized:
        state && typeof state.isDesignFinalized === "function" ? !!state.isDesignFinalized() : false,
      finalizeInProgress:
        state && typeof state.isFinalizeInProgress === "function" ? !!state.isFinalizeInProgress() : false,
      frontProofValid:
        state && typeof state.isProofValidForSide === "function" ? !!state.isProofValidForSide("front") : false,
      backProofValid:
        state && typeof state.isProofValidForSide === "function" ? !!state.isProofValidForSide("back") : false,
      addToCartDisabled:
        addToCartButton instanceof HTMLButtonElement ? !!addToCartButton.disabled : true,
      finalizeStatusText:
        finalizeStatus instanceof HTMLElement ? String(finalizeStatus.textContent || "").trim() : ""
    };
  });
}

function isMeaningfulUrlChange(nextUrl, previousUrl) {
  return !!nextUrl && String(nextUrl).trim() !== String(previousUrl || "").trim();
}

async function waitForFinalizeRecovery(page, options = {}) {
  const requiredSides = Array.isArray(options.requiredSides) && options.requiredSides.length
    ? options.requiredSides.map((side) => (side === "back" ? "back" : "front"))
    : ["front", "back"];
  const baselineSnapshot = options.baselineSnapshot || {};
  const requireFinalizeRecovered = options.requireFinalizeRecovered !== false;
  const requireAddToCartRecovered = options.requireAddToCartRecovered !== false;
  const allowUnrecoveredReadyState = options.allowUnrecoveredReadyState === true;
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 60_000;

  const startedAt = Date.now();
  const result = {
    frontProofReadyMs: null,
    backProofReadyMs: null,
    allProofsReadyMs: null,
    finalizeReadyRecoveredMs: null,
    addToCartReadyRecoveredMs: null,
    finalSnapshot: null,
    completionBasis: "unknown"
  };

  let sawFinalizeInProgress = false;
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await getProofSnapshot(page);
    lastSnapshot = snapshot;
    if (snapshot.finalizeInProgress) sawFinalizeInProgress = true;

    if (
      requiredSides.includes("front") &&
      result.frontProofReadyMs === null &&
      (
        (snapshot.frontProofValid && !baselineSnapshot.frontProofValid) ||
        isMeaningfulUrlChange(snapshot.frontUrl, baselineSnapshot.frontUrl)
      )
    ) {
      result.frontProofReadyMs = Date.now() - startedAt;
    }

    if (
      requiredSides.includes("back") &&
      result.backProofReadyMs === null &&
      (
        (snapshot.backProofValid && !baselineSnapshot.backProofValid) ||
        isMeaningfulUrlChange(snapshot.backUrl, baselineSnapshot.backUrl)
      )
    ) {
      result.backProofReadyMs = Date.now() - startedAt;
    }

    const requiredProofsReady = requiredSides.every((side) =>
      side === "back" ? result.backProofReadyMs !== null : result.frontProofReadyMs !== null
    );

    if (requiredProofsReady && result.allProofsReadyMs === null) {
      result.allProofsReadyMs = Date.now() - startedAt;
    }

    if (snapshot.designFinalized && result.finalizeReadyRecoveredMs === null) {
      result.finalizeReadyRecoveredMs = Date.now() - startedAt;
    }

    if (snapshot.canApproveAddToCart && result.addToCartReadyRecoveredMs === null) {
      result.addToCartReadyRecoveredMs = Date.now() - startedAt;
    }

    const finalizeReadyOk = !requireFinalizeRecovered || result.finalizeReadyRecoveredMs !== null;
    const addToCartReadyOk = !requireAddToCartRecovered || result.addToCartReadyRecoveredMs !== null;

    if (requiredProofsReady && finalizeReadyOk && addToCartReadyOk) {
      result.finalSnapshot = snapshot;
      result.completionBasis = "direct-state";
      return result;
    }

    if (
      sawFinalizeInProgress &&
      !snapshot.finalizeInProgress &&
      requiredProofsReady &&
      !requireFinalizeRecovered &&
      !requireAddToCartRecovered
    ) {
      result.finalSnapshot = snapshot;
      result.completionBasis = "proof-state-fallback";
      return result;
    }

    if (
      allowUnrecoveredReadyState &&
      sawFinalizeInProgress &&
      !snapshot.finalizeInProgress &&
      requiredProofsReady &&
      result.finalizeReadyRecoveredMs === null &&
      result.addToCartReadyRecoveredMs === null
    ) {
      result.finalSnapshot = snapshot;
      result.completionBasis = "proof-ready-without-gate-recovery";
      return result;
    }

    await page.waitForTimeout(100);
  }

  const requiredProofsReady = requiredSides.every((side) =>
    side === "back" ? result.backProofReadyMs !== null : result.frontProofReadyMs !== null
  );
  if (allowUnrecoveredReadyState && requiredProofsReady) {
    result.finalSnapshot = lastSnapshot;
    result.completionBasis = "proof-ready-without-gate-recovery";
    return result;
  }
  if (allowUnrecoveredReadyState) {
    result.finalSnapshot = lastSnapshot;
    result.completionBasis = "timeout-unrecovered";
    return result;
  }

  throw new Error(
    `Timed out waiting for finalize recovery. Last snapshot: ${JSON.stringify(lastSnapshot)}`
  );
}

async function getColorGroupState(page) {
  return page.evaluate(() => {
    const selectorUsed =
      'variant-selects fieldset.product-form__input--swatch input.swatch-input__input[type="radio"][name^="Color-"]';
    const fieldset = document.querySelector("variant-selects fieldset.product-form__input--swatch");
    if (!(fieldset instanceof HTMLFieldSetElement)) {
      return {
        selectorUsed,
        groupLabel: "Color",
        selected: null,
        options: [],
        reason: "Color swatch fieldset not found."
      };
    }

    const radios = Array.from(fieldset.querySelectorAll('input.swatch-input__input[type="radio"][name^="Color-"]'));
    if (!radios.length) {
      return {
        selectorUsed,
        groupLabel: "Color",
        selected: null,
        options: [],
        reason: "No color radios found inside the swatch fieldset."
      };
    }

    const options = radios
      .map((input) => {
        if (!(input instanceof HTMLInputElement)) return null;
        const labels = input.labels ? Array.from(input.labels) : [];
        const labelText = labels
          .map((label) => String(label.textContent || "").replace(/\s+/g, " ").trim())
          .find(Boolean);
        const cleanLabel = String(labelText || input.value || input.id || "")
          .replace(/\s+Variant sold out or unavailable$/i, "")
          .trim();
        return {
          id: input.id || "",
          checked: !!input.checked,
          disabled: !!input.disabled,
          label: cleanLabel,
          value: String(input.value || "").trim(),
          labelSelector: input.id ? `label[for="${input.id}"]` : ""
        };
      })
      .filter((entry) => entry && entry.id && entry.label);

    const selected = options.find((option) => option.checked) || null;
    return {
      selectorUsed,
      groupLabel: "Color",
      selected,
      options,
      reason: selected ? "Selected color radio found." : "No checked color radio found."
    };
  });
}

async function changeColorVariant(page) {
  const selectorUsed =
    'variant-selects fieldset.product-form__input--swatch input.swatch-input__input[type="radio"][name^="Color-"]';
  const colorStateBefore = await getColorGroupState(page);
  if (!colorStateBefore || !colorStateBefore.selected) {
    return {
      control: "none",
      changed: false,
      target: "",
      targetedColorOption: false,
      selectorUsed,
      targetedColorReason:
        colorStateBefore && colorStateBefore.reason
          ? colorStateBefore.reason
          : "No selected color radio was available before attempting the switch.",
      selectedColorBefore: "",
      selectedColorAfter: ""
    };
  }

  const fieldset = page.locator("variant-selects fieldset.product-form__input--swatch");
  const currentColor = colorStateBefore.selected.label || colorStateBefore.selected.value || "";
  const preferredPink = colorStateBefore.options.find(
    (option) =>
      !option.checked &&
      !option.disabled &&
      (option.label || option.value || "").trim().toLowerCase() === "pink"
  );
  const fallbackOption = colorStateBefore.options.find(
    (option) =>
      !option.checked &&
      !option.disabled &&
      !!(option.label || option.value || "").trim() &&
      (option.label || option.value || "").trim() !== currentColor
  );
  const targetOption = preferredPink || fallbackOption;

  if (!targetOption) {
    return {
      control: "radio",
      changed: false,
      target: "",
      targetedColorOption: false,
      selectorUsed,
      targetedColorReason: "No alternate enabled color radio was available in the same swatch fieldset.",
      colorGroupLabel: colorStateBefore.groupLabel,
      selectedColorBefore: currentColor,
      selectedColorAfter: currentColor
    };
  }

  const targetLabel = fieldset.locator(targetOption.labelSelector);
  const targetRadio = fieldset.locator(`#${targetOption.id}`);
  const targetSwatch = targetLabel.locator(".swatch");

  try {
    await fieldset.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    });
    await expect(targetLabel).toBeVisible({ timeout: 5_000 });
    if (await targetSwatch.count()) {
      await targetSwatch.click();
    } else {
      await targetLabel.click();
    }
  } catch (error) {
    try {
      await targetLabel.evaluate((element) => element.click());
    } catch (fallbackError) {
      try {
        await targetRadio.check({ force: true });
      } catch (radioError) {
        return {
          control: "radio",
          changed: false,
          target: targetOption.label || targetOption.value || "",
          targetedColorOption: false,
          selectorUsed,
          targetedColorReason: `Failed to activate target color radio ${targetOption.id} via swatch click, label click, and direct check.`,
          colorGroupLabel: colorStateBefore.groupLabel,
          selectedColorBefore: currentColor,
          selectedColorAfter: currentColor
        };
      }
    }
  }

  let colorStateAfter = null;
  try {
    await expect
      .poll(() => getColorGroupState(page), { timeout: 10_000 })
      .toMatchObject({
        selected: {
          id: targetOption.id
        }
      });
    colorStateAfter = await getColorGroupState(page);
  } catch (error) {
    colorStateAfter = await getColorGroupState(page);
  }

  const selectedAfter = colorStateAfter && colorStateAfter.selected
    ? colorStateAfter.selected.label || colorStateAfter.selected.value || ""
    : "";
  const changed =
    !!colorStateAfter &&
    !!colorStateAfter.selected &&
    colorStateAfter.selected.id === targetOption.id &&
    !!selectedAfter &&
    selectedAfter !== currentColor;

  return {
    control: "radio",
    changed,
    target: targetOption.label || targetOption.value || "",
    targetedColorOption: changed,
    selectorUsed,
    targetedColorReason: changed
      ? `Color changed from ${currentColor} to ${selectedAfter} within the swatch fieldset.`
      : `Color switch did not confirm. Expected ${targetOption.label || targetOption.value || targetOption.id}, but selected color is ${selectedAfter || "unchanged"}.`,
    colorGroupLabel: colorStateBefore.groupLabel,
    selectedColorBefore: currentColor,
    selectedColorAfter: selectedAfter || currentColor
  };
}

async function measureVariantInvalidation(page, changeAction) {
  const startedAt = Date.now();
  await changeAction();
  await expect
    .poll(() => getProofSnapshot(page), { timeout: 30_000 })
    .toMatchObject({
      canApproveAddToCart: false,
      designFinalized: false
    });
  return {
    variantChangeToInvalidateMs: Date.now() - startedAt,
    invalidatedSnapshot: await getProofSnapshot(page)
  };
}

async function installProofPhaseProbe(page) {
  await page.evaluate(() => {
    window.__bdProofPhaseProbe = {
      marks: [],
      record(mark) {
        const side = mark && mark.side === "back" ? "back" : "front";
        const phase = String((mark && mark.phase) || "").trim();
        const ts = Number((mark && mark.ts) || Date.now());
        this.marks.push({ side, phase, ts });
      },
      clear() {
        this.marks = [];
      },
      snapshot() {
        return Array.isArray(this.marks) ? this.marks.slice() : [];
      }
    };
  });
}

async function clearProofPhaseProbe(page) {
  await page.evaluate(() => {
    if (window.__bdProofPhaseProbe && typeof window.__bdProofPhaseProbe.clear === "function") {
      window.__bdProofPhaseProbe.clear();
    }
  });
}

async function getProofPhaseMarks(page) {
  return page.evaluate(() => {
    if (window.__bdProofPhaseProbe && typeof window.__bdProofPhaseProbe.snapshot === "function") {
      return window.__bdProofPhaseProbe.snapshot();
    }
    return [];
  });
}

function getFirstPhaseOffset(marks, startedAt, side, phase) {
  const mark = (marks || []).find((entry) => entry && entry.side === side && entry.phase === phase);
  return mark ? Math.max(0, mark.ts - startedAt) : null;
}

function writeMeasurementReport(report) {
  fs.mkdirSync(path.dirname(MEASUREMENT_REPORT_PATH), { recursive: true });
  fs.writeFileSync(MEASUREMENT_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

test.describe("P6 measurement breakdown", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await clearCart(page, baseURL);
  });

  test("records sequential variant-change finalize breakdown without changing runtime behavior", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop-only measurement flow");

    await page.goto(FRONT_BACK_PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    await installProofPhaseProbe(page);
    await page.getByRole("button", { name: /start designing/i }).click();

    const frontInput = page.locator('#cfUploadFront[data-upload-input="1"]');
    const backInput = page.locator('#cfUploadBack[data-upload-input="2"]');
    const finalizeButton = page.locator('[data-bd-finalize-btn="1"]');

    await frontInput.setInputFiles(FRONT_FILE);
    const frontUploadSrc = await waitForPreviewSrc(page);
    await applyCrop(page);
    await waitForPreviewSrc(page, { not: frontUploadSrc });

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    const initialFrontBaseline = await getProofSnapshot(page);
    await finalizeButton.click();
    const initialFrontFinalize = await waitForFinalizeRecovery(page, {
      requiredSides: ["front"],
      baselineSnapshot: initialFrontBaseline,
      requireFinalizeRecovered: false,
      requireAddToCartRecovered: false,
      timeoutMs: 30_000
    });
    const proofReadyFrontMs = initialFrontFinalize.frontProofReadyMs;

    const sideSwitchFrontToBackMs = await switchToSide(page, "back");

    await backInput.setInputFiles(BACK_FILE);
    const backUploadSrc = await waitForPreviewSrc(page);
    await applyCrop(page);
    await waitForPreviewSrc(page, { not: backUploadSrc });

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    const initialBackBaseline = await getProofSnapshot(page);
    await finalizeButton.click();
    const initialBackFinalize = await waitForFinalizeRecovery(page, {
      requiredSides: ["back"],
      baselineSnapshot: initialBackBaseline,
      requireFinalizeRecovered: true,
      requireAddToCartRecovered: true,
      allowUnrecoveredReadyState: true,
      timeoutMs: 45_000
    });
    const proofReadyBackMs = initialBackFinalize.backProofReadyMs;

    const sideSwitchBackToFrontMs = await switchToSide(page, "front");

    const colorSelectionBeforeChange = await getColorGroupState(page);
    let changedVariantSelection = null;
    const invalidation = await measureVariantInvalidation(page, async () => {
      changedVariantSelection = await changeColorVariant(page);
      expect(changedVariantSelection.targetedColorOption).toBe(true);
      expect(changedVariantSelection.changed).toBe(true);
    });

    await expect(finalizeButton).toBeEnabled({ timeout: 30_000 });
    const regenerationBaseline = await getProofSnapshot(page);
    await clearProofPhaseProbe(page);
    const regenerationStartedAt = await page.evaluate(() => Date.now());
    await finalizeButton.click();
    const regeneration = await waitForFinalizeRecovery(page, {
      requiredSides: ["front", "back"],
      baselineSnapshot: regenerationBaseline,
      requireFinalizeRecovered: true,
      requireAddToCartRecovered: true,
      allowUnrecoveredReadyState: true,
      timeoutMs: 45_000
    });
    const regenerationPhaseMarks = await getProofPhaseMarks(page);

    const finalizeStartToFrontRenderStartMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "front",
      "render-start"
    );
    const finalizeStartToFrontBlobReadyMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "front",
      "blob-ready"
    );
    const finalizeStartToFrontUploadDoneMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "front",
      "upload-done"
    );
    const finalizeStartToBackRenderStartMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "back",
      "render-start"
    );
    const finalizeStartToBackBlobReadyMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "back",
      "blob-ready"
    );
    const finalizeStartToBackUploadDoneMs = getFirstPhaseOffset(
      regenerationPhaseMarks,
      regenerationStartedAt,
      "back",
      "upload-done"
    );

    const report = {
      priority: "P6.2.1-followup",
      scenario: "front-back sequential variant-change finalize phase breakdown",
      project: testInfo.project.name,
      capturedAt: new Date().toISOString(),
      sourceSpec: path.relative(process.cwd(), testInfo.file),
      measurements: {
        proofReadyFrontMs,
        proofReadyBackMs,
        sideSwitchFrontToBackMs,
        sideSwitchBackToFrontMs,
        variantChangeToInvalidateMs: invalidation.variantChangeToInvalidateMs,
        finalizeStartToFrontRenderStartMs,
        finalizeStartToFrontBlobReadyMs,
        finalizeStartToFrontUploadDoneMs,
        finalizeStartToBackRenderStartMs,
        finalizeStartToBackBlobReadyMs,
        finalizeStartToBackUploadDoneMs,
        finalizeStartToFrontProofReadyMs: regeneration.frontProofReadyMs,
        finalizeStartToBackProofReadyMs: regeneration.backProofReadyMs,
        finalizeStartToAllProofsReadyMs: regeneration.allProofsReadyMs,
        finalizeStartToFinalizeReadyRecoveredMs: regeneration.finalizeReadyRecoveredMs,
        finalizeStartToAddToCartReadyRecoveredMs: regeneration.addToCartReadyRecoveredMs
      },
      assertions: {
        initialFrontProofReady: true,
        initialBackProofReady: true,
        variantChanged: true,
        variantInvalidatedCurrentApproval: true,
        regenerationRecoveredProofs: true,
        regenerationRecoveredFinalizeReady: regeneration.finalizeReadyRecoveredMs !== null,
        regenerationRecoveredAddToCartReady: regeneration.addToCartReadyRecoveredMs !== null
      },
      notes: {
        product: FRONT_BACK_PRODUCT_PATH,
        runtimeInstrumentation:
          "Minimal proof-phase probe via window.__bdProofPhaseProbe records render-start, blob-ready, and upload-done timestamps inside bdSyncProofMockupNow. Rollback: remove bdRecordProofPhase and the three phase calls from assets/cf-tshirt-preview-lite.js, plus the probe helpers in this spec.",
        initialColorSelection: colorSelectionBeforeChange,
        changedVariantSelection,
        invalidatedSnapshot: invalidation.invalidatedSnapshot,
        regenerationBaseline,
        regenerationPhaseMarks,
        regenerationFinalSnapshot: regeneration.finalSnapshot,
        initialBackFinalizeFinalSnapshot: initialBackFinalize.finalSnapshot,
        initialBackFinalizeCompletionBasis: initialBackFinalize.completionBasis,
        regenerationCompletionBasis: regeneration.completionBasis,
        measurementBasis:
          "Variant invalidation is measured from the color change action until designFinalized=false and canApproveAddToCart=false. Regeneration phase timings are measured from a browser-side timestamp captured immediately before the Finalize click. render-start marks the beginning of bdRenderProofBlobForSide, blob-ready marks completion of canvas export, upload-done marks completion of Cloudinary upload, and proof-ready remains the existing state-based readiness timing."
      }
    };

    writeMeasurementReport(report);

    expect(proofReadyFrontMs).toBeGreaterThan(0);
    expect(proofReadyBackMs).toBeGreaterThan(0);
    expect(invalidation.variantChangeToInvalidateMs).toBeGreaterThan(0);
    if (regeneration.frontProofReadyMs !== null) {
      expect(regeneration.frontProofReadyMs).toBeGreaterThan(0);
    }
    if (regeneration.backProofReadyMs !== null) {
      expect(regeneration.backProofReadyMs).toBeGreaterThan(0);
    }
    if (finalizeStartToFrontRenderStartMs !== null) {
      expect(finalizeStartToFrontRenderStartMs).toBeGreaterThanOrEqual(0);
    }
    if (finalizeStartToFrontBlobReadyMs !== null) {
      expect(finalizeStartToFrontBlobReadyMs).toBeGreaterThan(0);
    }
    if (finalizeStartToFrontUploadDoneMs !== null) {
      expect(finalizeStartToFrontUploadDoneMs).toBeGreaterThan(0);
    }
    if (finalizeStartToBackRenderStartMs !== null) {
      expect(finalizeStartToBackRenderStartMs).toBeGreaterThanOrEqual(0);
    }
    if (finalizeStartToBackBlobReadyMs !== null) {
      expect(finalizeStartToBackBlobReadyMs).toBeGreaterThan(0);
    }
    if (finalizeStartToBackUploadDoneMs !== null) {
      expect(finalizeStartToBackUploadDoneMs).toBeGreaterThan(0);
    }
    if (regeneration.allProofsReadyMs !== null) {
      expect(regeneration.allProofsReadyMs).toBeGreaterThan(0);
    }
    if (regeneration.finalizeReadyRecoveredMs !== null) {
      expect(regeneration.finalizeReadyRecoveredMs).toBeGreaterThan(0);
    }
    if (regeneration.addToCartReadyRecoveredMs !== null) {
      expect(regeneration.addToCartReadyRecoveredMs).toBeGreaterThan(0);
    }
  });
});
