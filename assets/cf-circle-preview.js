/* assets/cf-circle-preview.js */
(function () {
  const root = document.getElementById("cf-circle-preview-container");
  if (!root) return;

  const startBtn = root.querySelector("[data-cf-start-btn]");
  const body = root.querySelector(".cf-circle-designer-body");
  const uploadBtn = root.querySelector("[data-cf-circle-upload-btn]");
  const resetBtn = root.querySelector("[data-cf-circle-reset-btn]");
  const loadOriginalBtn = root.querySelector("[data-cf-circle-load-original-btn]");
  const stage = root.querySelector("[data-cf-circle-stage]");
  const previewStage = root.querySelector("[data-cf-circle-preview-stage]");
  const mockupImg = root.querySelector("[data-cf-circle-mockup]");
  const placeholderEl = root.querySelector("[data-cf-circle-placeholder]");
  const placeholderEyebrowEl = root.querySelector("[data-cf-circle-placeholder-eyebrow]");
  const placeholderTitleEl = root.querySelector("[data-cf-circle-placeholder-title]");
  const placeholderHintEl = root.querySelector("[data-cf-circle-placeholder-hint]");
  const frameLabelEl = root.querySelector("[data-cf-circle-frame-label]");
  const frameEl = root.querySelector("[data-cf-circle-frame]");
  const previewMaskEl = root.querySelector("[data-cf-circle-preview-mask]");
  const previewFrameEl = root.querySelector("[data-cf-circle-preview-frame]");
  const designWrap = root.querySelector("[data-cf-circle-design-wrap]");
  const previewDesignWrap = root.querySelector("[data-cf-circle-preview-design-wrap]");
  const designEditImg = root.querySelector("[data-cf-circle-design-edit]");
  const previewDesignImg = root.querySelector("[data-cf-circle-preview-design]");
  const resizeHandle = root.querySelector("[data-cf-circle-handle]");
  const frameSliderRow = root.querySelector("[data-cf-circle-frame-slider-row]");
  const frameSliderInput = root.querySelector("[data-cf-circle-frame-slider]");
  const frameDecreaseBtn = root.querySelector("[data-cf-circle-frame-decrease]");
  const frameIncreaseBtn = root.querySelector("[data-cf-circle-frame-increase]");
  const statusEl = root.querySelector("[data-cf-circle-status]");
  const metaEl = root.querySelector("[data-cf-circle-meta]");
  const variantMediaMapScript = root.querySelector("[data-cf-circle-variant-media]");
  const variantLabelMapScript = root.querySelector("[data-cf-circle-variant-labels]");

  const uploader = document.querySelector("[data-cf-uploader]");
  const uploadInput = uploader ? uploader.querySelector('[data-upload-input="1"]') : null;
  const previewImg = uploader ? uploader.querySelector('[data-preview-img="1"]') : null;
  const statusSource = uploader ? uploader.querySelector('[data-status="1"]') : null;
  const designUrlInput = uploader ? uploader.querySelector('[data-url="1"]') : null;
  const masterOriginalUrlInput = uploader ? uploader.querySelector('[data-master-url="1"]') : null;
  const previewWrap = uploader ? uploader.querySelector('[data-preview-wrap="1"]') : null;
  const productInfo = root.closest("product-info");
  const configUrl = root.dataset.configUrl || "";
  const productHandle = root.dataset.productHandle || "";
  const configKey = root.dataset.configKey || "";
  const uploadMode = (root.dataset.uploadMode || "default").toLowerCase();
  const defaultMockupSrc = root.dataset.defaultMockupSrc || "";

  if (!stage || !previewStage || !mockupImg || !placeholderEl || !placeholderEyebrowEl || !placeholderTitleEl || !placeholderHintEl || !frameLabelEl || !frameEl || !previewMaskEl || !previewFrameEl || !designWrap || !previewDesignWrap || !designEditImg || !previewDesignImg || !resizeHandle || !uploadInput) return;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const round = (n) => Math.round(n * 10000) / 10000;
  const canUseLocalUploadFile = (file) => {
    if (!file) return false;
    const type = String(file.type || "").trim().toLowerCase();
    if (uploadMode === "svg-only") return type === "image/svg+xml";
    return type === "image/png" || type === "image/jpeg" || type === "image/svg+xml";
  };
  const isLargeUploadMessage = (text) => {
    const value = String(text || "").trim();
    if (!value) return false;
    return /10mb/i.test(value) || /info@sarvsartsandcrafts\.com/i.test(value);
  };
  const normalizeSrc = (src) => {
    const value = String(src || "").trim();
    if (!value) return "";
    if (value.startsWith("//")) return `${window.location.protocol}${value}`;
    return value;
  };
  const getMasterOriginalUrl = () => String((masterOriginalUrlInput && masterOriginalUrlInput.value) || "").trim();
  const readMasterOriginalFile = () => {
    if (typeof window.bdReadMasterOriginalUpload !== "function" || !uploader) {
      return Promise.resolve(null);
    }
    return Promise.resolve(window.bdReadMasterOriginalUpload(uploader, "1")).catch(() => null);
  };

  const state = {
    mockup: {
      src: normalizeSrc(defaultMockupSrc),
      width: 0,
      height: 0
    },
    design: {
      src: "",
      width: 0,
      height: 0
    },
    placement: null,
    defaultPlacement: null
  };

  const editorFrameConfig = Object.freeze({
    cxPct: 0.5,
    cyPct: 0.5,
    radiusPct: 0.34
  });

  let configJson = null;
  let productConfig = null;
  let configPromise = null;
  let variantMediaMap = {};
  let variantLabelMap = {};
  let currentVariantId = "";
  let lastVariantId = "";
  let objectUrl = "";
  let pointerMode = "";
  let activePointerId = null;
  let pointerStart = null;
  let startPlacement = null;
  let startPointerRadius = 0;
  let variantRefreshTimer = null;
  let renderScheduled = false;
  let heroPreviewMask = null;
  let heroPreviewWrap = null;
  let heroPreviewImg = null;
  let proofSyncTimer = null;
  let proofLastKey = "";
  let proofLastUrl = "";
  let proofInFlightPromise = null;
  let allowNextSubmit = false;
  let draftPersistFrame = 0;
  let pendingRestoreSnapshot = null;
  let frameRadiusPct = null;
  let restoreInProgress = false;
  let restoreCompleted = false;
  const PROOF_WAIT_MS = 1400;
  const PROOF_NOTICE_TEXT = "Preparing the cart proof image...";
  const PROOF_FALLBACK_TEXT = "Proof size is greater than 10MB or proof upload could not complete. Adding to cart without the proof preview.";

  if (variantMediaMapScript) {
    try {
      variantMediaMap = JSON.parse(variantMediaMapScript.textContent || "{}") || {};
    } catch (e) {
      variantMediaMap = {};
    }
  }
  if (variantLabelMapScript) {
    try {
      variantLabelMap = JSON.parse(variantLabelMapScript.textContent || "{}") || {};
    } catch (e) {
      variantLabelMap = {};
    }
  }

  const getScopedRoot = () => productInfo || root.closest(".shopify-section") || document;
  const getMediaGallery = () => root.closest(".shopify-section")?.querySelector("media-gallery") || document.querySelector("media-gallery");
  const getThumbnailSlider = () => getMediaGallery()?.querySelector('[id^="GalleryThumbnails-"]') || null;
  const getDraftSessionKey = () =>
    `cf-customizer-draft:circle:${productHandle || window.location.pathname}`;

  const getProductForm = () => {
    if (productInfo) {
      return productInfo.querySelector('form[data-type="add-to-cart-form"]');
    }
    return document.querySelector('form[data-type="add-to-cart-form"]');
  };

  const ensureThumbnailLockNotice = () => {
    const slider = getThumbnailSlider();
    if (!slider) return null;
    let notice = slider.parentElement ? slider.parentElement.querySelector("[data-cf-circle-thumb-lock-note]") : null;
    if (notice) return notice;
    notice = document.createElement("p");
    notice.setAttribute("data-cf-circle-thumb-lock-note", "");
    notice.className = "cf-circle-thumbnail-lock-note";
    notice.hidden = true;
    notice.textContent = "While editing, the design stays on the active preview mockup.";
    slider.insertAdjacentElement("afterend", notice);
    return notice;
  };

  const syncThumbnailLockState = () => {
    const gallery = getMediaGallery();
    if (!gallery) return;
    const isLocked = !!state.design.src;
    gallery.classList.toggle("bd-circle-thumbs-locked", isLocked);

    const notice = ensureThumbnailLockNotice();
    if (notice) {
      notice.hidden = !isLocked;
    }

    gallery.querySelectorAll("button.thumbnail").forEach((button) => {
      const isBlockedThumb = isLocked && !!String(button.getAttribute("data-target") || "").trim();
      button.classList.toggle("is-circle-thumb-locked", isBlockedThumb);
      button.setAttribute("aria-disabled", isBlockedThumb ? "true" : "false");
      button.disabled = isBlockedThumb;
      if (isBlockedThumb) {
        button.setAttribute("title", "Finish reviewing the active design preview before browsing other product images.");
      } else {
        button.removeAttribute("title");
      }
    });
  };

  const buildDraftSessionSnapshot = () => {
    const designUrl = String(
      (designUrlInput && designUrlInput.value) ||
      state.design.src ||
      ""
    ).trim();
    if (!designUrl || !state.placement) return null;
    return {
      designUrl,
      placement: { ...state.placement },
      variantId: currentVariantId || readVariantId(),
      frameRadiusPct: frameRadiusPct != null ? Number(frameRadiusPct) : null,
      isOpen: root.classList.contains("is-design-open") || !body.hidden
    };
  };

  const persistDraftSessionNow = () => {
    const key = getDraftSessionKey();
    try {
      const snapshot = buildDraftSessionSnapshot();
      if (!snapshot) {
        window.sessionStorage.removeItem(key);
        return false;
      }
      window.sessionStorage.setItem(key, JSON.stringify(snapshot));
      return true;
    } catch (e) {
      return false;
    }
  };

  const scheduleDraftPersist = () => {
    if (restoreInProgress) return;
    if (draftPersistFrame) return;
    draftPersistFrame = window.requestAnimationFrame(() => {
      draftPersistFrame = 0;
      persistDraftSessionNow();
    });
  };

  const readDraftSessionSnapshot = () => {
    try {
      const raw = window.sessionStorage.getItem(getDraftSessionKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const clearDraftSessionSnapshot = () => {
    try {
      window.sessionStorage.removeItem(getDraftSessionKey());
    } catch (e) {}
  };

  const getNavigationType = () => {
    try {
      if (!window.performance || typeof window.performance.getEntriesByType !== "function") {
        return "";
      }
      const entries = window.performance.getEntriesByType("navigation");
      return String((entries && entries[0] && entries[0].type) || "").trim().toLowerCase();
    } catch (e) {
      return "";
    }
  };

  const shouldAttemptDraftRestore = ({ persisted = false } = {}) => {
    if (persisted) return true;
    const navType = getNavigationType();
    if (navType === "back_forward") return true;
    const referrer = String(document.referrer || "").trim().toLowerCase();
    return /\/cart(?:[?#]|$)/.test(referrer);
  };

  const closeTransientCartUi = () => {
    try {
      const cartNotification = document.querySelector("cart-notification");
      if (cartNotification && typeof cartNotification.close === "function") {
        cartNotification.close();
      }
      const notificationDialog = document.getElementById("cart-notification");
      if (notificationDialog) {
        notificationDialog.classList.remove("active", "animate");
      }
    } catch (e) {}

    try {
      const cartDrawer = document.querySelector("cart-drawer");
      if (cartDrawer && typeof cartDrawer.close === "function") {
        cartDrawer.close();
      }
      if (cartDrawer) {
        cartDrawer.classList.remove("active");
      }
    } catch (e) {}

    try {
      document.body.classList.remove("overflow-hidden");
    } catch (e) {}
  };

  const setRestoreMode = (active) => {
    restoreInProgress = !!active;
    if (restoreInProgress) {
      restoreCompleted = false;
    }
  };

  const getVariantIdInput = () => {
    const form = getProductForm();
    return form ? form.querySelector('input[name="id"]') : null;
  };

  const resumeProductSubmit = () => {
    const productForm = getProductForm();
    if (!productForm) return;
    const submitButton = productForm.querySelector('button[type="submit"][name="add"], button[type="submit"], input[type="submit"]');
    if (typeof productForm.requestSubmit === "function") {
      if (submitButton) {
        productForm.requestSubmit(submitButton);
      } else {
        productForm.requestSubmit();
      }
      return;
    }
    if (submitButton && typeof submitButton.click === "function") {
      submitButton.click();
      return;
    }
    productForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  const ensureHiddenInput = (id, name) => {
    const productForm = getProductForm();
    if (!productForm) return null;
    let input = productForm.querySelector(`#${id}`);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.id = id;
      input.name = name;
      productForm.appendChild(input);
    }
    return input;
  };

  const ensureProofInput = () => ensureHiddenInput("cf_circle_proof_mockup_url", "properties[Proof Mockup URL]");
  const ensureProofNoticeInput = () => ensureHiddenInput("cf_circle_proof_notice", "properties[_Proof Notice]");

  const setProofUrl = (url) => {
    const input = ensureProofInput();
    if (input) input.value = String(url || "").trim();
  };

  const rehydrateProofStateFromInputs = () => {
    const proofInput = ensureProofInput();
    const currentUrl = proofInput ? String(proofInput.value || "").trim() : "";
    const currentKey = getProofStateKey();
    if (!currentUrl || !currentKey) return;
    proofLastUrl = currentUrl;
    proofLastKey = currentKey;
    setProofNotice("");
  };

  const setProofNotice = (message) => {
    const input = ensureProofNoticeInput();
    if (input) input.value = String(message || "").trim();
  };

  const getProofNotice = () => {
    const input = ensureProofNoticeInput();
    return input ? String(input.value || "").trim() : "";
  };

  const loadConfig = (forceReload) => {
    if (configPromise && !forceReload) return configPromise;
    if (!configUrl || typeof fetch !== "function") {
      configPromise = Promise.resolve(null);
      return configPromise;
    }

    const requestUrl = forceReload
      ? `${configUrl}${configUrl.indexOf("?") >= 0 ? "&" : "?"}cf_circle_ts=${Date.now()}`
      : configUrl;

    configPromise = fetch(requestUrl, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        configJson = json || {};
        productConfig = configJson[configKey] || configJson[productHandle] || null;
        return configJson;
      })
      .catch(() => null);

    return configPromise;
  };

  const readVariantId = () => {
    const variantIdInput = getVariantIdInput();
    return variantIdInput ? String(variantIdInput.value || "").trim() : "";
  };

  const scheduleVariantRefresh = (variant, options) => {
    if (variantRefreshTimer) {
      window.clearTimeout(variantRefreshTimer);
      variantRefreshTimer = null;
    }
    window.requestAnimationFrame(() => updateMockupFromCurrentState(variant, options));
    window.setTimeout(() => updateMockupFromCurrentState(variant, options), 60);
    window.setTimeout(() => updateMockupFromCurrentState(variant, options), 180);
    variantRefreshTimer = window.setTimeout(() => {
      variantRefreshTimer = null;
      updateMockupFromCurrentState(variant, options);
    }, 320);
  };

  const getCurrentVariantLabel = () => String(variantLabelMap[String(currentVariantId)] || "").trim();

  const getDoorSignSizeKey = () => {
    if (configKey !== "cf-doorsign-preview") return "";
    const label = getCurrentVariantLabel().toLowerCase();
    if (!label) return "";
    if (/\b18\b/.test(label)) return "18";
    if (/\b15\b/.test(label)) return "15";
    if (/\b12\b/.test(label)) return "12";
    return "";
  };

  const getResolvedConfig = () => {
    const globalDefault = (configJson && configJson.__default__) || {};
    const productDefault = (productConfig && productConfig.default) || {};
    const variantMap = (productConfig && productConfig.variants) || {};
    const variantConfig = (currentVariantId && variantMap[currentVariantId]) || {};
    const sizeVariantMap = (productConfig && productConfig.sizeVariants) || {};
    const sizeVariantKey = getDoorSignSizeKey();
    const sizeVariantConfig = (sizeVariantKey && sizeVariantMap[sizeVariantKey]) || {};
    return {
      frame: Object.assign(
        {},
        globalDefault.frame || {},
        productDefault.frame || {},
        variantConfig.frame || {},
        sizeVariantConfig.frame || {}
      ),
      editor: Object.assign(
        {},
        globalDefault.editor || {},
        productDefault.editor || {},
        variantConfig.editor || {},
        sizeVariantConfig.editor || {}
      ),
      mockup: Object.assign(
        {},
        globalDefault.mockup || {},
        productDefault.mockup || {},
        variantConfig.mockup || {},
        sizeVariantConfig.mockup || {}
      ),
      slider: Object.assign(
        {},
        globalDefault.slider || {},
        productDefault.slider || {},
        variantConfig.slider || {},
        sizeVariantConfig.slider || {}
      )
    };
  };

  const getFrameConfig = () => {
    const resolved = getResolvedConfig();
    return {
      cxPct: resolved.frame.cxPct != null ? Number(resolved.frame.cxPct) : 0.5,
      cyPct: resolved.frame.cyPct != null ? Number(resolved.frame.cyPct) : 0.5,
      radiusPct: resolved.frame.radiusPct != null ? Number(resolved.frame.radiusPct) : 0.22
    };
  };

  const getFrameSliderConfig = () => {
    const resolved = getResolvedConfig();
    const baseFrame = getFrameConfig();
    const enabled = String(resolved.slider.enabled || "").toLowerCase() === "true" || resolved.slider.enabled === true;
    const maxRadiusPct = resolved.slider.maxRadiusPct != null ? Number(resolved.slider.maxRadiusPct) : baseFrame.radiusPct;
    const minCandidate =
      resolved.slider.minRadiusPct != null
        ? Number(resolved.slider.minRadiusPct)
        : Math.max(0.06, maxRadiusPct * 0.65);
    const minRadiusPct = Math.min(minCandidate, maxRadiusPct);
    const defaultCandidate =
      resolved.slider.defaultRadiusPct != null
        ? Number(resolved.slider.defaultRadiusPct)
        : baseFrame.radiusPct;
    const defaultRadiusPct = clamp(defaultCandidate, minRadiusPct, maxRadiusPct);
    const stepPct = Math.max(0.001, Number(resolved.slider.stepPct || 0.005));
    return {
      enabled,
      minRadiusPct,
      maxRadiusPct,
      defaultRadiusPct,
      stepPct
    };
  };

  const resetFrameRadiusSelection = () => {
    const slider = getFrameSliderConfig();
    frameRadiusPct = slider.enabled ? slider.defaultRadiusPct : null;
  };

  const getCurrentFrameConfig = () => {
    const baseFrame = getFrameConfig();
    const slider = getFrameSliderConfig();
    if (!slider.enabled) return baseFrame;
    const radiusPct = clamp(
      frameRadiusPct != null ? Number(frameRadiusPct) : slider.defaultRadiusPct,
      slider.minRadiusPct,
      slider.maxRadiusPct
    );
    return {
      ...baseFrame,
      radiusPct
    };
  };

  const getEditorConfig = () => {
    const resolved = getResolvedConfig();
    return {
      minScale: resolved.editor.minScale != null ? Number(resolved.editor.minScale) : 1,
      maxScale: Math.min(
        resolved.editor.maxScale != null ? Number(resolved.editor.maxScale) : 3.5,
        1.85
      )
    };
  };

  const getGalleryImageSrc = () => {
    const scope = getScopedRoot();
    const activeImg = scope.querySelector(
      'media-gallery li.product__media-item.is-active:not([data-bd-design-preview-slide="1"]) img:not(.bd-design-preview-base):not(.bd-design-preview-overlay)'
    );
    if (activeImg && activeImg.currentSrc) return normalizeSrc(activeImg.currentSrc);
    if (activeImg && activeImg.src) return normalizeSrc(activeImg.src);

    const firstImg = scope.querySelector(
      'media-gallery li.product__media-item:not([data-bd-design-preview-slide="1"]) img:not(.bd-design-preview-base):not(.bd-design-preview-overlay)'
    );
    if (firstImg && firstImg.currentSrc) return normalizeSrc(firstImg.currentSrc);
    if (firstImg && firstImg.src) return normalizeSrc(firstImg.src);
    return "";
  };

  const getVariantFeaturedMediaSrc = (variant) => {
    if (!variant) return "";
    const directSrc = normalizeSrc(
      variant.featured_media?.preview_image?.src ||
      variant.featured_media?.src ||
      variant.featured_image?.src
    );
    return directSrc;
  };

  const getVariantMediaSrcById = (variantId) => {
    if (!variantId) return "";
    return normalizeSrc(variantMediaMap[String(variantId)] || "");
  };

  const ensureHeroPreviewSlide = () => {
    const slide =
      document.querySelector('[data-bd-design-preview-slide="1"]') ||
      root.closest(".shopify-section")?.querySelector('[data-bd-design-preview-slide="1"]');
    if (!slide) return null;

    const stageEl = slide.querySelector(".bd-design-preview-stage");
    const base = slide.querySelector("img[data-bd-design-preview-base]");
    const overlay = slide.querySelector("img[data-bd-design-preview-overlay]");
    if (!stageEl || !base || !overlay) return null;

    overlay.style.opacity = "0";

    if (!heroPreviewMask) {
      heroPreviewMask = stageEl.querySelector("[data-cf-circle-hero-mask]");
    }

    if (!heroPreviewMask) {
      heroPreviewMask = document.createElement("div");
      heroPreviewMask.setAttribute("data-cf-circle-hero-mask", "");
      heroPreviewMask.style.position = "absolute";
      heroPreviewMask.style.borderRadius = "50%";
      heroPreviewMask.style.pointerEvents = "none";
      heroPreviewMask.style.background = "#ffffff";
      heroPreviewMask.style.boxShadow = "none";
      heroPreviewMask.style.zIndex = "1";
      stageEl.appendChild(heroPreviewMask);
    }

    if (!heroPreviewWrap) {
      heroPreviewWrap = stageEl.querySelector("[data-cf-circle-hero-wrap]");
      heroPreviewImg = stageEl.querySelector("[data-cf-circle-hero-img]");
    }

    if (!heroPreviewWrap) {
      heroPreviewWrap = document.createElement("div");
      heroPreviewWrap.setAttribute("data-cf-circle-hero-wrap", "");
      heroPreviewWrap.style.position = "absolute";
      heroPreviewWrap.style.borderRadius = "50%";
      heroPreviewWrap.style.overflow = "hidden";
      heroPreviewWrap.style.pointerEvents = "none";
      heroPreviewWrap.style.boxShadow = "0 0 0 1px rgba(24,24,24,0.06), inset 0 0 0 1px rgba(255,255,255,0.14)";
      heroPreviewWrap.style.background = "rgba(241,239,233,0.5)";
      heroPreviewWrap.style.zIndex = "2";

      heroPreviewImg = document.createElement("img");
      heroPreviewImg.setAttribute("data-cf-circle-hero-img", "");
      heroPreviewImg.alt = "";
      heroPreviewImg.width = 1200;
      heroPreviewImg.height = 1200;
      heroPreviewImg.loading = "lazy";
      heroPreviewImg.style.position = "absolute";
      heroPreviewImg.style.top = "0";
      heroPreviewImg.style.left = "0";
      heroPreviewImg.style.maxWidth = "none";
      heroPreviewImg.style.maxHeight = "none";
      heroPreviewImg.style.pointerEvents = "none";
      heroPreviewImg.style.userSelect = "none";
      heroPreviewImg.style.webkitUserDrag = "none";

      heroPreviewWrap.appendChild(heroPreviewImg);
      stageEl.appendChild(heroPreviewWrap);
    }

    return { slide, stage: stageEl, base, overlay, mask: heroPreviewMask, wrap: heroPreviewWrap, img: heroPreviewImg };
  };

  const activateHeroPreviewSlide = () => {
    const heroPack = ensureHeroPreviewSlide();
    if (!heroPack) return;
    const previewMediaId = heroPack.slide.getAttribute("data-media-id");
    if (!previewMediaId) return;
    if (typeof window.bdGalleryActivateMedia === "function") {
      try {
        window.bdGalleryActivateMedia(previewMediaId);
      } catch (e) {}
    }
  };

  const hideHeroPreviewSlide = () => {
    const heroPack = ensureHeroPreviewSlide();
    if (!heroPack) return;
    heroPack.slide.hidden = true;
    heroPack.mask.hidden = true;
    heroPack.wrap.hidden = true;
  };

  const computeContainedBounds = (containerWidth, containerHeight) => {
    const naturalWidth = state.mockup.width || 1;
    const naturalHeight = state.mockup.height || 1;
    const imageAspect = naturalWidth / naturalHeight;
    const stageAspect = containerWidth / Math.max(containerHeight, 1);
    let drawWidth = containerWidth;
    let drawHeight = containerHeight;
    let drawX = 0;
    let drawY = 0;

    if (imageAspect > stageAspect) {
      drawWidth = containerWidth;
      drawHeight = containerWidth / imageAspect;
      drawY = (containerHeight - drawHeight) / 2;
    } else {
      drawHeight = containerHeight;
      drawWidth = containerHeight * imageAspect;
      drawX = (containerWidth - drawWidth) / 2;
    }

    return {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight
    };
  };

  const computePreviewBounds = () => (
    computeContainedBounds(previewStage.clientWidth, previewStage.clientHeight)
  );

  const computeCircleRect = (bounds, frameConfig) => {
    const radius = Math.min(bounds.width, bounds.height) * frameConfig.radiusPct;
    const cx = bounds.x + bounds.width * frameConfig.cxPct;
    const cy = bounds.y + bounds.height * frameConfig.cyPct;
    return {
      x: cx - radius,
      y: cy - radius,
      diameter: radius * 2,
      radius
    };
  };

  const computeEditorFrameRect = () => {
    const size = Math.min(stage.clientWidth, stage.clientHeight);
    const bounds = {
      x: (stage.clientWidth - size) / 2,
      y: (stage.clientHeight - size) / 2,
      width: size,
      height: size
    };
    const slider = getFrameSliderConfig();
    const currentFrame = getCurrentFrameConfig();
    const maxRadiusPct = slider.enabled ? slider.maxRadiusPct : currentFrame.radiusPct;
    const ratio = maxRadiusPct > 0 ? clamp(currentFrame.radiusPct / maxRadiusPct, 0.35, 1) : 1;
    return computeCircleRect(bounds, {
      ...editorFrameConfig,
      radiusPct: round(editorFrameConfig.radiusPct * ratio)
    });
  };

  const computePreviewFrameRect = () => {
    return computeCircleRect(computePreviewBounds(), getCurrentFrameConfig());
  };

  const computePreviewMaskRect = () => {
    const resolved = getResolvedConfig();
    const baseFrame = {
      cxPct: resolved.frame.cxPct != null ? Number(resolved.frame.cxPct) : 0.5,
      cyPct: resolved.frame.cyPct != null ? Number(resolved.frame.cyPct) : 0.5,
      radiusPct: resolved.frame.radiusPct != null ? Number(resolved.frame.radiusPct) : 0.22
    };
    return computeCircleRect(computePreviewBounds(), baseFrame);
  };

  const getCoverDimensions = (diameter, aspect, scale) => {
    if (aspect >= 1) {
      const height = diameter * scale;
      return { width: height * aspect, height };
    }
    const width = diameter * scale;
    return { width, height: width / aspect };
  };

  const getDefaultPlacement = () => ({
    scale: 1,
    offsetXPct: 0,
    offsetYPct: 0
  });

  const clampPlacement = (placement) => {
    const frame = computeEditorFrameRect();
    const editor = getEditorConfig();
    const aspect = state.design.width / Math.max(state.design.height, 1);
    const safeScale = clamp(placement.scale, editor.minScale, editor.maxScale);
    const size = getCoverDimensions(frame.diameter, aspect, safeScale);
    const maxOffsetXPct = Math.max(0, (size.width - frame.diameter) / (2 * frame.diameter));
    const maxOffsetYPct = Math.max(0, (size.height - frame.diameter) / (2 * frame.diameter));

    return {
      scale: safeScale,
      offsetXPct: clamp(placement.offsetXPct, -maxOffsetXPct, maxOffsetXPct),
      offsetYPct: clamp(placement.offsetYPct, -maxOffsetYPct, maxOffsetYPct)
    };
  };

  const syncHiddenState = () => {
    const frameInput = ensureHiddenInput("cf_circle_frame_metadata", "properties[_Circle Frame Metadata]");
    const cropInput = ensureHiddenInput("cf_circle_crop_metadata", "properties[_Circle Crop Metadata]");
    if (frameInput) {
      frameInput.value = JSON.stringify({
        variantId: currentVariantId || "",
        frame: getCurrentFrameConfig(),
        mockupSrc: state.mockup.src || ""
      });
    }
    if (cropInput) {
      cropInput.value = JSON.stringify({
        placement: state.placement || getDefaultPlacement(),
        designUrl: designUrlInput ? String(designUrlInput.value || "").trim() : "",
        sourceAspect:
          state.design.width && state.design.height
            ? round(state.design.width / state.design.height)
            : 1
      });
    }
    scheduleDraftPersist();
  };

  const getProofCloudConfig = () => {
    const cloud = uploader ? String(uploader.dataset.cloud || "").trim() : "";
    const preset = uploader ? String(uploader.dataset.preset || "").trim() : "";
    const folderBase = uploader ? String(uploader.dataset.folder || "").trim() : "";
    const folder = folderBase ? `${folderBase.replace(/\/+$/, "")}/proofs` : "proofs";
    return { cloud, preset, folder };
  };

  const canvasToBlob = (canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Circle proof export failed"));
        },
        "image/png",
        0.92
      );
    });

  const uploadProofBlobToCloudinary = ({ blob }) => {
    const { cloud, preset, folder } = getProofCloudConfig();
    if (!blob) return Promise.reject(new Error("Missing proof upload blob"));
    if (typeof window.bdPatchUploadProviderConfig === "function") {
      window.bdPatchUploadProviderConfig({
        providers: {
          cloudinary: {
            cloudName: cloud,
            uploadPreset: preset,
            proofFolder: folder || "proofs"
          }
        }
      });
    }
    if (typeof window.bdUploadAsset !== "function") {
      return Promise.reject(new Error("Upload provider is not initialized."));
    }
    return window.bdUploadAsset(blob, {
      kind: "proof",
      filename: `circle-proof-${Date.now()}.png`,
      folder
    }).then((result) =>
      String((result && result.secureUrl) || (result && result.url) || "").trim()
    );
  };

  const loadProofImage = (src) =>
    new Promise((resolve, reject) => {
      const nextSrc = normalizeSrc(src);
      if (!nextSrc) {
        reject(new Error("Missing proof image source"));
        return;
      }
      const img = new Image();
      if (/^https?:/i.test(nextSrc) || nextSrc.startsWith("//")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load proof image: ${nextSrc}`));
      img.src = nextSrc;
    });

  const getProofStateKey = () => {
    if (!state.design.src || !state.mockup.src || !state.placement) return "";
    return JSON.stringify({
      variantId: currentVariantId || "",
      mockupSrc: state.mockup.src,
        designSrc: designUrlInput ? String(designUrlInput.value || "").trim() : state.design.src,
      frame: getCurrentFrameConfig(),
      placement: state.placement
    });
  };

  const renderProofBlob = async () => {
    if (!state.design.src || !state.mockup.src || !state.placement) {
      throw new Error("Circle proof source is incomplete");
    }

    const [mockupProofImg, designProofImg] = await Promise.all([
      loadProofImage(state.mockup.src),
      loadProofImage(state.design.src)
    ]);

    const maxWidth = 1600;
    const baseWidth = Math.max(mockupProofImg.naturalWidth || state.mockup.width || 1, 1);
    const baseHeight = Math.max(mockupProofImg.naturalHeight || state.mockup.height || 1, 1);
    const scale = Math.min(1, maxWidth / baseWidth);
    const width = Math.max(1, Math.round(baseWidth * scale));
    const height = Math.max(1, Math.round(baseHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Missing circle proof canvas context");

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(mockupProofImg, 0, 0, width, height);

    const bounds = computeContainedBounds(width, height);
    const resolved = getResolvedConfig();
    const maskFrame = computeCircleRect(bounds, {
      cxPct: resolved.frame.cxPct != null ? Number(resolved.frame.cxPct) : 0.5,
      cyPct: resolved.frame.cyPct != null ? Number(resolved.frame.cyPct) : 0.5,
      radiusPct: resolved.frame.radiusPct != null ? Number(resolved.frame.radiusPct) : 0.22
    });
    const liveFrame = computeCircleRect(bounds, getCurrentFrameConfig());

    ctx.save();
    ctx.beginPath();
    ctx.arc(maskFrame.x + maskFrame.radius, maskFrame.y + maskFrame.radius, maskFrame.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    const aspect = state.design.width / Math.max(state.design.height, 1);
    const size = getCoverDimensions(liveFrame.diameter, aspect, state.placement.scale);
    const left = liveFrame.x + (liveFrame.diameter - size.width) / 2 + state.placement.offsetXPct * liveFrame.diameter;
    const top = liveFrame.y + (liveFrame.diameter - size.height) / 2 + state.placement.offsetYPct * liveFrame.diameter;

    ctx.save();
    ctx.beginPath();
    ctx.arc(liveFrame.x + liveFrame.radius, liveFrame.y + liveFrame.radius, liveFrame.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(designProofImg, left, top, size.width, size.height);
    ctx.restore();

    return canvasToBlob(canvas);
  };

  const syncProofNow = async ({ force = false } = {}) => {
    if (!state.design.src) {
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      setProofNotice("");
      return "";
    }

    const proofKey = getProofStateKey();
    if (!proofKey) return "";
    if (!force && proofLastKey === proofKey && proofLastUrl) {
      setProofUrl(proofLastUrl);
      setProofNotice("");
      return proofLastUrl;
    }
    if (proofInFlightPromise) return proofInFlightPromise;

    proofInFlightPromise = (async () => {
      const blob = await renderProofBlob();
      const url = await uploadProofBlobToCloudinary({ blob });
      proofLastKey = proofKey;
      proofLastUrl = String(url || "").trim();
      setProofUrl(proofLastUrl);
      setProofNotice("");
      return proofLastUrl;
    })().catch((err) => {
      console.error("Circle proof sync failed", err);
      setProofNotice(PROOF_FALLBACK_TEXT);
      return "";
    }).finally(() => {
      proofInFlightPromise = null;
      requestRender();
    });

    return proofInFlightPromise;
  };

  const scheduleProofSync = () => {
    if (proofSyncTimer) window.clearTimeout(proofSyncTimer);
    if (!state.design.src) {
      setProofUrl("");
      setProofNotice("");
      return;
    }
    proofSyncTimer = window.setTimeout(() => {
      proofSyncTimer = null;
      syncProofNow();
    }, 250);
  };

  const waitForCurrentProof = (timeoutMs) =>
    new Promise((resolve) => {
      if (!proofInFlightPromise) {
        resolve("");
        return;
      }
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve("");
      }, timeoutMs);
      proofInFlightPromise
        .then((url) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(String(url || "").trim());
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve("");
        });
    });

  const waitForDesignUrl = (timeoutMs) =>
    new Promise((resolve) => {
      const readValue = () => (designUrlInput ? String(designUrlInput.value || "").trim() : "");
      const initial = readValue();
      if (initial) {
        resolve(initial);
        return;
      }

      const start = Date.now();
      const tick = () => {
        const next = readValue();
        if (next) {
          resolve(next);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve("");
          return;
        }
        window.setTimeout(tick, 75);
      };
      tick();
    });

  const updateStatus = () => {
    if (!statusEl || !metaEl) return;
    const hiddenStatus = statusSource ? String(statusSource.textContent || "").trim() : "";
    if (!state.design.src) {
      statusEl.textContent = hiddenStatus || (uploadMode === "svg-only" ? "Upload your SVG design to get started." : "Upload your design to get started.");
      metaEl.textContent = "";
      syncThumbnailLockState();
      return;
    }

    const proofReady = !!proofLastUrl;
    const proofNotice = getProofNotice();
    statusEl.textContent = isLargeUploadMessage(hiddenStatus)
      ? hiddenStatus
      : proofReady
        ? "If the upload and preview look correct, add to cart."
        : proofNotice || PROOF_NOTICE_TEXT;
    metaEl.textContent = "";
    syncThumbnailLockState();
  };

  const updatePlaceholderCopy = (frame) => {
    const diameter = frame && frame.diameter ? frame.diameter : 0;
    if (diameter <= 150) {
      placeholderEl.dataset.size = "small";
      placeholderEyebrowEl.textContent = "Photo area";
      placeholderTitleEl.textContent = "Uploaded photo will appear in this area";
      placeholderHintEl.textContent = uploadMode === "svg-only"
        ? "Upload your SVG design to preview it within the circle."
        : "Upload your image to preview it within the circle.";
      return;
    }
    if (diameter <= 220) {
      placeholderEl.dataset.size = "medium";
      placeholderEyebrowEl.textContent = "Circular photo area";
      placeholderTitleEl.textContent = "Uploaded photo will appear in this area";
      placeholderHintEl.textContent = uploadMode === "svg-only"
        ? "Upload your SVG design to preview it within the circle."
        : "Upload your image to preview it within the circle.";
      return;
    }
    placeholderEl.dataset.size = "large";
    placeholderEyebrowEl.textContent = "Circular photo area";
    placeholderTitleEl.textContent = "Uploaded photo will appear in this area";
    placeholderHintEl.textContent = "Upload your image to preview it within the circle.";
  };

  const requestRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    window.requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  };

  const render = () => {
    if (!state.mockup.width || !state.mockup.height) return;
    const heroPack = ensureHeroPreviewSlide();
    const slider = getFrameSliderConfig();
    const currentFrame = getCurrentFrameConfig();

    const editorFrame = computeEditorFrameRect();
    const previewFrame = computePreviewFrameRect();
    const previewMaskFrame = computePreviewMaskRect();

    frameEl.style.left = `${editorFrame.x}px`;
    frameEl.style.top = `${editorFrame.y}px`;
    frameEl.style.width = `${editorFrame.diameter}px`;
    frameEl.style.height = `${editorFrame.diameter}px`;
    frameLabelEl.style.left = `${editorFrame.x + editorFrame.diameter / 2}px`;
    frameLabelEl.style.top = `${editorFrame.y}px`;
    placeholderEl.style.left = `${editorFrame.x}px`;
    placeholderEl.style.top = `${editorFrame.y}px`;
    placeholderEl.style.width = `${editorFrame.diameter}px`;
    placeholderEl.style.height = `${editorFrame.diameter}px`;
    previewFrameEl.style.left = `${previewFrame.x}px`;
    previewFrameEl.style.top = `${previewFrame.y}px`;
    previewFrameEl.style.width = `${previewFrame.diameter}px`;
    previewFrameEl.style.height = `${previewFrame.diameter}px`;
    if (frameSliderRow && frameSliderInput) {
      frameSliderRow.hidden = !slider.enabled;
      if (slider.enabled) {
        frameSliderInput.min = String(slider.minRadiusPct);
        frameSliderInput.max = String(slider.maxRadiusPct);
        frameSliderInput.step = String(slider.stepPct);
        frameSliderInput.value = String(currentFrame.radiusPct);
      }
    }
    updatePlaceholderCopy(editorFrame);

    if (!state.design.src || !state.design.width || !state.design.height) {
      placeholderEl.hidden = false;
      designWrap.hidden = true;
      previewMaskEl.hidden = true;
      previewFrameEl.hidden = true;
      previewDesignWrap.hidden = true;
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      setProofNotice("");
      if (heroPack) {
        heroPack.slide.hidden = true;
        heroPack.mask.hidden = true;
        heroPack.wrap.hidden = true;
      }
      resizeHandle.hidden = true;
      resetBtn.hidden = true;
      if (loadOriginalBtn) loadOriginalBtn.hidden = true;
      updateStatus();
      syncHiddenState();
      return;
    }

    if (!state.placement) {
      state.defaultPlacement = getDefaultPlacement();
      state.placement = state.defaultPlacement;
    }

    placeholderEl.hidden = true;
    state.placement = clampPlacement(state.placement);
    const aspect = state.design.width / Math.max(state.design.height, 1);
    const editorSize = getCoverDimensions(editorFrame.diameter, aspect, state.placement.scale);
    const editorLeft = (editorFrame.diameter - editorSize.width) / 2 + state.placement.offsetXPct * editorFrame.diameter;
    const editorTop = (editorFrame.diameter - editorSize.height) / 2 + state.placement.offsetYPct * editorFrame.diameter;
    const previewSize = getCoverDimensions(previewFrame.diameter, aspect, state.placement.scale);
    const previewLeft = (previewFrame.diameter - previewSize.width) / 2 + state.placement.offsetXPct * previewFrame.diameter;
    const previewTop = (previewFrame.diameter - previewSize.height) / 2 + state.placement.offsetYPct * previewFrame.diameter;

    designWrap.hidden = false;
    designWrap.style.left = `${editorFrame.x}px`;
    designWrap.style.top = `${editorFrame.y}px`;
    designWrap.style.width = `${editorFrame.diameter}px`;
    designWrap.style.height = `${editorFrame.diameter}px`;
    designEditImg.style.width = `${editorSize.width}px`;
    designEditImg.style.height = `${editorSize.height}px`;
    designEditImg.style.left = `${editorLeft}px`;
    designEditImg.style.top = `${editorTop}px`;

    previewMaskEl.hidden = false;
    previewMaskEl.style.display = "block";
    previewMaskEl.style.opacity = "1";
    previewMaskEl.style.zIndex = "1";
    previewMaskEl.style.left = `${previewMaskFrame.x}px`;
    previewMaskEl.style.top = `${previewMaskFrame.y}px`;
    previewMaskEl.style.width = `${previewMaskFrame.diameter}px`;
    previewMaskEl.style.height = `${previewMaskFrame.diameter}px`;
    previewMaskEl.style.background = "#ffffff";
    previewMaskEl.style.boxShadow = "none";

    previewFrameEl.hidden = true;
    previewFrameEl.style.display = "none";
    previewFrameEl.style.opacity = "0";
    previewFrameEl.style.zIndex = "2";
    previewDesignWrap.hidden = false;
    previewDesignWrap.style.left = `${previewFrame.x}px`;
    previewDesignWrap.style.top = `${previewFrame.y}px`;
    previewDesignWrap.style.width = `${previewFrame.diameter}px`;
    previewDesignWrap.style.height = `${previewFrame.diameter}px`;
    previewDesignImg.style.width = `${previewSize.width}px`;
    previewDesignImg.style.height = `${previewSize.height}px`;
    previewDesignImg.style.left = `${previewLeft}px`;
    previewDesignImg.style.top = `${previewTop}px`;

    if (heroPack) {
      const baseSrc = state.mockup.src || "";
      if (baseSrc && heroPack.base.src !== baseSrc) heroPack.base.src = baseSrc;

      if (state.design.src && heroPack.img.src !== state.design.src) {
        heroPack.img.src = state.design.src;
      }

      const heroBounds = computeContainedBounds(heroPack.stage.clientWidth, heroPack.stage.clientHeight);
      const heroFrame = computeCircleRect(heroBounds, currentFrame);
      const resolved = getResolvedConfig();
      const heroMaskFrame = computeCircleRect(heroBounds, {
        cxPct: resolved.frame.cxPct != null ? Number(resolved.frame.cxPct) : 0.5,
        cyPct: resolved.frame.cyPct != null ? Number(resolved.frame.cyPct) : 0.5,
        radiusPct: resolved.frame.radiusPct != null ? Number(resolved.frame.radiusPct) : 0.22
      });
      const heroSize = getCoverDimensions(heroFrame.diameter, aspect, state.placement.scale);
      const heroLeft = (heroFrame.diameter - heroSize.width) / 2 + state.placement.offsetXPct * heroFrame.diameter;
      const heroTop = (heroFrame.diameter - heroSize.height) / 2 + state.placement.offsetYPct * heroFrame.diameter;

      heroPack.slide.hidden = false;
      heroPack.mask.hidden = false;
      heroPack.mask.style.left = `${heroMaskFrame.x}px`;
      heroPack.mask.style.top = `${heroMaskFrame.y}px`;
      heroPack.mask.style.width = `${heroMaskFrame.diameter}px`;
      heroPack.mask.style.height = `${heroMaskFrame.diameter}px`;
      heroPack.wrap.hidden = false;
      heroPack.wrap.style.left = `${heroFrame.x}px`;
      heroPack.wrap.style.top = `${heroFrame.y}px`;
      heroPack.wrap.style.width = `${heroFrame.diameter}px`;
      heroPack.wrap.style.height = `${heroFrame.diameter}px`;
      heroPack.img.style.width = `${heroSize.width}px`;
      heroPack.img.style.height = `${heroSize.height}px`;
      heroPack.img.style.left = `${heroLeft}px`;
      heroPack.img.style.top = `${heroTop}px`;
    }

    resizeHandle.hidden = false;
    resizeHandle.style.left = `${editorFrame.x + editorFrame.diameter - resizeHandle.offsetWidth * 0.7}px`;
    resizeHandle.style.top = `${editorFrame.y + editorFrame.diameter - resizeHandle.offsetHeight * 0.7}px`;
    resetBtn.hidden = false;
    if (loadOriginalBtn) loadOriginalBtn.hidden = false;

    updateStatus();
    syncHiddenState();
    scheduleProofSync();
  };

  const setBodyOpen = () => {
    if (body && body.hidden) body.hidden = false;
    root.classList.add("is-design-open");
  };

  const setMockupSrc = (src) => {
    const nextSrc = normalizeSrc(src) || normalizeSrc(defaultMockupSrc);
    if (!nextSrc) {
      render();
      return;
    }
    const isSameSrc = nextSrc === state.mockup.src;
    const isAlreadyLoaded =
      isSameSrc &&
      !!state.mockup.width &&
      !!state.mockup.height &&
      !!mockupImg.getAttribute("src");
    if (isAlreadyLoaded) {
      render();
      return;
    }
    state.mockup.src = nextSrc;
    mockupImg.onload = () => {
      state.mockup.width = mockupImg.naturalWidth || 0;
      state.mockup.height = mockupImg.naturalHeight || 0;
      if (state.mockup.width && state.mockup.height) {
        root.style.setProperty("--cf-circle-preview-aspect", `${state.mockup.width} / ${state.mockup.height}`);
      }
      render();
    };
    if (mockupImg.getAttribute("src") !== nextSrc) {
      mockupImg.src = nextSrc;
      return;
    }
    if (mockupImg.complete && mockupImg.naturalWidth) {
      mockupImg.onload();
    }
  };

  const setDesignSrc = (src, options) => {
    const nextSrc = normalizeSrc(src);
    if (!nextSrc) return;
    const preservePlacement = options && options.preservePlacement ? { ...options.preservePlacement } : null;
    const preserveFrameRadiusPct =
      options && options.preserveFrameRadiusPct != null ? Number(options.preserveFrameRadiusPct) : null;
    const restoreSnapshot =
      pendingRestoreSnapshot && pendingRestoreSnapshot.designUrl === nextSrc
        ? pendingRestoreSnapshot
        : null;
    state.design.src = nextSrc;
    designEditImg.onload = () => {
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      setProofNotice("");
      resetFrameRadiusSelection();
      state.design.width = designEditImg.naturalWidth || 0;
      state.design.height = designEditImg.naturalHeight || 0;
      state.defaultPlacement = getDefaultPlacement();
      state.placement =
        restoreSnapshot && restoreSnapshot.placement
          ? { ...restoreSnapshot.placement }
          : preservePlacement || state.defaultPlacement;
      if (restoreSnapshot && restoreSnapshot.frameRadiusPct != null) {
        frameRadiusPct = Number(restoreSnapshot.frameRadiusPct);
      } else if (preserveFrameRadiusPct != null) {
        frameRadiusPct = preserveFrameRadiusPct;
      }
      pendingRestoreSnapshot = null;
      setRestoreMode(false);
      restoreCompleted = true;
      setBodyOpen();
      rehydrateProofStateFromInputs();
      render();
      activateHeroPreviewSlide();
      window.requestAnimationFrame(() => render());
    };
    previewDesignImg.src = nextSrc;
    designEditImg.src = nextSrc;
  };

  const updateMockupFromCurrentState = (variant, options) => {
    const nextVariantId = readVariantId();
    currentVariantId = nextVariantId;

    return loadConfig(options && options.forceConfigReload).finally(() => {
      const variantIdSrc = getVariantMediaSrcById(currentVariantId);
      const variantSrc = getVariantFeaturedMediaSrc(variant);
      const gallerySrc = getGalleryImageSrc();
      const resolved = getResolvedConfig();
      const configMockup = normalizeSrc(resolved.mockup.src || resolved.mockup.mockupSrc);
      setMockupSrc(configMockup || variantSrc || variantIdSrc || gallerySrc || defaultMockupSrc);
      const slider = getFrameSliderConfig();
      if (!slider.enabled) {
        frameRadiusPct = null;
      } else if (!restoreInProgress && (currentVariantId !== lastVariantId || frameRadiusPct == null)) {
        frameRadiusPct = slider.defaultRadiusPct;
      }
      lastVariantId = currentVariantId;
      render();
    });
  };

  const beginPointer = (event, mode) => {
    if (!state.design.src) return;
    const frame = computeEditorFrameRect();
    pointerMode = mode;
    activePointerId = event.pointerId;
    pointerStart = { x: event.clientX, y: event.clientY };
    startPlacement = Object.assign(
      {},
      state.placement || getDefaultPlacement()
    );
    startPointerRadius = Math.hypot(
      event.clientX - (frame.x + frame.diameter / 2),
      event.clientY - (frame.y + frame.diameter / 2)
    );
    designWrap.classList.toggle("is-dragging", mode === "drag");
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    if (!pointerMode || activePointerId !== event.pointerId || !pointerStart || !startPlacement) return;
    const frame = computeEditorFrameRect();
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;

    if (pointerMode === "drag") {
      state.placement = clampPlacement({
        scale: startPlacement.scale,
        offsetXPct: startPlacement.offsetXPct + dx / Math.max(frame.diameter, 1),
        offsetYPct: startPlacement.offsetYPct + dy / Math.max(frame.diameter, 1)
      });
    } else if (pointerMode === "resize") {
      const currentPointerRadius = Math.hypot(
        event.clientX - (frame.x + frame.diameter / 2),
        event.clientY - (frame.y + frame.diameter / 2)
      );
      const radiusDelta = currentPointerRadius - startPointerRadius;
      const scale = startPlacement.scale + radiusDelta / Math.max(frame.diameter * 0.9, 1);
      state.placement = clampPlacement({
        scale,
        offsetXPct: startPlacement.offsetXPct,
        offsetYPct: startPlacement.offsetYPct
      });
    }

    requestRender();
  };

  const endPointer = (event) => {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    pointerMode = "";
    activePointerId = null;
    pointerStart = null;
    startPlacement = null;
    startPointerRadius = 0;
    designWrap.classList.remove("is-dragging");
  };

  const syncFromLocalUpload = () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    if (!canUseLocalUploadFile(file)) return;
    if (designUrlInput) {
      designUrlInput.value = "";
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    setDesignSrc(objectUrl);
  };

  const syncFromUploaderPreview = (options) => {
    const useDraftSnapshot = !!(options && options.useDraftSnapshot);
    const snapshot = useDraftSnapshot ? readDraftSessionSnapshot() : null;
    const nextSrc = normalizeSrc(
      (previewImg && (previewImg.currentSrc || previewImg.src)) ||
      (designUrlInput && designUrlInput.value) ||
      (snapshot && snapshot.designUrl) ||
      ""
    );
    if (!nextSrc) return;
    if (snapshot && snapshot.designUrl === nextSrc) {
      pendingRestoreSnapshot = snapshot;
      setRestoreMode(true);
    }
    if (designUrlInput && !String(designUrlInput.value || "").trim()) {
      designUrlInput.value = nextSrc;
    }
    if (state.design.src === nextSrc) {
      if (pendingRestoreSnapshot && pendingRestoreSnapshot.designUrl === nextSrc) {
        if (pendingRestoreSnapshot.placement) {
          state.placement = { ...pendingRestoreSnapshot.placement };
        }
        if (pendingRestoreSnapshot.frameRadiusPct != null) {
          frameRadiusPct = Number(pendingRestoreSnapshot.frameRadiusPct);
        }
        pendingRestoreSnapshot = null;
      }
      setRestoreMode(false);
      restoreCompleted = true;
      setBodyOpen();
      rehydrateProofStateFromInputs();
      activateHeroPreviewSlide();
      requestRender();
      return;
    }
    setBodyOpen();
    const shouldPromoteLocalPreview =
      state.design.src &&
      /^blob:/i.test(String(state.design.src || "").trim()) &&
      !restoreInProgress;
    setDesignSrc(nextSrc, shouldPromoteLocalPreview ? {
      preservePlacement: state.placement,
      preserveFrameRadiusPct: frameRadiusPct
    } : null);
  };

  const handleVariantEvent = (event) => {
    const variant =
      (event && event.detail && event.detail.data && event.detail.data.variant) ||
      (event && event.data && event.data.variant) ||
      null;
    scheduleVariantRefresh(variant, { forceConfigReload: true });
  };

  startBtn?.addEventListener("click", () => {
    setBodyOpen();
    updateMockupFromCurrentState(null);
  });

  uploadBtn?.addEventListener("click", () => {
    uploadInput.click();
  });

  resetBtn?.addEventListener("click", () => {
    state.placement = getDefaultPlacement();
    resetFrameRadiusSelection();
    requestRender();
  });
  loadOriginalBtn?.addEventListener("click", async () => {
    const file = await readMasterOriginalFile();
    if (!file) {
      if (statusEl) {
        statusEl.textContent = "Original image is not available on this device anymore. Please upload it again to restore it.";
      }
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    uploadInput.files = dt.files;
    uploadInput.__bdPreserveMasterOriginal = 1;
    uploadInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  frameSliderInput?.addEventListener("input", () => {
    frameRadiusPct = Number(frameSliderInput.value || 0);
    requestRender();
  });
  frameDecreaseBtn?.addEventListener("click", () => {
    const slider = getFrameSliderConfig();
    if (!slider.enabled) return;
    const next = clamp(
      (frameRadiusPct != null ? frameRadiusPct : slider.defaultRadiusPct) - slider.stepPct,
      slider.minRadiusPct,
      slider.maxRadiusPct
    );
    frameRadiusPct = next;
    requestRender();
  });
  frameIncreaseBtn?.addEventListener("click", () => {
    const slider = getFrameSliderConfig();
    if (!slider.enabled) return;
    const next = clamp(
      (frameRadiusPct != null ? frameRadiusPct : slider.defaultRadiusPct) + slider.stepPct,
      slider.minRadiusPct,
      slider.maxRadiusPct
    );
    frameRadiusPct = next;
    requestRender();
  });

  uploadInput.addEventListener("change", syncFromLocalUpload);
  uploadInput.addEventListener("input", syncFromLocalUpload);

  if (previewImg) {
    previewImg.addEventListener("load", () => {
      syncFromUploaderPreview();
    });
    previewImg.addEventListener("error", syncFromUploaderPreview);
  }
  if (designUrlInput) {
    designUrlInput.addEventListener("change", syncFromUploaderPreview);
    designUrlInput.addEventListener("input", syncFromUploaderPreview);
  }
  if (previewWrap && typeof MutationObserver === "function") {
    const previewObserver = new MutationObserver(() => syncFromUploaderPreview());
    previewObserver.observe(previewWrap, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }
  if (statusSource && typeof MutationObserver === "function") {
    const statusObserver = new MutationObserver(() => requestRender());
    statusObserver.observe(statusSource, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-type"]
    });
  }

  stage.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-cf-circle-handle]")) return;
    beginPointer(event, "drag");
  });
  resizeHandle.addEventListener("pointerdown", (event) => beginPointer(event, "resize"));
  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  const mediaGallery = getMediaGallery();
  mediaGallery?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!state.design.src) return;

    const thumbButton = target.closest("button.thumbnail");
    if (!thumbButton) return;

    const thumbItem = thumbButton.closest("li[data-target]");
    const targetMediaId = String(
      thumbButton.getAttribute("data-target") ||
      (thumbItem ? thumbItem.getAttribute("data-target") : "") ||
      ""
    ).trim();
    if (!targetMediaId) return;

    const heroPack = ensureHeroPreviewSlide();
    const previewMediaId = heroPack ? String(heroPack.slide.getAttribute("data-media-id") || "").trim() : "";
    if (!previewMediaId || targetMediaId === previewMediaId) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    activateHeroPreviewSlide();
    if (statusEl) {
      statusEl.textContent = "Design preview stays on the active mockup while editing.";
    }
  }, true);
  mediaGallery?.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!state.design.src) return;

    const thumbButton = target.closest("button.thumbnail");
    if (!thumbButton) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    activateHeroPreviewSlide();
    if (statusEl) {
      statusEl.textContent = "Design preview stays on the active mockup while editing.";
    }
  }, true);

  ["variant:change", "variantChange", "product:variant-change", "product-info:loaded"].forEach((eventName) => {
    document.addEventListener(eventName, handleVariantEvent);
  });
  if (productInfo) {
    productInfo.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
      if (target.name === "id") {
        scheduleVariantRefresh(null, { forceConfigReload: true });
        return;
      }
      if (!target.closest("variant-selects")) return;
      scheduleVariantRefresh(null, { forceConfigReload: true });
    }, true);
    productInfo.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("variant-selects label, variant-selects button, variant-selects input, variant-selects option")) return;
      scheduleVariantRefresh(null, { forceConfigReload: true });
    }, true);

    productInfo.addEventListener("submit", async (event) => {
      const activeForm = getProductForm();
      if (!activeForm) return;
      if (!(event.target instanceof HTMLFormElement) || event.target !== activeForm) return;
      if (allowNextSubmit) {
        allowNextSubmit = false;
        return;
      }
      if (!state.design.src) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const currentDesignUrl = designUrlInput ? String(designUrlInput.value || "").trim() : "";
      if (!currentDesignUrl) {
        await waitForDesignUrl(2000);
      }

      if (proofInFlightPromise) {
        await waitForCurrentProof(PROOF_WAIT_MS);
      } else {
        await syncProofNow({ force: true });
      }

      if (statusEl) {
        statusEl.textContent = proofLastUrl
          ? "Preview ready. Adding to cart..."
          : getProofNotice() || PROOF_FALLBACK_TEXT;
      }

      allowNextSubmit = true;
      resumeProductSubmit();
    }, true);
  }

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => requestRender());
    observer.observe(stage);
    observer.observe(previewStage);
  } else {
    window.addEventListener("resize", requestRender);
  }

  loadConfig().finally(() => {
    currentVariantId = readVariantId();
    lastVariantId = currentVariantId;
    resetFrameRadiusSelection();
    updateMockupFromCurrentState(null);
    if (shouldAttemptDraftRestore()) {
      syncFromUploaderPreview({ useDraftSnapshot: true });
    }
    syncHiddenState();
    syncThumbnailLockState();
  });

  window.addEventListener("pageshow", (event) => {
    closeTransientCartUi();
    currentVariantId = readVariantId();
    lastVariantId = currentVariantId;
    setRestoreMode(shouldAttemptDraftRestore({ persisted: !!(event && event.persisted) }));
    if (restoreInProgress) {
      hideHeroPreviewSlide();
    }
    updateMockupFromCurrentState(null, { forceConfigReload: true });
    if (!restoreInProgress) {
      syncHiddenState();
      syncThumbnailLockState();
      return;
    }
    const runRestorePass = () => {
      if (restoreCompleted) return;
      syncFromUploaderPreview({ useDraftSnapshot: true });
      syncHiddenState();
      if (!restoreInProgress && ((designUrlInput && String(designUrlInput.value || "").trim()) || state.design.src)) {
        setBodyOpen();
        requestRender();
      }
    };
    window.setTimeout(runRestorePass, 0);
    window.setTimeout(runRestorePass, 160);
  });

  window.addEventListener("pagehide", () => {
    setRestoreMode(false);
    persistDraftSessionNow();
  });
})();
