/* assets/cf-tumbler-preview.js */
(function () {
  const root = document.getElementById("cf-tumbler-preview-container");
  if (!root) return;

  const startBtn = root.querySelector("[data-cf-start-btn]");
  const body = root.querySelector(".cf-tumbler-designer-body");
  const uploadBtn = root.querySelector("[data-cf-tumbler-upload-btn]");
  const resetBtn = root.querySelector("[data-cf-tumbler-reset-btn]");
  const stage = root.querySelector("[data-cf-tumbler-stage]");
  const editorCanvas = root.querySelector("[data-cf-tumbler-editor-canvas]");
  const designWrap = root.querySelector("[data-cf-tumbler-design-wrap]");
  const designEditImg = root.querySelector("[data-cf-tumbler-design-edit]");
  const resizeHandle = root.querySelector("[data-cf-tumbler-handle]");
  const compositeCanvas = root.querySelector("[data-cf-tumbler-composite-canvas]");
  const guideEls = Array.from(root.querySelectorAll("[data-cf-guide]"));
  const statusEl = root.querySelector("[data-cf-tumbler-status]");
  const metaEl = root.querySelector("[data-cf-tumbler-meta]");

  const uploader = document.querySelector("[data-cf-uploader]");
  const uploadInput = uploader ? uploader.querySelector('[data-upload-input="1"]') : null;
  const previewWrap = uploader ? uploader.querySelector('[data-preview-wrap="1"]') : null;
  const previewImg = uploader ? uploader.querySelector('[data-preview-img="1"]') : null;
  const statusSource = uploader ? uploader.querySelector('[data-status="1"]') : null;
  const metaSource = uploader ? uploader.querySelector('[data-meta="1"]') : null;
  const designUrlInput = uploader ? uploader.querySelector('[data-url="1"]') : null;
  const productForm = root.closest("product-info")
    ? root.closest("product-info").querySelector('form[data-type="add-to-cart-form"]')
    : document.querySelector('form[data-type="add-to-cart-form"]');
  const productHandle = root.dataset.productHandle || "";
  const configUrl = root.dataset.configUrl || "";

  if (!stage || !editorCanvas || !designWrap || !designEditImg || !compositeCanvas || !uploadInput) return;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const isMobileViewport = () => window.matchMedia && window.matchMedia("(max-width: 749px)").matches;
  const state = {
    src: "",
    width: 0,
    height: 0,
    aspect: 1,
    placement: null,
    initialPlacement: null
  };

  let config = null;
  let configPromise = null;
  let spec = null;
  let mockupImage = null;
  let renderTimer = null;
  let pointerMode = null;
  let activePointerId = null;
  let pointerStart = null;
  let startPlacement = null;
  let proofSyncTimer = null;
  let proofLastKey = "";
  let proofLastUrl = "";
  let proofInFlightPromise = null;
  let allowNextSubmit = false;
  let wrapCanvas = null;
  let wrapCtx = null;
  let finalizeTimer = null;
  const MOBILE_PROOF_WAIT_MS = 1200;
  const PROOF_NOTICE_TEXT = "Proof size is greater than 10MB. Our team will send you the proof before printing.";
  const UPLOAD_NOTICE_TEXT = "Your image is larger than 10MB, but no worries-you can still edit and preview your design. After placing your order, just email your image to info@sarvsartsandcrafts.com, and we'll handle the proof for you.";
  const BOTH_NOTICE_TEXT = "Uploaded file size and proof size are greater than 10MB. Please send your image by email at info@sarvsartsandcrafts.com, and our team will send you the proof before printing.";
  const getScopedProductRoot = () =>
    root.closest("product-info") ||
    root.closest(".shopify-section") ||
    document;

  const mountSharedUploadNotice = () => {
    const notice = getScopedProductRoot().querySelector("[data-cf-upload-notice]");
    if (!notice || !uploadBtn || !uploadBtn.parentNode) return;

    notice.style.marginTop = "0";
    notice.style.marginBottom = "0";
    if (notice.parentNode !== uploadBtn.parentNode || notice.nextElementSibling !== uploadBtn) {
      uploadBtn.insertAdjacentElement("beforebegin", notice);
    }
  };

  const resumeProductSubmit = () => {
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

  const getProofNotice = () => {
    if (!productForm) return "";
    const input = productForm.querySelector("#cf_tumbler_proof_notice");
    return input ? String(input.value || "").trim() : "";
  };


  const loadConfig = () => {
    if (configPromise) return configPromise;
    if (!configUrl || !productHandle || typeof fetch !== "function") {
      configPromise = Promise.resolve(null);
      return configPromise;
    }

    configPromise = fetch(configUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        config = json && json[productHandle] ? json[productHandle] : null;
        spec = buildSpec();
        return config;
      })
      .catch(() => null);

    return configPromise;
  };

  const loadMockup = () => {
    if (!config || !config.previewSpec || !config.previewSpec.mockup || !config.previewSpec.mockup.src) {
      return Promise.resolve(null);
    }
    if (mockupImage && mockupImage.complete) return Promise.resolve(mockupImage);

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        mockupImage = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = config.previewSpec.mockup.src;
    });
  };

  const buildSpec = () => {
    if (!config || !config.previewSpec || !config.previewSpec.zones) return null;
    const raw = config.previewSpec;
    const nativeWidth = raw.mockup.nativeWidth || 1;
    const nativeHeight = raw.mockup.nativeHeight || 1;
    const colors = {
      left: "rgba(239, 68, 68, 0.82)",
      center: "rgba(34, 197, 94, 0.82)",
      right: "rgba(59, 130, 246, 0.82)"
    };
    const order = ["left", "center", "right"];
    const nativeZones = {};
    order.forEach((key) => {
      const zone = raw.zones[key];
      if (!zone) return;
      nativeZones[key] = {
        key,
        x: (zone.xPct || 0) * nativeWidth,
        y: (zone.yPct || 0) * nativeHeight,
        width: (zone.widthPct || 0) * nativeWidth,
        height: (zone.heightPct || 0) * nativeHeight,
        centerX: (zone.centerXPct || 0) * nativeWidth,
        topOffset: (zone.topOffsetPct || 0) * nativeHeight,
        bottomCurveDepth: (zone.bottomCurveDepthPct || 0) * nativeHeight,
        visibleWidthRatio: zone.visibleWidthRatio || 1,
        verticalBias: zone.verticalBias || 0,
        editorLabel: zone.editorLabel || key
      };
    });

    return {
      raw,
      nativeWidth,
      nativeHeight,
      order,
      colors,
      nativeZones
    };
  };

  const stageRect = () => {
    const rect = stage.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const getWrapCanvasSize = () => {
    const width = config && config.wrap && config.wrap.canvasWidth ? config.wrap.canvasWidth : 2400;
    const height = config && config.wrap && config.wrap.canvasHeight ? config.wrap.canvasHeight : 2116;
    return { width, height };
  };

  const getWrapAspect = () => {
    const size = getWrapCanvasSize();
    return size.height ? size.width / size.height : 1.13;
  };

  const buildEditorZones = () => {
    if (!spec) return [];
    const zones = spec.order.map((key) => spec.nativeZones[key]).filter(Boolean);
    if (!zones.length) return [];
    const minX = Math.min.apply(null, zones.map((zone) => zone.x));
    const maxX = Math.max.apply(null, zones.map((zone) => zone.x + zone.width));
    const spanWidth = Math.max(1, maxX - minX);
    return zones.map((zone) => ({
      key: zone.key,
      label: zone.editorLabel,
      color: spec.colors[zone.key],
      left: zone.x / spec.nativeWidth,
      width: zone.width / spec.nativeWidth,
      center: zone.centerX / spec.nativeWidth,
      top: zone.y / spec.nativeHeight,
      height: zone.height / spec.nativeHeight,
      curve: Math.min(0.22, zone.bottomCurveDepth / Math.max(zone.height, 1)),
      guideLeft: (zone.x - minX) / spanWidth,
      guideWidth: zone.width / spanWidth
    }));
  };

  const getBottomPreviewOverlayZones = () => {
    if (!spec || !compositeCanvas) return [];
    const previewWidth = compositeCanvas.clientWidth || compositeCanvas.offsetWidth || 0;
    const previewHeight = compositeCanvas.clientHeight || compositeCanvas.offsetHeight || 0;
    if (!previewWidth || !previewHeight) return [];

    const sourceAspect = spec.nativeWidth / spec.nativeHeight;
    const canvasAspect = previewWidth / previewHeight;
    let drawWidth = previewWidth;
    let drawHeight = previewHeight;
    let drawX = 0;
    let drawY = 0;

    if (sourceAspect > canvasAspect) {
      drawHeight = previewWidth / sourceAspect;
      drawY = (previewHeight - drawHeight) / 2;
    } else {
      drawWidth = previewHeight * sourceAspect;
      drawX = (previewWidth - drawWidth) / 2;
    }

    const mockupBounds = {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight
    };

    return spec.order
      .map((key) => spec.nativeZones[key])
      .filter(Boolean)
      .map((zone) => scalePreviewZone(zone, mockupBounds));
  };

  const buildTopOverlayZones = (rect) => {
    if (!rect || !rect.width || !rect.height) return [];
    const previewZones = getBottomPreviewOverlayZones();
    if (!previewZones.length) return [];

    const groupLeft = Math.min.apply(
      null,
      previewZones.map((zone) => zone.x)
    );
    const groupTop = Math.min.apply(
      null,
      previewZones.map((zone) => zone.y + zone.topOffset)
    );
    const groupRight = Math.max.apply(
      null,
      previewZones.map((zone) => zone.x + zone.width)
    );
    const groupBottom = Math.max.apply(
      null,
      previewZones.map((zone) => zone.y + zone.height)
    );
    const groupWidth = Math.max(1, groupRight - groupLeft);
    const groupHeight = Math.max(1, groupBottom - groupTop);
    const scale = Math.min(rect.width / groupWidth, rect.height / groupHeight);
    const offsetX = (rect.width - groupWidth * scale) / 2 - groupLeft * scale;
    const offsetY = (rect.height - groupHeight * scale) / 2 - groupTop * scale;

    return previewZones.map((zone) => ({
      key: zone.key,
      label: spec.nativeZones[zone.key] ? spec.nativeZones[zone.key].editorLabel : zone.key,
      color: spec.colors[zone.key],
      leftPx: zone.x * scale + offsetX,
      topPx: zone.y * scale + offsetY,
      widthPx: zone.width * scale,
      heightPx: zone.height * scale,
      centerPx: zone.centerX * scale + offsetX,
      curvePx: zone.bottomCurveDepth * scale
    }));
  };

  const applyStageSpec = () => {
    const overlayZones = buildTopOverlayZones(stageRect());
    guideEls.forEach((guide) => {
      const key = guide.getAttribute("data-cf-guide");
      const zone = overlayZones.find((item) => item.key === key);
      if (!zone) return;
      guide.style.left = `${zone.leftPx}px`;
      guide.style.width = `${zone.widthPx}px`;
      guide.style.top = `${zone.topPx}px`;
      guide.style.height = `${zone.heightPx}px`;
      guide.style.border = "none";
      guide.style.background = "transparent";
      const label = guide.querySelector("span");
      if (label) label.textContent = zone.label;
    });
  };

  const getNormalizedHeightForWidth = (normalizedWidth, imageAspect) => {
    const wrapAspect = getWrapAspect();
    return (normalizedWidth * wrapAspect) / imageAspect;
  };

  const getNormalizedWidthForHeight = (normalizedHeight, imageAspect) => {
    const wrapAspect = getWrapAspect();
    return (normalizedHeight * imageAspect) / wrapAspect;
  };

  const ensurePlacement = () => {
    if (state.placement || !state.aspect) return;

    let width = 0.82;
    let height = getNormalizedHeightForWidth(width, state.aspect);
    if (height > 0.82) {
      height = 0.82;
      width = getNormalizedWidthForHeight(height, state.aspect);
    }
    if (width > 1) {
      width = 1;
      height = getNormalizedHeightForWidth(width, state.aspect);
    }
    if (height > 1) {
      height = 1;
      width = getNormalizedWidthForHeight(height, state.aspect);
    }

    state.initialPlacement = {
      x: (1 - width) / 2,
      y: (1 - height) / 2,
      w: width,
      h: height
    };
    state.placement = { ...state.initialPlacement };
  };

  const normalizePlacement = () => {
    if (!state.placement || !state.aspect) return;
    state.placement.w = clamp(state.placement.w, 0.05, 1);
    state.placement.h = getNormalizedHeightForWidth(state.placement.w, state.aspect);
    if (state.placement.h > 1) {
      state.placement.h = 1;
      state.placement.w = getNormalizedWidthForHeight(state.placement.h, state.aspect);
    }
    state.placement.x = clamp(state.placement.x, 0, 1 - state.placement.w);
    state.placement.y = clamp(state.placement.y, 0, 1 - state.placement.h);
  };

  const buildWrapCanvas = () => {
    const size = getWrapCanvasSize();
    if (!wrapCanvas) {
      wrapCanvas = document.createElement("canvas");
      wrapCtx = wrapCanvas.getContext("2d");
    }
    const canvas = wrapCanvas;
    const ctx = wrapCtx;
    if (!canvas || !ctx) return null;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.src || !state.placement || !designEditImg.naturalWidth) {
      return { canvas, width: canvas.width, height: canvas.height };
    }
    const p = state.placement;
    ctx.drawImage(
      designEditImg,
      p.x * canvas.width,
      p.y * canvas.height,
      p.w * canvas.width,
      p.h * canvas.height
    );
    return { canvas, width: canvas.width, height: canvas.height };
  };

  const drawEditorGuides = (ctx, rect) => {
    const zones = buildTopOverlayZones(rect);
    zones.forEach((zone) => {
      const x = zone.leftPx;
      const w = zone.widthPx;
      const centerX = zone.centerPx;
      const guideTopY = zone.topPx;
      const guideBottomY = zone.topPx + zone.heightPx;
      const leftVisibleX = x;
      const rightVisibleX = x + w;
      const curveY = guideBottomY - zone.curvePx;

      ctx.save();
      ctx.strokeStyle = "rgba(71, 85, 105, 0.18)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x, guideTopY);
      ctx.lineTo(x, guideBottomY);
      ctx.moveTo(x + w, guideTopY);
      ctx.lineTo(x + w, guideBottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(centerX, guideTopY);
      ctx.lineTo(centerX, guideBottomY);
      ctx.strokeStyle = "rgba(220, 38, 38, 0.32)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(leftVisibleX, curveY);
      ctx.quadraticCurveTo(centerX, guideBottomY, rightVisibleX, curveY);
      ctx.strokeStyle = "rgba(71, 85, 105, 0.2)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    });
  };

  const applyDesignWrapUi = (rect) => {
    designWrap.hidden = !state.src || !state.placement;
    resetBtn.hidden = !state.src;
    if (!state.src || !state.placement) return;
    designEditImg.style.opacity = "1";
    designWrap.style.left = "0px";
    designWrap.style.top = "0px";
    designWrap.style.width = `${Math.round(state.placement.w * rect.width)}px`;
    designWrap.style.height = `${Math.round(state.placement.h * rect.height)}px`;
    designWrap.style.transform = `translate3d(${Math.round(state.placement.x * rect.width)}px, ${Math.round(state.placement.y * rect.height)}px, 0)`;
  };

  const renderEditor = () => {
    const rect = stageRect();
    const dpr = window.devicePixelRatio || 1;
    editorCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    editorCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = editorCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawEditorGuides(ctx, rect);
    applyDesignWrapUi(rect);
  };

  const getProofCloudConfig = () => {
    const cloud = uploader ? String(uploader.dataset.cloud || "").trim() : "";
    const preset = uploader ? String(uploader.dataset.preset || "").trim() : "";
    const folderBase = uploader ? String(uploader.dataset.folder || "").trim() : "";
    const folder = folderBase ? `${folderBase.replace(/\/+$/, "")}/proofs` : "proofs";
    return { cloud, preset, folder };
  };

  const ensureProofInput = () => {
    if (!productForm) return null;
    let input = productForm.querySelector("#cf_tumbler_proof_mockup_url");
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[Proof Mockup URL]";
      input.id = "cf_tumbler_proof_mockup_url";
      productForm.appendChild(input);
    }
    return input;
  };

  const ensureProofNoticeInput = () => {
    if (!productForm) return null;
    let input = productForm.querySelector("#cf_tumbler_proof_notice");
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_Proof Notice]";
      input.id = "cf_tumbler_proof_notice";
      productForm.appendChild(input);
    }
    return input;
  };

  const ensureUploadNoticeInput = () => {
    if (!productForm) return null;
    let input = productForm.querySelector("#cf_tumbler_upload_notice");
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_Upload Notice]";
      input.id = "cf_tumbler_upload_notice";
      productForm.appendChild(input);
    }
    return input;
  };

  const setProofUrl = (url) => {
    const input = ensureProofInput();
    if (input) input.value = String(url || "").trim();
  };

  const setProofNotice = (message) => {
    const input = ensureProofNoticeInput();
    if (input) input.value = String(message || "").trim();
  };

  const setUploadNotice = (message) => {
    const input = ensureUploadNoticeInput();
    if (input) input.value = String(message || "").trim();
  };

  const canvasToBlob = (canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Tumbler proof export failed"));
        },
        "image/png",
        0.92
      );
    });

  const uploadProofBlobToCloudinary = ({ blob }) => {
    const { cloud, preset, folder } = getProofCloudConfig();
    if (!cloud || !preset || !blob) {
      return Promise.reject(new Error("Missing proof Cloudinary configuration"));
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`;
    const fd = new FormData();
    fd.append("file", blob, `tumbler-proof-${Date.now()}.png`);
    fd.append("upload_preset", preset);
    if (folder) fd.append("folder", folder);

    return fetch(uploadUrl, {
      method: "POST",
      body: fd
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json.secure_url || json.url || "";
    });
  };

  const tracePreviewZonePath = (ctx, zone) => {
    const visibleWidth = zone.width * zone.visibleWidthRatio;
    const visibleInset = (zone.width - visibleWidth) / 2;
    const leftX = zone.x + visibleInset;
    const rightX = zone.x + zone.width - visibleInset;
    const topY = zone.y + zone.topOffset;
    const bottomY = zone.y + zone.height;
    const curveY = bottomY - zone.bottomCurveDepth;

    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(rightX, topY);
    ctx.lineTo(rightX, curveY);
    ctx.quadraticCurveTo(zone.centerX, bottomY, leftX, curveY);
    ctx.lineTo(leftX, topY);
    ctx.closePath();
  };

  const drawMockupContain = (ctx, width, height) => {
    if (!mockupImage || !spec) return null;
    const sourceWidth = spec.nativeWidth || mockupImage.width || width;
    const sourceHeight = spec.nativeHeight || mockupImage.height || height;
    const sourceAspect = sourceWidth / sourceHeight;
    const canvasAspect = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let drawX = 0;
    let drawY = 0;

    if (sourceAspect > canvasAspect) {
      drawHeight = width / sourceAspect;
      drawY = (height - drawHeight) / 2;
    } else {
      drawWidth = height * sourceAspect;
      drawX = (width - drawWidth) / 2;
    }

    ctx.drawImage(mockupImage, 0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
    return {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight
    };
  };

  const scalePreviewZone = (zone, mockupBounds) => {
    const scaleX = mockupBounds.width / spec.nativeWidth;
    const scaleY = mockupBounds.height / spec.nativeHeight;
    return {
      key: zone.key,
      x: mockupBounds.x + zone.x * scaleX,
      y: mockupBounds.y + zone.y * scaleY,
      width: zone.width * scaleX,
      height: zone.height * scaleY,
      centerX: mockupBounds.x + zone.centerX * scaleX,
      topOffset: zone.topOffset * scaleY,
      bottomCurveDepth: zone.bottomCurveDepth * scaleY,
      visibleWidthRatio: zone.visibleWidthRatio,
      verticalBias: zone.verticalBias
    };
  };

  const getPanelSourceRect = (wrapPack, key) => {
    if (!wrapPack) return { x: 0, y: 0, width: 1, height: 1 };
    const panelWidth = wrapPack.width / 3;
    const index = key === "left" ? 0 : key === "center" ? 1 : 2;
    return {
      x: Math.round(panelWidth * index),
      y: 0,
      width: Math.round(panelWidth),
      height: wrapPack.height
    };
  };

  const getCoverCrop = (sourceRect, targetZone) => {
    const sourceAspect = sourceRect.width / sourceRect.height;
    const targetAspect = targetZone.width / targetZone.height;
    let cropX = sourceRect.x;
    let cropY = sourceRect.y;
    let cropW = sourceRect.width;
    let cropH = sourceRect.height;

    if (sourceAspect > targetAspect) {
      cropW = sourceRect.height * targetAspect;
      cropX = sourceRect.x + (sourceRect.width - cropW) * 0.5;
    } else if (sourceAspect < targetAspect) {
      cropH = sourceRect.width / targetAspect;
      const align = clamp(0.5 + targetZone.verticalBias, 0, 1);
      cropY = sourceRect.y + (sourceRect.height - cropH) * align;
    }
    return { x: cropX, y: cropY, width: cropW, height: cropH };
  };

  const drawPanelCoverIntoZone = (ctx, sourceCanvas, crop, zone) => {
    ctx.drawImage(
      sourceCanvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      zone.x,
      zone.y,
      zone.width,
      zone.height
    );
  };

  const renderPreview = (wrapPack, options) => {
    if (!spec) return;
    const opts = options || {};
    const fullResolution = !!opts.fullResolution;
    const showGuides = opts.showGuides !== false;
    const isMobile = isMobileViewport();
    const cssWidth = compositeCanvas.clientWidth || compositeCanvas.offsetWidth || 0;
    const cssHeight = compositeCanvas.clientHeight || compositeCanvas.offsetHeight || cssWidth || 0;
    const width = !fullResolution && isMobile && cssWidth
      ? Math.max(1, Math.round(cssWidth))
      : (spec.nativeWidth || 1200);
    const height = !fullResolution && isMobile && cssHeight
      ? Math.max(1, Math.round(cssHeight))
      : (spec.nativeHeight || width);
    const baseDpr = window.devicePixelRatio || 1;
    const dpr = !fullResolution && isMobile ? Math.min(baseDpr, 1.5) : baseDpr;
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    if (compositeCanvas.width !== targetWidth) compositeCanvas.width = targetWidth;
    if (compositeCanvas.height !== targetHeight) compositeCanvas.height = targetHeight;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const mockupBounds = drawMockupContain(ctx, width, height);
    if (!mockupBounds) return;

    spec.order.forEach((key) => {
      const nativeZone = spec.nativeZones[key];
      if (!nativeZone) return;
      const previewZone = scalePreviewZone(nativeZone, mockupBounds);
      if (wrapPack && state.src) {
        const sourceRect = getPanelSourceRect(wrapPack, key);
        const crop = getCoverCrop(sourceRect, previewZone);
        ctx.save();
        tracePreviewZonePath(ctx, previewZone);
        ctx.clip();
        drawPanelCoverIntoZone(ctx, wrapPack.canvas, crop, previewZone);
        ctx.restore();
      }
      if (showGuides) {
        ctx.save();
        tracePreviewZonePath(ctx, previewZone);
        ctx.strokeStyle = spec.colors[key];
        ctx.lineWidth = isMobileViewport() ? 0.5 : 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(previewZone.centerX, previewZone.y + previewZone.topOffset);
        ctx.lineTo(previewZone.centerX, previewZone.y + previewZone.height);
        ctx.strokeStyle = "rgba(220, 38, 38, 0.72)";
        ctx.lineWidth = isMobileViewport() ? 0.25 : 2;
        ctx.stroke();
        ctx.restore();
      }
    });
  };

  const getProofStateKey = () => {
    if (!state.src || !state.placement || !spec || !mockupImage) return "";
    return JSON.stringify({
      src: state.src,
      placement: state.placement,
      mockup: spec.raw && spec.raw.mockup ? spec.raw.mockup.src : "",
      width: state.width,
      height: state.height
    });
  };

  const renderProofBlob = async () => {
    const wrapPack = buildWrapCanvas();
    const proofCanvas = document.createElement("canvas");
    const previousCanvas = compositeCanvas;
    const previousWidth = previousCanvas.width;
    const previousHeight = previousCanvas.height;
    const previousCtx = previousCanvas.getContext("2d");
    renderPreview(wrapPack, { fullResolution: !isMobileViewport(), showGuides: false });
    proofCanvas.width = compositeCanvas.width;
    proofCanvas.height = compositeCanvas.height;
    const proofCtx = proofCanvas.getContext("2d");
    if (!proofCtx) throw new Error("Missing proof canvas context");
    proofCtx.drawImage(compositeCanvas, 0, 0);
    if (previousCtx) {
      previousCanvas.width = previousWidth;
      previousCanvas.height = previousHeight;
      renderPreview(wrapPack);
    }
    return canvasToBlob(proofCanvas);
  };

  const syncProofNow = async ({ force = false } = {}) => {
    if (!state.src) {
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      setProofNotice("");
      setUploadNotice("");
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
    })()
      .catch((err) => {
        console.error("Tumbler proof sync failed", err);
        setProofNotice(PROOF_NOTICE_TEXT);
        return "";
      })
      .finally(() => {
        proofInFlightPromise = null;
      });

    return proofInFlightPromise;
  };

  const scheduleProofSync = () => {
    if (proofSyncTimer) window.clearTimeout(proofSyncTimer);
    if (!state.src) {
      setProofUrl("");
      return;
    }
    proofSyncTimer = window.setTimeout(() => {
      proofSyncTimer = null;
      syncProofNow();
    }, 250);
  };

  const updateStatusAndMeta = () => {
    if (!statusEl || !metaEl) return;
    if (!state.src) {
      const hiddenStatus = statusSource ? String(statusSource.textContent || "").trim() : "";
      statusEl.textContent = hiddenStatus || "Upload one design to start the tumbler preview. Preferred file size is under 10MB so the proof preview can appear in cart.";
      metaEl.textContent = metaSource && metaSource.textContent ? metaSource.textContent : "";
      return;
    }

    const originalWidth = state.width;
    const originalHeight = state.height;
    const aspect = state.aspect || 1;
    const proofInput = ensureProofInput();
    const proofReady = !!(proofInput && proofInput.value.trim());
    const proofNotice = getProofNotice();
    statusEl.textContent = proofReady
      ? "If the upload and preview look correct, add to cart."
      : proofNotice || "Preview ready. If the upload looks correct, you can add to cart. Preparing the cart proof image.";
    metaEl.textContent = metaSource && metaSource.textContent
      ? metaSource.textContent
      : `Upload: ${originalWidth} x ${originalHeight}px - Aspect ratio ${aspect.toFixed(2)}`;
  };

  const finalizeAfterRender = () => {
    if (finalizeTimer) window.clearTimeout(finalizeTimer);
    finalizeTimer = window.setTimeout(() => {
      finalizeTimer = null;
      updateStatusAndMeta();
      scheduleProofSync();
    }, 0);
  };

  const renderPreviewNow = () => {
    if (!state.placement) return;
    normalizePlacement();
    const rect = stageRect();
    applyDesignWrapUi(rect);
    const wrapPack = buildWrapCanvas();
    renderPreview(wrapPack);
  };

  const renderAllNow = () => {
    ensurePlacement();
    normalizePlacement();
    renderEditor();
    const wrapPack = buildWrapCanvas();
    renderPreview(wrapPack);
    updateStatusAndMeta();
    scheduleProofSync();
  };

  const scheduleRender = () => {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      renderAllNow();
    }, 30);
  };

  const resetPlacement = () => {
    if (!state.initialPlacement) return;
    state.placement = { ...state.initialPlacement };
    scheduleRender();
  };

  const syncFromUploader = () => {
    const src = previewImg ? previewImg.getAttribute("src") || "" : "";
    const hasPreview = !!src && (!previewWrap || !previewWrap.hidden);
    if (!hasPreview) {
      state.src = "";
      state.placement = null;
      state.initialPlacement = null;
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      designEditImg.removeAttribute("src");
      scheduleRender();
      return;
    }

    if (state.src === src && state.placement) {
      scheduleRender();
      return;
    }

    state.src = src;
    designEditImg.onload = () => {
      state.width = designEditImg.naturalWidth || 0;
      state.height = designEditImg.naturalHeight || 0;
      state.aspect = state.height ? state.width / state.height : 1;
      state.placement = null;
      state.initialPlacement = null;
      scheduleRender();
    };
    designEditImg.src = src;
  };

  const beginInteraction = (mode, e) => {
    if (!state.src || !state.placement || pointerMode) return;
    pointerMode = mode;
    pointerStart = { x: e.clientX, y: e.clientY };
    startPlacement = { ...state.placement };
    activePointerId = e.pointerId;
    designWrap.setPointerCapture(e.pointerId);
    designWrap.classList.toggle("is-dragging", mode === "dragging");
    designWrap.classList.toggle("is-resizing", mode === "resizing");
    e.preventDefault();
    e.stopPropagation();
  };

  const moveInteraction = (e) => {
    if (!pointerMode || activePointerId !== e.pointerId || !pointerStart || !startPlacement) return;
    const rect = stageRect();
    const dx = (e.clientX - pointerStart.x) / rect.width;
    const dy = (e.clientY - pointerStart.y) / rect.height;

    if (pointerMode === "dragging") {
      state.placement.x = startPlacement.x + dx;
      state.placement.y = startPlacement.y + dy;
    } else {
      const growth = Math.max(dx, (dy * state.aspect) / getWrapAspect());
      let nextW = startPlacement.w + growth;
      nextW = clamp(nextW, 0.05, 1);
      state.placement.w = nextW;
      state.placement.h = getNormalizedHeightForWidth(nextW, state.aspect);
      state.placement.x = startPlacement.x;
      state.placement.y = startPlacement.y;
    }

    normalizePlacement();
    if (isMobileViewport()) {
      applyDesignWrapUi(rect);
    } else {
      renderAllNow();
    }
    e.preventDefault();
  };

  const endInteraction = (e) => {
    const wasMode = pointerMode;
    if (activePointerId !== null && e && typeof e.pointerId === "number" && activePointerId !== e.pointerId) return;
    pointerMode = null;
    activePointerId = null;
    pointerStart = null;
    startPlacement = null;
    designWrap.classList.remove("is-dragging", "is-resizing");
    if (renderTimer) {
      window.clearTimeout(renderTimer);
      renderTimer = null;
    }
    if ((wasMode === "dragging" || wasMode === "resizing") && isMobileViewport()) {
      renderPreviewNow();
      finalizeAfterRender();
    } else {
      scheduleRender();
    }
  };

  if (startBtn && body) {
    startBtn.addEventListener("click", () => {
      body.hidden = false;
      mountSharedUploadNotice();
      loadConfig().then(() => loadMockup()).then(() => {
        applyStageSpec();
        scheduleRender();
        syncFromUploader();
      });
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      if (typeof uploadInput.showPicker === "function") {
        try {
          uploadInput.showPicker();
          return;
        } catch (e) {}
      }
      uploadInput.click();
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", resetPlacement);

  uploadInput.addEventListener("change", () => {
    window.setTimeout(syncFromUploader, 0);
  });

  if (previewImg && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => window.setTimeout(syncFromUploader, 0));
    observer.observe(previewImg, { attributes: true, attributeFilter: ["src"] });
    if (previewWrap) observer.observe(previewWrap, { attributes: true, attributeFilter: ["hidden"] });
    if (metaSource) observer.observe(metaSource, { characterData: true, childList: true, subtree: true });
    if (statusSource) observer.observe(statusSource, { characterData: true, childList: true, subtree: true, attributes: true, attributeFilter: ["data-type"] });
  }

  designWrap.addEventListener("pointerdown", (e) => {
    if (e.target && e.target.closest && e.target.closest("[data-cf-tumbler-handle]")) return;
    beginInteraction("dragging", e);
  });

  if (resizeHandle) {
    resizeHandle.addEventListener("pointerdown", (e) => beginInteraction("resizing", e));
  }

  designWrap.addEventListener("pointermove", moveInteraction);
  designWrap.addEventListener("pointerup", endInteraction);
  designWrap.addEventListener("pointercancel", endInteraction);
  designWrap.addEventListener("lostpointercapture", endInteraction);

  window.addEventListener("resize", () => {
    applyStageSpec();
    scheduleRender();
  });

  if (productForm) {
    productForm.addEventListener(
      "submit",
      async (e) => {
        if (allowNextSubmit) {
          allowNextSubmit = false;
          return;
        }
        if (!state.src) return;

        const currentDesignUrl = designUrlInput ? String(designUrlInput.value || "").trim() : "";
        if (!currentDesignUrl) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (statusEl) {
            statusEl.textContent = "Finishing your uploaded image before adding to cart...";
          }
          const waitedDesignUrl = await waitForDesignUrl(2000);
          if (!waitedDesignUrl) {
            setUploadNotice(UPLOAD_NOTICE_TEXT);
            if (statusEl) {
              statusEl.textContent = getProofNotice() ? BOTH_NOTICE_TEXT : UPLOAD_NOTICE_TEXT;
            }
            allowNextSubmit = true;
            resumeProductSubmit();
            return;
          }
          setUploadNotice("");
          allowNextSubmit = true;
          resumeProductSubmit();
          return;
        }

        setUploadNotice("");

        if (isMobileViewport()) {
          const currentKey = getProofStateKey();
          const proofInput = ensureProofInput();
          const currentUrl = proofInput ? proofInput.value.trim() : "";
          if (currentKey && currentKey === proofLastKey && currentUrl) {
            setProofNotice("");
            return;
          }

          if (proofInFlightPromise) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (statusEl) {
              statusEl.textContent = "Finishing your tumbler preview before adding to cart...";
            }
            const syncedUrl = await waitForCurrentProof(MOBILE_PROOF_WAIT_MS);
            if (syncedUrl) {
              setProofNotice("");
              if (statusEl) statusEl.textContent = "Preview ready. Adding to cart...";
            } else {
              setProofNotice(PROOF_NOTICE_TEXT);
              if (statusEl) {
                statusEl.textContent = "Proof size is greater than 10MB. Adding to cart without the proof preview. Our team will send you the proof before printing.";
              }
            }
            allowNextSubmit = true;
            resumeProductSubmit();
          }
          if (!proofInFlightPromise) {
            setProofNotice(PROOF_NOTICE_TEXT);
            if (statusEl) {
              statusEl.textContent = "Proof size is greater than 10MB. Adding to cart without the proof preview. Our team will send you the proof before printing.";
            }
          }
          return;
        }

        const currentKey = getProofStateKey();
        const proofInput = ensureProofInput();
        const currentUrl = proofInput ? proofInput.value.trim() : "";
        if (currentKey && currentKey === proofLastKey && currentUrl) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        if (statusEl) {
          statusEl.textContent = "Preparing your tumbler proof image before adding to cart...";
        }

        const syncedUrl = await syncProofNow({ force: true });
        if (!syncedUrl) {
          setProofNotice(PROOF_NOTICE_TEXT);
          if (statusEl) {
            statusEl.textContent = "Proof size is greater than 10MB. Adding to cart without the proof preview. Our team will send you the proof before printing.";
          }
          allowNextSubmit = true;
          resumeProductSubmit();
          return;
        }

        allowNextSubmit = true;
        resumeProductSubmit();
      },
      true
    );
  }

  loadConfig().then(() => loadMockup()).then(() => {
    applyStageSpec();
    ensureProofInput();
    ensureProofNoticeInput();
    ensureUploadNoticeInput();
    mountSharedUploadNotice();
    scheduleRender();
    syncFromUploader();
  });
})();
