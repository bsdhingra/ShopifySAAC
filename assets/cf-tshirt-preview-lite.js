/* assets/cf-tshirt-preview-lite.js */
(() => {
  const box = document.getElementById("cf-tshirt-preview-container");
  if (!box) return;

  /* ===== TEMP PRINT ZONE RESTRICTION TOGGLE ===== */
  const BD_DISABLE_ZONE = true; // true=free move, false=restrict

  const canvas = box.querySelector(".cf-preview-canvas");
  const designImg = box.querySelector(".cf-preview-design");
  if (!canvas || !designImg) return;

  const designerBody = box.querySelector(".cf-designer-body");
  const startBtn = box.querySelector("[data-cf-start-btn]");
  const startRow = box.querySelector(".cf-start-row");
  // --------------------------
  // Product config
  // --------------------------
  const bdPreviewConfig = String(box.dataset.cfConfig || "front-only").toLowerCase().trim();
  const bdConfigId = String(box.dataset.configId || "").trim();
  const bdConfigUrl = String(box.dataset.configUrl || "").trim();
  const bdProductFamily = String(box.dataset.cfProductFamily || "apparel").toLowerCase().trim();
  const bdIsTotePreview = bdProductFamily === "tote";
  const bdVariantTitleMap = (() => {
    const node = document.getElementById("bd-variant-title-map");
    if (!node || !node.textContent) return {};
    try {
      const json = JSON.parse(node.textContent);
      return json && typeof json === "object" ? json : {};
    } catch (e) {
      return {};
    }
  })();
  let bdResolvedPreviewMode = bdPreviewConfig;
  let bdToteVariantModeUserInteracted = false;
  let bdPreferredActiveSide = bdResolvedPreviewMode === "back-only" ? "back" : "front";

  const bdRememberPreferredActiveSide = (side) => {
    bdPreferredActiveSide = side === "back" ? "back" : "front";
  };

  const bdReadVariantId = () => {
    const input =
      box.closest("product-info")?.querySelector('form[action^="/cart/add"] input[name="id"]') ||
      document.querySelector('form[action^="/cart/add"] input[name="id"]');
    return String((input && input.value) || "").trim();
  };

  const bdGetCurrentVariantTitle = () => {
    const variantId = bdReadVariantId();
    return String(bdVariantTitleMap[variantId] || "").trim();
  };

  const bdResolveModeFromVariantText = (rawText) => {
    const title = String(rawText || "").toLowerCase().trim();
    if (!title) return "";
    const normalized = title.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const hasSideWord = /\bside(?:d)?\b/.test(normalized);
    if (((/\bdouble\b/.test(normalized) || /\b2\b/.test(normalized) || /\btwo\b/.test(normalized)) && hasSideWord) || /\bdouble\s*sided\b/.test(normalized) || /\b2\s*sided\b/.test(normalized) || /\btwo\s*sided\b/.test(normalized)) {
      return "front-back";
    }
    if (((/\bsingle\b/.test(normalized) || /\b1\b/.test(normalized) || /\bone\b/.test(normalized)) && hasSideWord) || /\bsingle\s*sided\b/.test(normalized) || /\b1\s*sided\b/.test(normalized) || /\bone\s*sided\b/.test(normalized)) {
      return "front-only";
    }
    return "";
  };

  const bdGetVariantUiDescriptor = () => {
    const values = [];

    document.querySelectorAll("variant-selects select").forEach((sel) => {
      const text = String(sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : sel.value || "").trim();
      if (text) values.push(text);
    });

    document.querySelectorAll('variant-selects input[type="radio"]:checked').forEach((inp) => {
      const text = String(inp.value || "").trim();
      if (text) values.push(text);
    });

    document.querySelectorAll('input[type="radio"][name^="options["]:checked').forEach((inp) => {
      const text = String(inp.value || "").trim();
      if (text) values.push(text);
    });

    return values.join(" ");
  };

  const bdResolveVariantDrivenMode = () => {
    if (!bdIsTotePreview) return bdPreviewConfig;
    const mappedMode = bdResolveModeFromVariantText(bdGetCurrentVariantTitle());
    if (mappedMode) return mappedMode;

    const uiMode = bdResolveModeFromVariantText(bdGetVariantUiDescriptor());
    if (uiMode) return uiMode;

    if (bdResolvedPreviewMode === "front-back" || bdResolvedPreviewMode === "front-only") {
      return bdResolvedPreviewMode;
    }

    return "front-only";
  };

  const bdIsFrontOnlyMode = () => bdResolvedPreviewMode === "front-only";
  const bdIsBackOnlyMode = () => bdResolvedPreviewMode === "back-only";
  const bdIsFrontBackMode = () => bdResolvedPreviewMode === "front-back";

  const bdEnsureToteModeNotice = () => {
    if (!bdIsTotePreview) return null;
    let notice = box.querySelector("[data-bd-tote-mode-notice='1']");
    if (notice) return notice;
    notice = document.createElement("div");
    notice.setAttribute("data-bd-tote-mode-notice", "1");
    notice.style.margin = "10px 0 0";
    notice.style.padding = "10px 12px";
    notice.style.border = "1px solid rgba(0,0,0,.12)";
    notice.style.borderRadius = "8px";
    notice.style.fontSize = "12px";
    notice.style.lineHeight = "1.4";
    notice.style.background = "rgba(249,249,246,0.96)";
    notice.hidden = true;
    const startRowHost = startRow && startRow.parentNode ? startRow.parentNode : box;
    if (designerBody && designerBody.parentNode === startRowHost) {
      designerBody.insertAdjacentElement("beforebegin", notice);
    } else {
      startRowHost.appendChild(notice);
    }
    return notice;
  };

  const bdSyncResolvedPreviewMode = ({ announce = false } = {}) => {
    const nextMode = bdResolveVariantDrivenMode();
    const previousMode = bdResolvedPreviewMode;
    bdResolvedPreviewMode = nextMode;
    box.dataset.bdResolvedMode = nextMode;
    if (!bdIsTotePreview) return previousMode !== nextMode;
    const notice = bdEnsureToteModeNotice();
    if (!notice) return previousMode !== nextMode;
    if (announce) {
      bdToteVariantModeUserInteracted = true;
    }
    notice.hidden = !bdToteVariantModeUserInteracted;
    notice.textContent = nextMode === "front-back"
      ? "Double-sided selected. Price varies between Single-sided and Double-sided options."
      : "Single-sided selected. Price varies between Single-sided and Double-sided options.";
    if (bdToteVariantModeUserInteracted && !announce && previousMode === nextMode) {
      notice.style.opacity = "0.92";
    }
    return previousMode !== nextMode;
  };


  // --------------------------
  // Helpers
  // --------------------------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  window.BD_FINALIZE_RECOVERY_DEBUG = window.BD_FINALIZE_RECOVERY_DEBUG || [];
  const BD_DEBUG_FINALIZE_RECOVERY = !!window.__BD_DEBUG_FINALIZE_RECOVERY;
  function bdFinalizeRecoveryLog(label, payload) {
    if (!BD_DEBUG_FINALIZE_RECOVERY) return;
    try {
      window.BD_FINALIZE_RECOVERY_DEBUG.push({
        ts: Date.now(),
        label: String(label || "").trim(),
        payload: payload || {}
      });
    } catch (e) {}
  }
  window.__bdDumpFinalizeRecoveryDebug = function () {
    try {
      return JSON.parse(JSON.stringify(window.BD_FINALIZE_RECOVERY_DEBUG || []));
    } catch (e) {
      return window.BD_FINALIZE_RECOVERY_DEBUG || [];
    }
  };
  const BD_EDITOR_MIN_DESIGN_PX = 24;
  const BD_EDITOR_MIN_DESIGN_ZONE_RATIO = 0.05;
  const bdGetMinDesignWidth = (boundsWidth) =>
    Math.max(BD_EDITOR_MIN_DESIGN_PX, Math.round((boundsWidth || 0) * BD_EDITOR_MIN_DESIGN_ZONE_RATIO));
  const bdIsElementActuallyHidden = (el) => {
    if (!el) return true;
    if (el.hidden) return true;
    if (el.hasAttribute("hidden")) return true;
    if (el.offsetParent === null) return true;
    const cs = window.getComputedStyle(el);
    return cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0";
  };

  const bdNormalizeKey = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[-_]/g, "");

  let bdLastKnownSelectedColor = "";

  // --------------------------
  // Side toggle state
  // --------------------------
  let bdActiveSide = "front";

  const bdGetActiveSide = () => {
    if (bdActiveSide === "back" || bdActiveSide === "front") {
      return bdActiveSide;
    }
    const hidden = box.querySelector("#bd_active_side");
    const v = ((hidden && hidden.value) || "").toLowerCase();
    return v === "back" ? "back" : "front";
  };
  window.bdGetActiveSide = bdGetActiveSide;

  const bdSetActiveSideUi = (side) => {
    const s = side === "back" ? "back" : "front";
    const toggle = box.querySelector(".bd-side-toggle");
    const hidden = toggle ? toggle.querySelector("#bd_active_side") : box.querySelector("#bd_active_side");
    const btns = toggle ? Array.from(toggle.querySelectorAll(".bd-side-btn")) : [];
    const inlineFrontBtn = box.querySelector('[data-bd-inline-front="1"]');
    const inlineBackBtn = box.querySelector('[data-bd-inline-back="1"]');

    if (hidden) hidden.value = s;

    btns.forEach((b) => {
      const on = b.dataset.bdSide === s;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (inlineFrontBtn && inlineBackBtn && bdIsFrontBackMode()) {
      const frontActive = s !== "back";
      inlineFrontBtn.disabled = !frontActive;
      inlineBackBtn.disabled = frontActive;
      inlineFrontBtn.classList.toggle("is-inactive", !frontActive);
      inlineBackBtn.classList.toggle("is-inactive", frontActive);
      inlineFrontBtn.setAttribute("aria-disabled", frontActive ? "false" : "true");
      inlineBackBtn.setAttribute("aria-disabled", frontActive ? "true" : "false");
    }

    bdActiveSide = s;
  };

  const bdInitSideToggle = () => {
    const toggle = box.querySelector(".bd-side-toggle");
    if (!toggle) {
      bdActiveSide = bdGetActiveSide();
      return;
    }

    toggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".bd-side-btn");
      if (!btn) return;
      const s = btn.dataset.bdSide === "back" ? "back" : "front";
      bdRememberPreferredActiveSide(s);
      bdSetActiveSideUi(s);
      if (typeof window.bdSwitchPreviewSide === "function") window.bdSwitchPreviewSide(s);
    });

    bdSetActiveSideUi(bdGetActiveSide());
  };

  bdInitSideToggle();

  // --------------------------
  // Upload input discovery
  // --------------------------
  const bdFindFrontFileInput = () => {
    const byId = document.getElementById("cfUploadFront");
    if (byId) return byId;

    const inBox = box.querySelector('input[type="file"]');
    if (inBox) return inBox;

    const all = Array.from(document.querySelectorAll('input[type="file"]'));
    if (all.length === 1) return all[0];

    return null;
  };

  const inputFront = bdFindFrontFileInput();
  const inputBack = document.getElementById("cfUploadBack");
  if (!inputFront && !inputBack) return;

  const bdGetMirrorSide = () => {
    if (bdIsBackOnlyMode()) return "back";
    if (bdIsFrontOnlyMode()) return "front";
    return bdGetActiveSide();
  };

  const bdGetRealUploadBlock = (side) => {
    const idx = side === "back" ? "2" : "1";
    const input = side === "back" ? inputBack : inputFront;
    return (
      (input && input.closest('.cf-uploader__block[data-upload-block="' + idx + '"]')) ||
      document.querySelector('.cf-uploader__block[data-upload-block="' + idx + '"]')
    );
  };

  const bdGetSharedUploaderRoot = () => document.querySelector("[data-cf-uploader]");
  const bdGetMasterOriginalUrlForSide = (side) => {
    const idx = side === "back" ? "2" : "1";
    const uploaderRoot = bdGetSharedUploaderRoot();
    return String(uploaderRoot?.querySelector(`[data-master-url="${idx}"]`)?.value || "").trim();
  };
  const bdReadMasterOriginalFileForSide = (side) => {
    const idx = side === "back" ? "2" : "1";
    const uploaderRoot = bdGetSharedUploaderRoot();
    if (typeof window.bdReadMasterOriginalUpload !== "function" || !uploaderRoot) {
      return Promise.resolve(null);
    }
    return Promise.resolve(window.bdReadMasterOriginalUpload(uploaderRoot, idx)).catch(() => null);
  };
  const bdReadWorkingUploadFileForSide = (side) => {
    const idx = side === "back" ? "2" : "1";
    const uploaderRoot = bdGetSharedUploaderRoot();
    if (typeof window.bdReadWorkingUpload !== "function" || !uploaderRoot) {
      return Promise.resolve(null);
    }
    return Promise.resolve(window.bdReadWorkingUpload(uploaderRoot, idx)).catch(() => null);
  };

  // --------------------------
  // Crop modal scaffolding (V1 foundation)
  // - UI/state only in this step
  // - Wiring into the upload flow happens next
  // --------------------------
  const bdCropState = {
    isOpen: false,
    side: "front",
    file: null,
    objectUrl: "",
    usingOriginal: false,
    naturalWidth: 0,
    naturalHeight: 0,
    stage: { x: 0, y: 0, w: 0, h: 0 },
    image: { x: 0, y: 0, w: 0, h: 0, scale: 1 },
    cropRect: { x: 0, y: 0, w: 0, h: 0 },
    pointerMode: null,
    pointerId: null,
    pointerStart: null,
    originalBySide: {
      front: null,
      back: null
    }
  };

  const bdIsSvgFile = (file) => !!(file && file.type === "image/svg+xml");

  const bdCanCropFile = (file) => {
    if (!file) return false;
    if (bdIsSvgFile(file)) return false;
    return String(file.type || "").startsWith("image/");
  };

  const BD_CROP_MIN_SIZE = 20;

  const bdCreateEditorSideState = () => ({
    originalFile: null,
    originalObjectUrl: "",
    crop: null
  });

  const bdEditorState = {
    front: bdCreateEditorSideState(),
    back: bdCreateEditorSideState()
  };

  const bdGetEditorSideState = (side) => (side === "back" ? bdEditorState.back : bdEditorState.front);

  const bdRevokeEditorOriginalObjectUrl = (side) => {
    const editorSide = bdGetEditorSideState(side);
    if (!editorSide.originalObjectUrl) return;
    try {
      URL.revokeObjectURL(editorSide.originalObjectUrl);
    } catch (e) {}
    editorSide.originalObjectUrl = "";
  };

  const bdSetOriginalEditorFile = (side, file) => {
    const editorSide = bdGetEditorSideState(side);
    bdRevokeEditorOriginalObjectUrl(side);
    editorSide.originalFile = file || null;
    editorSide.crop = null;
    editorSide.originalObjectUrl = file ? URL.createObjectURL(file) : "";
    bdCropState.originalBySide[side] = file || null;
  };

  const bdSetEditorCropMeta = (side, cropMeta) => {
    const editorSide = bdGetEditorSideState(side);
    editorSide.crop = cropMeta ? { ...cropMeta } : null;
  };

  const bdGetInputForSide = (side) => (side === "back" ? inputBack : inputFront);
  const bdGetCurrentFileForSide = (side) => {
    const input = bdGetInputForSide(side);
    const liveFile = input && input.files && input.files[0] ? input.files[0] : null;
    if (liveFile) return liveFile;
    const editorSide = bdGetEditorSideState(side);
    return editorSide && editorSide.originalFile ? editorSide.originalFile : null;
  };

  const bdRevokeCropObjectUrl = () => {
    if (bdCropState.objectUrl) {
      try {
        URL.revokeObjectURL(bdCropState.objectUrl);
      } catch (e) {}
      bdCropState.objectUrl = "";
    }
  };

  const bdResetCropState = () => {
    bdCropState.isOpen = false;
    bdCropState.side = "front";
    bdCropState.file = null;
    bdCropState.usingOriginal = false;
    bdCropState.naturalWidth = 0;
    bdCropState.naturalHeight = 0;
    bdCropState.stage = { x: 0, y: 0, w: 0, h: 0 };
    bdCropState.image = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
    bdCropState.cropRect = { x: 0, y: 0, w: 0, h: 0 };
    bdCropState.pointerMode = null;
    bdCropState.pointerId = null;
    bdCropState.pointerStart = null;
    bdRevokeCropObjectUrl();
  };

  const bdIsCropPending = () => !!bdCropState.isOpen;

  const bdSyncCropActionButtons = () => {
    const cropBtn = box.querySelector('[data-bd-inline-crop="1"]');
    const cancelBtn = box.querySelector('[data-bd-inline-crop-cancel="1"]');
    const originalBtn = box.querySelector('[data-bd-inline-crop-original="1"]');
    const applyBtn = box.querySelector('[data-bd-inline-crop-apply="1"]');
    const frontBtn = box.querySelector('[data-bd-inline-front="1"]');
    const backBtn = box.querySelector('[data-bd-inline-back="1"]');
    const side = bdGetMirrorSide();
    const originalFile = bdCropState.originalBySide[side];
    const hasMasterOriginal = !!bdGetMasterOriginalUrlForSide(side);
    const canRecrop = !!(originalFile && bdCanCropFile(originalFile));

    if (cropBtn) cropBtn.style.display = bdCropState.isOpen ? "none" : (canRecrop ? "" : "none");
    if (cancelBtn) cancelBtn.style.display = bdCropState.isOpen ? "" : "none";
    if (originalBtn) originalBtn.style.display = bdCropState.isOpen && (originalFile || hasMasterOriginal) ? "" : "none";
    if (applyBtn) applyBtn.style.display = bdCropState.isOpen ? "" : "none";
    if (frontBtn) frontBtn.disabled = bdCropState.isOpen;
    if (backBtn) backBtn.disabled = bdCropState.isOpen;
    if (frontBtn) frontBtn.style.opacity = bdCropState.isOpen ? "0.55" : "";
    if (backBtn) backBtn.style.opacity = bdCropState.isOpen ? "0.55" : "";
  };

  const bdCloseCropModal = () => {
    const root = box.querySelector('[data-bd-crop-inline="1"]');
    const img = root ? root.querySelector('[data-bd-crop-image="1"]') : null;
    const placeholder = root ? root.querySelector('[data-bd-crop-placeholder="1"]') : null;
    const note = box.querySelector('[data-bd-crop-note="1"]');
    const designWrap = canvas.querySelector(".cf-design-wrap");

    if (img) {
      img.removeAttribute("src");
      img.hidden = true;
    }

    if (placeholder) {
      placeholder.hidden = false;
    }

    if (note) {
      note.hidden = true;
      note.textContent = "";
    }

    if (root) {
      root.hidden = true;
    }

    if (designWrap) {
      designWrap.style.visibility = "";
    }

    if (root) {
      root.style.left = "";
      root.style.top = "";
      root.style.width = "";
      root.style.height = "";
    }

    box.classList.remove("bd-crop-open");
    bdResetCropState();
    bdSyncCropActionButtons();
    try {
      if (typeof bdUpdateReviewUi === "function") bdUpdateReviewUi();
      if (typeof bdRefreshFinalizeUi === "function") bdRefreshFinalizeUi();
    } catch (e) {}
  };

  const bdEnsureCropModal = () => {
    let root = box.querySelector('[data-bd-crop-inline="1"]');
    if (root) return root;

    root = document.createElement("div");
    root.className = "bd-crop-inline";
    root.setAttribute("data-bd-crop-inline", "1");
    root.hidden = true;
    root.innerHTML = `
      <div class="bd-crop-stage" data-bd-crop-stage="1">
        <img class="bd-crop-stage__img" data-bd-crop-image="1" alt="Crop preview" hidden>
        <div class="bd-crop-box" data-bd-crop-box="1" hidden>
          <div class="bd-crop-box__drag" data-bd-crop-drag="1" aria-hidden="true"></div>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="n" aria-label="Resize crop area from top"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="s" aria-label="Resize crop area from bottom"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="e" aria-label="Resize crop area from right"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="w" aria-label="Resize crop area from left"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="nw" aria-label="Resize crop area from top left"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="ne" aria-label="Resize crop area from top right"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="sw" aria-label="Resize crop area from bottom left"></button>
          <button type="button" class="bd-crop-box__handle" data-bd-crop-handle="se" aria-label="Resize crop area from bottom right"></button>
        </div>
        <div class="bd-crop-stage__placeholder" data-bd-crop-placeholder="1">
          Crop preview will appear here.
        </div>
      </div>
    `;

    if (root.parentNode !== wrap) {
      wrap.appendChild(root);
    }

    let note = box.querySelector('[data-bd-crop-note="1"]');
    if (!note) {
      note = document.createElement("div");
      note.className = "bd-crop-inline__note";
      note.setAttribute("data-bd-crop-note", "1");
      note.hidden = true;
      const infoPanel = box.querySelector('[data-bd-upload-info="1"]');
      if (infoPanel && infoPanel.parentNode) {
        infoPanel.insertAdjacentElement("beforebegin", note);
      } else if (root.parentNode) {
        root.insertAdjacentElement("afterend", note);
      }
    }

    const stage = root.querySelector('[data-bd-crop-stage="1"]');
    const cropImg = root.querySelector('[data-bd-crop-image="1"]');
    const cropBox = root.querySelector('[data-bd-crop-box="1"]');

    if (cropBox) {
      let bdActiveTouchId = null;
      let bdActivePointerId = null;

      const bdStartCropInteraction = (clientX, clientY, handle, pointerId) => {
        if (!bdCropState.isOpen) return;
        bdCropState.pointerMode = handle ? "resize" : "drag-crop";
        bdCropState.pointerId = pointerId != null ? pointerId : null;
        bdCropState.pointerStart = {
          x: clientX,
          y: clientY,
          handle: handle || "",
          cropRect: { ...bdCropState.cropRect }
        };
      };

      const bdUpdateCropInteraction = (clientX, clientY) => {
        if (!bdCropState.pointerMode || !bdCropState.pointerStart) return;
        const image = bdCropState.image;
        const cropRect = bdCropState.cropRect;
        if (!image.w || !image.h || !cropRect.w || !cropRect.h) return;

        const dx = clientX - bdCropState.pointerStart.x;
        const dy = clientY - bdCropState.pointerStart.y;
        const startRect = bdCropState.pointerStart.cropRect;
        const minSize = BD_CROP_MIN_SIZE;
        let nextRect = { ...startRect };

        if (bdCropState.pointerMode === "drag-crop") {
          nextRect.x = startRect.x + dx;
          nextRect.y = startRect.y + dy;
        } else if (bdCropState.pointerMode === "resize") {
          const handle = bdCropState.pointerStart.handle || "";
          const startLeft = startRect.x;
          const startTop = startRect.y;
          const startRight = startRect.x + startRect.w;
          const startBottom = startRect.y + startRect.h;

          let nextLeft = startLeft;
          let nextTop = startTop;
          let nextRight = startRight;
          let nextBottom = startBottom;

          if (handle.includes("w")) nextLeft = startLeft + dx;
          if (handle.includes("e")) nextRight = startRight + dx;
          if (handle.includes("n")) nextTop = startTop + dy;
          if (handle.includes("s")) nextBottom = startBottom + dy;

          nextLeft = clamp(nextLeft, image.x, startRight - minSize);
          nextRight = clamp(nextRight, nextLeft + minSize, image.x + image.w);
          nextTop = clamp(nextTop, image.y, startBottom - minSize);
          nextBottom = clamp(nextBottom, nextTop + minSize, image.y + image.h);

          nextRect = {
            x: nextLeft,
            y: nextTop,
            w: nextRight - nextLeft,
            h: nextBottom - nextTop
          };
        }

        bdCropState.cropRect = bdClampCropRectToImage(nextRect);
        bdSyncCropBoxUi();
      };

      const bdEndCropInteraction = () => {
        bdCropState.pointerMode = null;
        bdCropState.pointerId = null;
        bdCropState.pointerStart = null;
      };

      const bdDetachWindowPointerListeners = () => {
        window.removeEventListener("pointermove", bdHandleWindowPointerMove);
        window.removeEventListener("pointerup", bdHandleWindowPointerEnd);
        window.removeEventListener("pointercancel", bdHandleWindowPointerEnd);
      };

      const bdDetachWindowTouchListeners = () => {
        window.removeEventListener("touchmove", bdHandleWindowTouchMove);
        window.removeEventListener("touchend", bdHandleWindowTouchEnd);
        window.removeEventListener("touchcancel", bdHandleWindowTouchEnd);
      };

      const bdHandleWindowPointerMove = (e) => {
        if (!bdCropState.isOpen || bdActivePointerId == null) return;
        if (e.pointerId !== bdActivePointerId) return;
        bdUpdateCropInteraction(e.clientX, e.clientY);
        e.preventDefault();
      };

      const bdHandleWindowPointerEnd = (e) => {
        if (bdActivePointerId == null) return;
        if (e.pointerId !== bdActivePointerId) return;
        bdActivePointerId = null;
        bdEndCropInteraction();
        bdDetachWindowPointerListeners();
      };

      const bdFindTouchById = (touchList, identifier) => {
        if (!touchList || identifier == null) return null;
        for (let i = 0; i < touchList.length; i += 1) {
          if (touchList[i] && touchList[i].identifier === identifier) return touchList[i];
        }
        return null;
      };

      const bdHandleWindowTouchMove = (e) => {
        if (!bdCropState.isOpen || bdActiveTouchId == null) return;
        const touch = bdFindTouchById(e.touches, bdActiveTouchId);
        if (!touch) return;
        bdUpdateCropInteraction(touch.clientX, touch.clientY);
        e.preventDefault();
      };

      const bdHandleWindowTouchEnd = (e) => {
        if (bdActiveTouchId == null) return;
        const activeTouch = bdFindTouchById(e.touches, bdActiveTouchId);
        if (activeTouch) return;
        bdActiveTouchId = null;
        bdEndCropInteraction();
        bdDetachWindowTouchListeners();
      };

      cropBox.addEventListener("pointerdown", (e) => {
        const handleTarget = e.target && e.target.closest ? e.target.closest("[data-bd-crop-handle]") : null;
        const handle = handleTarget && handleTarget.getAttribute ? handleTarget.getAttribute("data-bd-crop-handle") : "";
        bdActivePointerId = e.pointerId;
        bdStartCropInteraction(e.clientX, e.clientY, handle, e.pointerId);
        bdDetachWindowPointerListeners();
        window.addEventListener("pointermove", bdHandleWindowPointerMove, { passive: false });
        window.addEventListener("pointerup", bdHandleWindowPointerEnd, { passive: false });
        window.addEventListener("pointercancel", bdHandleWindowPointerEnd, { passive: false });
        if (cropBox.setPointerCapture) {
          cropBox.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
      });

      cropBox.addEventListener(
        "touchstart",
        (e) => {
          if (!bdCropState.isOpen) return;
          const handleTarget = e.target && e.target.closest ? e.target.closest("[data-bd-crop-handle]") : null;
          const touch = e.touches && e.touches[0];
          if (!touch) return;
          const handle = handleTarget && handleTarget.getAttribute ? handleTarget.getAttribute("data-bd-crop-handle") : "";
          bdActiveTouchId = touch.identifier;
          bdStartCropInteraction(touch.clientX, touch.clientY, handle, touch.identifier);
          bdDetachWindowTouchListeners();
          window.addEventListener("touchmove", bdHandleWindowTouchMove, { passive: false });
          window.addEventListener("touchend", bdHandleWindowTouchEnd, { passive: false });
          window.addEventListener("touchcancel", bdHandleWindowTouchEnd, { passive: false });
          e.preventDefault();
        },
        { passive: false }
      );
    }

    if (stage) {

      stage.addEventListener(
        "wheel",
        (e) => {
          if (!bdCropState.isOpen) return;
          e.preventDefault();
          bdZoomCropImage(Math.sign(e.deltaY));
        },
        { passive: false }
      );
    }

    return root;
  };

  const bdOpenCropModal = ({ file, side }) => {
    const root = bdEnsureCropModal();
    const img = root.querySelector('[data-bd-crop-image="1"]');
    const placeholder = root.querySelector('[data-bd-crop-placeholder="1"]');
    const note = box.querySelector('[data-bd-crop-note="1"]');
    const cropBox = root.querySelector('[data-bd-crop-box="1"]');
    const designWrap = canvas.querySelector(".cf-design-wrap");

    bdResetCropState();
    bdCropState.isOpen = true;
    bdCropState.side = side === "back" ? "back" : "front";
    bdCropState.file = file || null;

    if (bdIsSvgFile(file)) {
      if (note) {
        note.hidden = false;
        note.textContent = "SVG cropping is skipped in V1. You can continue with the original file.";
      }
    } else if (note) {
      note.hidden = false;
      note.textContent = "Drag the crop area to reposition it. Use the corner brackets to resize, then apply crop.";
    }

    if (file && img) {
      bdCropState.objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        bdCropState.naturalWidth = img.naturalWidth || 0;
        bdCropState.naturalHeight = img.naturalHeight || 0;
        bdInitCropRect();
        bdSyncCropBoxUi();
      };
      img.src = bdCropState.objectUrl;
      img.hidden = false;
    }

    if (placeholder) {
      placeholder.hidden = !!file;
    }

    if (cropBox) {
      cropBox.hidden = !bdCanCropFile(file);
    }

    if (designWrap) {
      designWrap.style.visibility = "";
    }

    if (root.parentNode !== wrap) {
      wrap.appendChild(root);
    }

    root.style.left = "0";
    root.style.top = "0";
    root.style.width = "100%";
    root.style.height = "100%";
    root.hidden = false;
    box.classList.add("bd-crop-open");
    bdSyncCropActionButtons();
    try {
      if (typeof bdUpdateReviewUi === "function") bdUpdateReviewUi();
      if (typeof bdRefreshFinalizeUi === "function") bdRefreshFinalizeUi();
    } catch (e) {}
  };

  const bdPushFileIntoRealInput = ({ side, file, bypassProductState = true, preserveMasterOriginal = true }) => {
    const input = bdGetInputForSide(side);
    if (!input || !file) return false;

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    // Skip only the synthetic crop-apply change so the next real user re-upload
    // on the same side is adopted immediately on its first cycle.
    input.__bdCropBypassCount = bypassProductState ? 1 : 0;
    input.__bdPreserveMasterOriginal = preserveMasterOriginal ? 1 : 0;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  };

  const bdGetCropModalElements = () => {
    const root = box.querySelector('[data-bd-crop-inline="1"]');
    if (!root) return {};
    return {
      root,
      stage: root.querySelector('[data-bd-crop-stage="1"]'),
      img: root.querySelector('[data-bd-crop-image="1"]'),
      cropBox: root.querySelector('[data-bd-crop-box="1"]')
    };
  };

  const bdGetCropImageRect = () => {
    const { img } = bdGetCropModalElements();
    if (!img || img.hidden) return null;
    return {
      x: bdCropState.image.x,
      y: bdCropState.image.y,
      width: bdCropState.image.w,
      height: bdCropState.image.h
    };
  };

  const bdClampCropRectToImage = (rect) => {
    const image = bdCropState.image;
    if (!image.w || !image.h) return { x: 0, y: 0, w: 0, h: 0 };

    const minSize = BD_CROP_MIN_SIZE;
    const maxW = Math.max(minSize, image.w);
    const maxH = Math.max(minSize, image.h);
    const nextW = clamp(Math.round(rect.w || 0), minSize, maxW);
    const nextH = clamp(Math.round(rect.h || 0), minSize, maxH);
    const minX = image.x;
    const maxX = image.x + image.w - nextW;
    const minY = image.y;
    const maxY = image.y + image.h - nextH;

    return {
      x: clamp(Math.round(rect.x || 0), minX, maxX),
      y: clamp(Math.round(rect.y || 0), minY, maxY),
      w: nextW,
      h: nextH
    };
  };

  const bdInitCropRect = () => {
    const { stage } = bdGetCropModalElements();
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height || !bdCropState.naturalWidth || !bdCropState.naturalHeight) return;

    const containScale = Math.min(
      stageRect.width / bdCropState.naturalWidth,
      stageRect.height / bdCropState.naturalHeight
    );
    const safeScale = Math.max(0.01, containScale);
    const imageW = Math.max(1, Math.round(bdCropState.naturalWidth * safeScale));
    const imageH = Math.max(1, Math.round(bdCropState.naturalHeight * safeScale));
    const imageX = Math.round((stageRect.width - imageW) / 2);
    const imageY = Math.round((stageRect.height - imageH) / 2);

    const editorSide = bdGetEditorSideState(bdCropState.side);
    const existingCrop = editorSide && editorSide.crop ? editorSide.crop : null;

    let cropW = Math.max(BD_CROP_MIN_SIZE, Math.round(imageW * 0.72));
    let cropH = Math.max(BD_CROP_MIN_SIZE, Math.round(imageH * 0.72));
    let cropX = Math.round(imageX + (imageW - cropW) / 2);
    let cropY = Math.round(imageY + (imageH - cropH) / 2);
    const isExistingCropForCurrentImage =
      !!(
        existingCrop &&
        existingCrop.w > 0 &&
        existingCrop.h > 0 &&
        existingCrop.naturalWidth === Math.round(bdCropState.naturalWidth || 0) &&
        existingCrop.naturalHeight === Math.round(bdCropState.naturalHeight || 0)
      );

    if (isExistingCropForCurrentImage) {
      cropX = Math.round(imageX + existingCrop.x * safeScale);
      cropY = Math.round(imageY + existingCrop.y * safeScale);
      cropW = Math.max(BD_CROP_MIN_SIZE, Math.round(existingCrop.w * safeScale));
      cropH = Math.max(BD_CROP_MIN_SIZE, Math.round(existingCrop.h * safeScale));
    } else if (existingCrop) {
      cropW = Math.max(BD_CROP_MIN_SIZE, Math.round(imageW * 0.88));
      cropH = Math.max(BD_CROP_MIN_SIZE, Math.round(imageH * 0.88));
      cropX = Math.round(imageX + (imageW - cropW) / 2);
      cropY = Math.round(imageY + (imageH - cropH) / 2);
    }

    bdCropState.stage = { x: 0, y: 0, w: stageRect.width, h: stageRect.height };
    bdCropState.image = {
      x: imageX,
      y: imageY,
      w: imageW,
      h: imageH,
      scale: safeScale
    };
    bdCropState.cropRect = bdClampCropRectToImage({
      x: cropX,
      y: cropY,
      w: cropW,
      h: cropH
    });
  };

  const bdSyncCropBoxUi = () => {
    const { cropBox, img } = bdGetCropModalElements();
    if (!cropBox || !img || !bdCropState.cropRect.w || !bdCropState.image.w) return;

    bdCropState.cropRect = bdClampCropRectToImage(bdCropState.cropRect);
    cropBox.hidden = false;
    cropBox.style.left = `${bdCropState.cropRect.x}px`;
    cropBox.style.top = `${bdCropState.cropRect.y}px`;
    cropBox.style.width = `${bdCropState.cropRect.w}px`;
    cropBox.style.height = `${bdCropState.cropRect.h}px`;
    cropBox.classList.toggle(
      "is-compact",
      bdCropState.cropRect.w <= 84 || bdCropState.cropRect.h <= 84
    );

    img.style.width = `${bdCropState.image.w}px`;
    img.style.height = `${bdCropState.image.h}px`;
    img.style.left = `${bdCropState.image.x}px`;
    img.style.top = `${bdCropState.image.y}px`;
  };

  const bdGetCropExportSpec = () => {
    const file = bdCropState.file;
    const cropRect = bdCropState.cropRect;
    const image = bdCropState.image;
    if (!file || !cropRect.w || !cropRect.h || !image.w || !image.h) return null;

    const scaleX = bdCropState.naturalWidth / image.w;
    const scaleY = bdCropState.naturalHeight / image.h;
    const srcX = Math.max(0, Math.round((cropRect.x - image.x) * scaleX));
    const srcY = Math.max(0, Math.round((cropRect.y - image.y) * scaleY));
    const srcW = Math.min(
      bdCropState.naturalWidth - srcX,
      Math.max(1, Math.round(cropRect.w * scaleX))
    );
    const srcH = Math.min(
      bdCropState.naturalHeight - srcY,
      Math.max(1, Math.round(cropRect.h * scaleY))
    );

    return {
      srcX,
      srcY,
      srcW,
      srcH,
      cropRect: {
        x: Math.round(cropRect.x),
        y: Math.round(cropRect.y),
        w: Math.round(cropRect.w),
        h: Math.round(cropRect.h)
      },
      cropMeta: {
        x: srcX,
        y: srcY,
        w: srcW,
        h: srcH,
        naturalWidth: Math.round(bdCropState.naturalWidth || 0),
        naturalHeight: Math.round(bdCropState.naturalHeight || 0)
      }
    };
  };

  const bdGetCropPlacementCompensation = (side) => {
    const s = side === "back" ? "back" : "front";
    const activeState = s === "back" ? stateBack : stateFront;
    const cropRect = bdCropState.cropRect;
    if (!activeState || !cropRect.w || !cropRect.h) return null;

    const left = activeState.cx - activeState.w / 2;
    const top = activeState.cy - activeState.h / 2;

    return {
      cx: Math.round(left + cropRect.x + cropRect.w / 2),
      cy: Math.round(top + cropRect.y + cropRect.h / 2),
      w: Math.round(cropRect.w),
      h: Math.round(cropRect.h)
    };
  };

  const bdExportCroppedFile = async () => {
    const { img } = bdGetCropModalElements();
    const file = bdCropState.file;
    const spec = bdGetCropExportSpec();
    if (!img || !file || !spec) return null;

    const { srcX, srcY, srcW, srcH, cropMeta } = spec;
    const outType = file.type === "image/jpeg" || file.type === "image/webp" ? file.type : "image/png";
    const ext = outType === "image/jpeg" ? "jpg" : outType === "image/webp" ? "webp" : "png";

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = srcW;
    cropCanvas.height = srcH;

    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, srcW, srcH);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    const blob = await new Promise((resolve, reject) => {
      cropCanvas.toBlob(
        (nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error("Failed to export cropped image"));
        },
        outType,
        0.92
      );
    });

    const baseName = (file.name || "design").replace(/\.[^.]+$/, "");
    return {
      file: new File([blob], `${baseName}-cropped.${ext}`, {
        type: outType,
        lastModified: Date.now()
      }),
      cropMeta
    };
  };

  const bdZoomCropImage = (delta) => {
    const image = bdCropState.image;
    const cropRect = bdCropState.cropRect;
    if (!image.w || !image.h || !cropRect.w || !cropRect.h) return;

    const step = delta > 0 ? 0.92 : 1.08;
    const centerX = cropRect.x + cropRect.w / 2;
    const centerY = cropRect.y + cropRect.h / 2;
    let nextW = Math.round(cropRect.w * step);
    let nextH = Math.round(cropRect.h * step);

    nextW = clamp(nextW, BD_CROP_MIN_SIZE, image.w);
    nextH = clamp(nextH, BD_CROP_MIN_SIZE, image.h);

    bdCropState.cropRect = bdClampCropRectToImage({
      x: Math.round(centerX - nextW / 2),
      y: Math.round(centerY - nextH / 2),
      w: nextW,
      h: nextH
    });

    bdSyncCropBoxUi();
  };

  // --------------------------
  // Inline Upload Buttons (SAFE)
  // - Does NOT create new file inputs
  // - Only triggers existing #cfUploadFront / #cfUploadBack
  // --------------------------
  const bdGetScopedProductRoot = () =>
    box.closest("product-info") ||
    box.closest(".shopify-section") ||
    document;

  const bdMountSharedUploadNotice = () => {
    let notice = bdGetScopedProductRoot().querySelector("[data-cf-upload-notice]");
    const bar = box.querySelector("[data-bd-inline-upload='1']");
    if (!bar || !bar.parentNode) return;

    if (!notice) {
      notice = document.createElement("div");
      notice.className = "cf-uploader__notice";
      notice.setAttribute("data-cf-upload-notice", "");
      notice.innerHTML = `
        <p class="cf-uploader__notice-text">
          <span>Upload only images you have rights to use - no copyrighted or trademarked content.</span>
          <span class="cf-uploader__notice-tooltip-wrap">
            <button
              type="button"
              class="cf-uploader__notice-trigger"
              aria-label="About upload rights"
              aria-describedby="BDUploadNoticeTooltipInline"
            >i</button>
            <span
              id="BDUploadNoticeTooltipInline"
              class="cf-uploader__notice-tooltip"
              role="tooltip"
            >
              You must have the legal right to use any image you upload. Do not upload copyrighted or trademarked content without authorization.
            </span>
          </span>
        </p>
      `;
    }

    notice.style.marginTop = "6px";
    notice.style.marginBottom = "0";
    if (notice.parentNode !== bar.parentNode || notice.previousElementSibling !== bar) {
      bar.insertAdjacentElement("afterend", notice);
    }
  };

  const bdPlaceSideToggleAboveInlineUpload = () => {
    const toggle = box.querySelector(".bd-side-toggle");
    const bar = box.querySelector("[data-bd-inline-upload='1']");
    if (!toggle || !bar || !bar.parentNode) return;
    if (toggle.parentNode !== bar.parentNode || toggle.nextElementSibling !== bar) {
      bar.insertAdjacentElement("beforebegin", toggle);
    }
  };

  const bdRevealProofAreaAfterFinalize = () => {
    const reviewWrap = box.querySelector("[data-bd-proof-review-wrap='1']");
    const reviewStatus = box.querySelector("[data-bd-finalize-status='1']");
    const target = (reviewWrap && !reviewWrap.hidden && reviewWrap) || reviewStatus;
    if (!target) return;

    try {
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!viewportHeight) return;
      const offset = 108;
      const desiredTop = Math.max(0, rect.top + window.scrollY - offset);
      const needsReveal = rect.bottom > viewportHeight - 40 || rect.top < 0;
      if (!needsReveal) return;
      window.scrollTo({ top: desiredTop, behavior: "smooth" });
    } catch (e) {}
  };

  const bdEnsureSafePrintWarning = () => {
    const panel = box.querySelector("[data-bd-upload-info='1']");
    if (!panel) return null;
    let warning = panel.querySelector("[data-bd-safe-print-warning='1']");
    if (!warning) {
      warning = document.createElement("div");
      warning.className = "bd-soft-print-warning";
      warning.setAttribute("data-bd-safe-print-warning", "1");
      warning.hidden = true;
      const reviewActions = panel.querySelector("[data-bd-finalize-actions='1']");
      if (reviewActions) {
        reviewActions.insertAdjacentElement("beforebegin", warning);
      } else {
        panel.appendChild(warning);
      }
    }
    return warning;
  };

  const bdEnsureInlineUploadUI = () => {
    // Prevent duplicates (theme section reload, etc.)
    if (box.querySelector("[data-bd-inline-upload='1']") && box.querySelector("[data-bd-upload-info='1']")) {
      bdPlaceSideToggleAboveInlineUpload();
      bdMountSharedUploadNotice();
      bdEnsureSafePrintWarning();
      return;
    }

    // Put it inside designer body if available, otherwise inside container
    const host = designerBody || box;

    const bar = document.createElement("div");
    bar.setAttribute("data-bd-inline-upload", "1");
    bar.setAttribute("data-bd-inline-actions", "1");
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.gap = "10px";
    bar.style.alignItems = "center";
    bar.style.margin = "12px 0";
    bar.style.padding = "10px 12px";
    bar.style.border = "1px solid rgba(0,0,0,.12)";
    bar.style.borderRadius = "10px";

    const title = document.createElement("div");
    title.setAttribute("data-bd-inline-title", "1");
    title.textContent = "Upload your design:";
    title.style.fontSize = "14px";
    title.style.fontWeight = "600";
    title.style.flexBasis = "100%";

    const btnFront = document.createElement("button");
    btnFront.type = "button";
      btnFront.textContent = "Upload Front";
    btnFront.setAttribute("data-bd-inline-front", "1");
    btnFront.className = "button button--secondary"; // Dawn button styling
    btnFront.style.flex = "1";

    const btnCrop = document.createElement("button");
    btnCrop.type = "button";
    btnCrop.textContent = "Crop Image";
    btnCrop.setAttribute("data-bd-inline-crop", "1");
    btnCrop.className = "button button--secondary";
    btnCrop.style.flex = "1";
    btnCrop.style.display = "none";

    const btnCropCancel = document.createElement("button");
    btnCropCancel.type = "button";
    btnCropCancel.textContent = "Cancel";
    btnCropCancel.setAttribute("data-bd-inline-crop-cancel", "1");
    btnCropCancel.className = "button button--secondary";
    btnCropCancel.style.flex = "1";
    btnCropCancel.style.display = "none";

    const btnCropOriginal = document.createElement("button");
    btnCropOriginal.type = "button";
    btnCropOriginal.textContent = "Load original image";
    btnCropOriginal.setAttribute("data-bd-inline-crop-original", "1");
    btnCropOriginal.className = "button button--secondary";
    btnCropOriginal.style.flex = "1";
    btnCropOriginal.style.display = "none";

    const btnCropApply = document.createElement("button");
    btnCropApply.type = "button";
    btnCropApply.textContent = "Apply crop";
    btnCropApply.setAttribute("data-bd-inline-crop-apply", "1");
    btnCropApply.className = "button button--primary";
    btnCropApply.style.flex = "1";
    btnCropApply.style.display = "none";

    const btnBack = document.createElement("button");
    btnBack.type = "button";
    btnBack.textContent = "Upload Back";
    btnBack.setAttribute("data-bd-inline-back", "1");
    btnBack.className = "button button--secondary";
    btnBack.style.flex = "1";

    const btnFinalize = document.createElement("button");
    btnFinalize.type = "button";
    btnFinalize.textContent = "Finalize Design";
    btnFinalize.setAttribute("data-bd-finalize-btn", "1");
    btnFinalize.className = "button button--primary";
    btnFinalize.style.flex = "1";
    btnFinalize.hidden = true;

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.textContent = "Edit Design";
    btnEdit.setAttribute("data-bd-edit-btn", "1");
    btnEdit.className = "button button--secondary";
    btnEdit.style.flex = "1";
    btnEdit.hidden = true;

    const hint = document.createElement("div");
    hint.setAttribute("data-bd-inline-hint", "1");
    hint.style.display = "none";

    bar.appendChild(title);
    bar.appendChild(btnFront);
    bar.appendChild(btnCrop);
    bar.appendChild(btnCropCancel);
    bar.appendChild(btnCropOriginal);
    bar.appendChild(btnCropApply);
    bar.appendChild(btnBack);

    const panel = document.createElement("div");
    panel.setAttribute("data-bd-upload-info", "1");
    panel.style.margin = "12px 0";
    panel.style.padding = "12px";
    panel.style.border = "1px solid rgba(0,0,0,.12)";
    panel.style.borderRadius = "10px";
    panel.style.textAlign = "left";

    const help = document.createElement("div");
    help.setAttribute("data-bd-upload-help", "1");
    help.style.fontSize = "13px";
    help.style.opacity = "0.8";

    const status = document.createElement("div");
    status.setAttribute("data-bd-upload-status", "1");
    status.style.marginTop = "8px";
    status.style.fontSize = "14px";
    status.style.fontWeight = "600";

    const meta = document.createElement("div");
    meta.setAttribute("data-bd-upload-meta", "1");
    meta.style.marginTop = "6px";
    meta.style.fontSize = "13px";
    meta.style.opacity = "0.85";

    const previewWrap = document.createElement("div");
    previewWrap.setAttribute("data-bd-upload-preview-wrap", "1");
    previewWrap.style.marginTop = "10px";
    previewWrap.hidden = true;

    const previewImg = document.createElement("img");
    previewImg.setAttribute("data-bd-upload-preview-img", "1");
    previewImg.alt = "Uploaded design summary";
    previewImg.style.display = "block";
    previewImg.style.maxWidth = "120px";
    previewImg.style.height = "auto";
    previewImg.style.border = "1px solid rgba(0,0,0,.1)";
    previewImg.style.borderRadius = "8px";

    previewWrap.appendChild(previewImg);
    panel.appendChild(help);
    panel.appendChild(status);
    panel.appendChild(meta);
    panel.appendChild(previewWrap);

    const reviewStatus = document.createElement("div");
    reviewStatus.setAttribute("data-bd-finalize-status", "1");
    reviewStatus.className = "bd-proof-review-status";
    panel.appendChild(reviewStatus);

    const safePrintWarning = document.createElement("div");
    safePrintWarning.className = "bd-soft-print-warning";
    safePrintWarning.setAttribute("data-bd-safe-print-warning", "1");
    safePrintWarning.hidden = true;
    panel.appendChild(safePrintWarning);

    const reviewActions = document.createElement("div");
    reviewActions.setAttribute("data-bd-finalize-actions", "1");
    reviewActions.className = "bd-proof-review-actions";
    reviewActions.appendChild(btnFinalize);
    reviewActions.appendChild(btnEdit);
    panel.appendChild(reviewActions);

    const reviewWrap = document.createElement("div");
    reviewWrap.setAttribute("data-bd-proof-review-wrap", "1");
    reviewWrap.className = "bd-proof-review-wrap";
    reviewWrap.hidden = true;
    panel.appendChild(reviewWrap);

    // Insert near the top of the designer UI (so it's visible immediately)
    if (designerBody && designerBody.firstChild) {
      designerBody.insertBefore(bar, designerBody.firstChild);
    } else {
      host.insertBefore(bar, host.firstChild);
    }

    const previewCanvas = box.querySelector(".cf-preview-canvas");
    if (previewCanvas && previewCanvas.parentNode) {
      previewCanvas.insertAdjacentElement("afterend", panel);
    } else {
      bar.insertAdjacentElement("afterend", panel);
    }

    bdPlaceSideToggleAboveInlineUpload();
    bdMountSharedUploadNotice();

    // Click handlers: trigger the REAL inputs
    btnFront.addEventListener("click", () => {
      if (bdCropState.isOpen) return;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const inp = document.getElementById("cfUploadFront") || inputFront;
      try {
        bdRememberPreferredActiveSide("front");
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide("front");
        } else {
          bdSetActiveSideUi("front");
          bdUseSideState("front");
          if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup("front");
        }
      } catch (e) {}
      requestAnimationFrame(() => {
        try {
          window.scrollTo(scrollX, scrollY);
        } catch (err) {}
        setTimeout(() => {
          try {
            window.scrollTo(scrollX, scrollY);
          } catch (err) {}
        }, 140);
      });
      if (inp) inp.click();
    });

    btnBack.addEventListener("click", () => {
      if (bdCropState.isOpen) return;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const inp = document.getElementById("cfUploadBack") || inputBack;
      try {
        bdRememberPreferredActiveSide("back");
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide("back");
        } else {
          bdSetActiveSideUi("back");
          bdUseSideState("back");
          if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup("back");
        }
      } catch (e) {}
      requestAnimationFrame(() => {
        try {
          window.scrollTo(scrollX, scrollY);
        } catch (err) {}
        setTimeout(() => {
          try {
            window.scrollTo(scrollX, scrollY);
          } catch (err) {}
        }, 140);
      });
      if (inp) inp.click();
    });

    btnCrop.addEventListener("click", async () => {
      const side = bdGetMirrorSide();
      let currentFile = bdGetCurrentFileForSide(side);
      if (!currentFile) {
        currentFile = await bdReadWorkingUploadFileForSide(side);
        if (currentFile) {
          bdSetOriginalEditorFile(side, currentFile);
          bdWriteEditorMetaForSide(side);
        }
      }
      if (!currentFile || !bdCanCropFile(currentFile)) return;
      bdOpenCropModal({ file: currentFile, side });
    });

    btnCropCancel.addEventListener("click", () => {
      bdCloseCropModal();
    });

    btnCropOriginal.addEventListener("click", async () => {
      const side = bdCropState.side;
      const editorSide = bdGetEditorSideState(side);
      const note = box.querySelector('[data-bd-crop-note="1"]');
      const file = editorSide.originalFile || await bdReadMasterOriginalFileForSide(side);
      if (!file) {
        if (note) {
          note.hidden = false;
          note.textContent = "Original image is not available on this device anymore. Please upload it again to restore it.";
        }
        return;
      }
      bdCropState.usingOriginal = true;
      bdCloseCropModal();
      if (file) {
        bdSetOriginalEditorFile(side, file);
        bdSetEditorCropMeta(side, null);
        bdWriteEditorMetaForSide(side);
        setDesignFromFile(file, side, { resetPlacement: false });
        bdPushFileIntoRealInput({
          side,
          file,
          bypassProductState: false,
          preserveMasterOriginal: true
        });
      }
    });

    btnCropApply.addEventListener("click", async () => {
      const side = bdCropState.side;
      const file = bdCropState.file;
      if (!file || !bdCanCropFile(file)) return;
      try {
        const placementOverride = bdGetCropPlacementCompensation(side);
        const cropResult = await bdExportCroppedFile();
        bdCloseCropModal();
        if (cropResult && cropResult.file) {
          bdSetEditorCropMeta(side, cropResult.cropMeta || null);
          bdWriteEditorMetaForSide(side);
          setDesignFromFile(cropResult.file, side, {
            resetPlacement: false,
            placementOverride
          });
          bdPushFileIntoRealInput({ side, file: cropResult.file });
        }
      } catch (err) {
        console.error("Crop export failed", err);
      }
    });

    btnFinalize.addEventListener("click", () => {
      if (bdIsCropPending()) {
        try {
          if (typeof bdUpdateReviewUi === "function") bdUpdateReviewUi();
          if (typeof bdRefreshFinalizeUi === "function") bdRefreshFinalizeUi();
        } catch (e) {}
        return;
      }
      bdFinalizeDesignProofs();
    });

    btnEdit.addEventListener("click", () => {
      bdEnterEditDesignMode();
    });

    const bdSyncInlineUploadInfo = () => {
      const currentPanel = box.querySelector("[data-bd-upload-info='1']");
      if (!currentPanel) return;

      const side = bdGetMirrorSide();
      const idx = side === "back" ? "2" : "1";
      const realBlock = bdGetRealUploadBlock(side);
      if (!realBlock) return;

      const helpSource = realBlock.querySelector(".cf-uploader__help");
      const statusSource = realBlock.querySelector('[data-status="' + idx + '"]');
      const metaSource = realBlock.querySelector('[data-meta="' + idx + '"]');
      const previewWrapSource = realBlock.querySelector('[data-preview-wrap="' + idx + '"]');
      const previewImgSource = realBlock.querySelector('[data-preview-img="' + idx + '"]');

      const helpTarget = currentPanel.querySelector("[data-bd-upload-help='1']");
      const statusTarget = currentPanel.querySelector("[data-bd-upload-status='1']");
      const metaTarget = currentPanel.querySelector("[data-bd-upload-meta='1']");
      const previewWrapTarget = currentPanel.querySelector("[data-bd-upload-preview-wrap='1']");
      const previewImgTarget = currentPanel.querySelector("[data-bd-upload-preview-img='1']");
      const cropBtn = box.querySelector('[data-bd-inline-crop="1"]');

      const helpText = "PNG/JPG/SVG. Preferred file size is under 10MB. Larger files can still be previewed, but the final production file must be emailed after ordering.";
      const sourceStatusText = statusSource ? String(statusSource.textContent || "").trim() : "";
      const sourceStatusType = statusSource ? String(statusSource.dataset.type || "").trim() : "";
      const metaText = metaSource ? metaSource.textContent.trim() : "";
      const activeInput = side === "back" ? inputBack : inputFront;
      const activeFile = activeInput && activeInput.files && activeInput.files[0] ? activeInput.files[0] : null;
      const fileSizeText = activeFile
        ? activeFile.size >= 1024 * 1024
          ? `${(activeFile.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(activeFile.size / 1024))} KB`
        : "";
      const filenameText = activeFile && activeFile.name ? activeFile.name : "";
      const dimensionMatch = metaText.match(/(\d+\s*\D+\s*\d+\s*px)/i);
      const dimensionText = dimensionMatch ? dimensionMatch[1].replace(/\s*\D+\s*/i, " x ") : "";
      const dimensionNums = dimensionText.match(/(\d+)\s*x\s*(\d+)/i);
      const longSide = dimensionNums ? Math.max(Number(dimensionNums[1]), Number(dimensionNums[2])) : 0;
      const qualityText = longSide > 0
        ? longSide < 2000
          ? "WARNING Low resolution (recommended: 2000px+)"
          : "Resolution OK"
        : "";
      const previewSrc = previewImgSource
        ? previewImgSource.currentSrc || previewImgSource.getAttribute("src") || ""
        : "";
      const showPreview = !!previewSrc && !(previewWrapSource && previewWrapSource.hidden);
      const existingPreviewSrc = previewImgTarget
        ? previewImgTarget.currentSrc || previewImgTarget.getAttribute("src") || ""
        : "";
      const existingStatusText = statusTarget ? statusTarget.textContent || "" : "";
      const existingMetaText = metaTarget ? metaTarget.textContent || "" : "";
      const isCancelNoop = !activeFile && !!(existingPreviewSrc || existingStatusText || existingMetaText);
      const keepExistingPreview =
        !showPreview &&
        !activeFile &&
        !!(existingPreviewSrc || existingStatusText || existingMetaText);

      if (helpTarget) {
        helpTarget.textContent = helpText;
        helpTarget.style.display = helpText ? "" : "none";
      }

      if (statusTarget) {
        const isLargeUploadMessage = /larger than\s*10mb/i.test(sourceStatusText) || /email/i.test(sourceStatusText);
        const isLowResUploadMessage = /low resolution/i.test(sourceStatusText);
        const uploadStatusText = sourceStatusText || (previewSrc ? "Image uploaded successfully" : "");
        const nextStatusText = isLargeUploadMessage || isLowResUploadMessage
          ? uploadStatusText
          : [uploadStatusText, qualityText].filter(Boolean).join(" | ");
        statusTarget.textContent = isCancelNoop ? existingStatusText : (keepExistingPreview && !nextStatusText ? existingStatusText : nextStatusText);
        statusTarget.style.display = statusTarget.textContent ? "" : "none";
        statusTarget.style.color =
          isLargeUploadMessage || sourceStatusType === "warn" || (longSide > 0 && longSide < 2000)
            ? "#8a6d00"
            : sourceStatusType === "error"
              ? "#b42318"
              : "";
      }

      if (metaTarget) {
        const metaParts = [];
        if (dimensionText) metaParts.push(dimensionText);
        if (fileSizeText) metaParts.push(fileSizeText);

        const nextMetaText = [filenameText, metaParts.join(" | ")].filter(Boolean).join("\n");
        metaTarget.textContent = isCancelNoop ? existingMetaText : (keepExistingPreview && !nextMetaText ? existingMetaText : nextMetaText);
        metaTarget.style.whiteSpace = "pre-line";
        metaTarget.style.display = metaTarget.textContent ? "" : "none";
      }

      if (previewImgTarget) {
        if (showPreview) {
          previewImgTarget.src = previewSrc;
        } else if (!keepExistingPreview) {
          previewImgTarget.removeAttribute("src");
        }
      }

      if (previewWrapTarget) {
        previewWrapTarget.hidden = keepExistingPreview ? false : !showPreview;
      }

      if (cropBtn) {
        const originalFile = bdCropState.originalBySide[side];
        cropBtn.style.display = originalFile && bdCanCropFile(originalFile) ? "" : "none";
      }

      bdSyncCropActionButtons();
    };

    [inputFront, inputBack].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("change", () => {
        requestAnimationFrame(bdSyncInlineUploadInfo);
        setTimeout(bdSyncInlineUploadInfo, 50);
        setTimeout(bdSyncInlineUploadInfo, 250);
        setTimeout(bdSyncInlineUploadInfo, 800);
      });
    });

    const sideToggle = box.querySelector(".bd-side-toggle");
    if (sideToggle) {
      sideToggle.addEventListener("click", () => {
        requestAnimationFrame(bdSyncInlineUploadInfo);
      });
    }

    ["front", "back"].forEach((side) => {
      const realBlock = bdGetRealUploadBlock(side);
      if (!realBlock || !window.MutationObserver) return;

      const mo = new MutationObserver(() => bdSyncInlineUploadInfo());
      mo.observe(realBlock, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["src", "hidden", "data-type", "style"]
      });
    });

    requestAnimationFrame(bdSyncInlineUploadInfo);
    requestAnimationFrame(() => {
      try {
        if (typeof bdUpdateReviewUi === "function") bdUpdateReviewUi();
      } catch (e) {}
    });
  };

  // Create once (safe even if Start Gate is enabled; weÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ll show/hide naturally)
  bdSyncResolvedPreviewMode();
  bdEnsureInlineUploadUI();

  // --------------------------
  // Apply product config to UI
  // --------------------------
  const bdApplyProductConfigUi = () => {
    const toggle = box.querySelector(".bd-side-toggle");
    const frontSideBtn = box.querySelector('.bd-side-btn[data-bd-side="front"]');
    const backSideBtn = box.querySelector('.bd-side-btn[data-bd-side="back"]');

    const inlineFrontBtn = box.querySelector('[data-bd-inline-front="1"]');
    const inlineBackBtn = box.querySelector('[data-bd-inline-back="1"]');
    const inlineCropBtn = box.querySelector('[data-bd-inline-crop="1"]');
    const inlineCropCancelBtn = box.querySelector('[data-bd-inline-crop-cancel="1"]');
    const inlineCropOriginalBtn = box.querySelector('[data-bd-inline-crop-original="1"]');
    const inlineCropApplyBtn = box.querySelector('[data-bd-inline-crop-apply="1"]');
    const inlineHint = box.querySelector('[data-bd-inline-hint="1"]');
    const inlineTitle = box.querySelector('[data-bd-inline-title="1"]');

    if (bdIsFrontOnlyMode()) {
      if (frontSideBtn) frontSideBtn.style.display = "none";
      if (backSideBtn) backSideBtn.style.display = "none";
      if (toggle) toggle.style.display = "none";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "";
      if (inlineFrontBtn) inlineFrontBtn.textContent = "Upload Front";
      if (inlineBackBtn) inlineBackBtn.style.display = "none";
      if (inlineTitle) inlineTitle.style.display = "none";
      if (inlineHint) inlineHint.textContent = "Upload your front design to preview it on the selected shirt color.";

      bdSetActiveSideUi("front");
    } else if (bdIsBackOnlyMode()) {
      if (frontSideBtn) frontSideBtn.style.display = "none";
      if (backSideBtn) backSideBtn.style.display = "";
      if (toggle) toggle.style.display = backSideBtn ? "" : "none";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "none";
      if (inlineBackBtn) inlineBackBtn.style.display = "";
      if (inlineBackBtn) inlineBackBtn.textContent = "Upload Back";
      if (inlineTitle) inlineTitle.style.display = "";
      if (inlineHint) inlineHint.textContent = "Upload your back design to preview it on the selected shirt color.";

      bdSetActiveSideUi("back");
    } else {
      if (frontSideBtn) frontSideBtn.style.display = "";
      if (backSideBtn) backSideBtn.style.display = "";
      if (toggle) toggle.style.display = "";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "";
      if (inlineBackBtn) inlineBackBtn.style.display = "";
      if (inlineFrontBtn) inlineFrontBtn.textContent = "Upload Front";
      if (inlineBackBtn) inlineBackBtn.textContent = "Upload Back";
      if (inlineTitle) inlineTitle.style.display = "";
      if (inlineHint) inlineHint.textContent = "Tip: Use the Front/Back toggle above to preview each side.";

      bdSetActiveSideUi(bdGetActiveSide());
    }

    if (inlineCropBtn || inlineCropCancelBtn || inlineCropOriginalBtn || inlineCropApplyBtn) {
      bdSyncCropActionButtons();
    }
  };

  bdApplyProductConfigUi();

  // --------------------------
  // Start Designing gate
  // --------------------------
  const bdStartGateEnabled = box.getAttribute("data-cf-start-gate") === "1" || box.dataset.cfStartGate === "1";

  const bdGetUploadBlocks = () => {
    const blocks = [];

    const addBlockFromInput = (inp) => {
      if (!inp) return;
      const blk =
        inp.closest(".cf-uploader__block") ||
        inp.closest(".custom-fields-uploader") ||
        inp.closest(".product-form__input") ||
        inp.parentElement;
      if (blk && !blocks.includes(blk)) blocks.push(blk);
    };

    addBlockFromInput(inputFront);
    addBlockFromInput(inputBack);

    if (!blocks.length) {
      box.querySelectorAll(".cf-uploader__block, .custom-fields-uploader").forEach((el) => blocks.push(el));
    }

    return blocks;
  };

  const bdSetUploadBlocksVisible = (visible) => {
    bdGetUploadBlocks().forEach((blk) => {
      blk.style.display = visible ? "" : "none";
    });
  };

  const bdGetMediaGallery = () =>
    box.closest(".shopify-section")?.querySelector("media-gallery") || document.querySelector("media-gallery");

  const bdGetThumbnailSlider = () => bdGetMediaGallery()?.querySelector('[id^="GalleryThumbnails-"]') || null;

  const bdEnsureThumbnailLockNotice = () => {
    const slider = bdGetThumbnailSlider();
    if (!slider) return null;
    let notice = slider.parentElement ? slider.parentElement.querySelector("[data-bd-apparel-thumb-lock-note]") : null;
    if (notice) return notice;
    notice = document.createElement("p");
    notice.setAttribute("data-bd-apparel-thumb-lock-note", "");
    notice.className = "bd-apparel-thumbnail-lock-note";
    notice.hidden = true;
    notice.textContent = "While designing, product gallery thumbnails are unavailable.";
    slider.insertAdjacentElement("afterend", notice);
    return notice;
  };

  const bdActivateDesignPreviewMedia = () => {
    const slide =
      box.closest(".shopify-section")?.querySelector('[data-bd-design-preview-slide="1"]') ||
      document.querySelector('[data-bd-design-preview-slide="1"]');
    const mediaId = slide ? String(slide.getAttribute("data-media-id") || "").trim() : "";
    if (!mediaId || typeof window.bdGalleryActivateMedia !== "function") return;
    try {
      window.bdGalleryActivateMedia(mediaId);
    } catch (e) {}
  };

  const bdSyncThumbnailLockState = () => {
    const gallery = bdGetMediaGallery();
    if (!gallery) return;
    const isLocked = !!(bdStartGateEnabled && box.classList.contains("is-open"));
    gallery.classList.toggle("bd-apparel-thumbs-locked", isLocked);

    const notice = bdEnsureThumbnailLockNotice();
    if (notice) notice.hidden = !isLocked;

    gallery.querySelectorAll("button.thumbnail").forEach((button) => {
      const isBlockedThumb = isLocked && !!String(button.getAttribute("data-target") || "").trim();
      button.classList.toggle("is-apparel-thumb-locked", isBlockedThumb);
      button.setAttribute("aria-disabled", isBlockedThumb ? "true" : "false");
      button.disabled = isBlockedThumb;
      if (isBlockedThumb) {
        button.setAttribute("title", "Finish designing before browsing other product images.");
      } else {
        button.removeAttribute("title");
      }
    });
  };

  const bdOpenDesignerUi = (opts = {}) => {
    const suppressAutoStartSide = !!(opts && opts.suppressAutoStartSide);
    const suppressScroll = !!(opts && opts.suppressScroll);
    box.classList.remove("is-hidden");
    box.classList.add("is-open");
    if (designerBody) {
      designerBody.hidden = false;
      designerBody.removeAttribute("hidden");
      designerBody.style.display = "";
      designerBody.style.visibility = "";
      designerBody.style.opacity = "";
    }
    bdSyncThumbnailLockState();

    if (startRow) startRow.style.display = "none";
    bdSetUploadBlocksVisible(true);


    
    // If user has not manually interacted with variants yet,
    // switch preview from product featured image to first variant image
    try {
      const firstVariantSrc = (box.dataset.firstVariantSrc || "").trim();
      const base = canvas.querySelector(".cf-preview-base");

      if (
        firstVariantSrc &&
        base &&
        !document.documentElement.classList.contains("variant-interacted")
      ) {
        base.setAttribute("data-front-src", firstVariantSrc);

        if (bdIsFrontOnlyMode()) {
          base.setAttribute("data-back-src", firstVariantSrc);
        }

        base.src = firstVariantSrc;
      }
    } catch (e) {}


    requestAnimationFrame(() => {
      try {
        bdUpdatePrintZoneFromInches();
      } catch (e) {}
      try {
        if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate();
      } catch (e) {}
      bdScheduleSoftPrintRefresh();
    });

  
  // UX: On Start, land user on the correct preview side + highlight the right upload button
  requestAnimationFrame(() => {
    const uiSide = bdGetActiveSide();

    if (!suppressAutoStartSide) {
      try {
        const bdStartSide = bdIsBackOnlyMode() ? "back" : "front";
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide(bdStartSide);
        } else {
          bdSetActiveSideUi(bdStartSide);
        }
      } catch (e) {}
    }

    if (!suppressScroll) {
      try {
        const bar = box.querySelector("[data-bd-inline-upload='1']");
        if (bar) bar.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) {}
    }

    try {
      const fBtn = box.querySelector("[data-bd-inline-front='1']");
      const bBtn = box.querySelector("[data-bd-inline-back='1']");
      const useBack = suppressAutoStartSide ? uiSide === "back" : bdIsBackOnlyMode();

      if (fBtn) {
        fBtn.style.outline = useBack ? "" : "2px solid rgba(0,0,0,.25)";
        fBtn.style.outlineOffset = useBack ? "" : "2px";
      }

      if (bBtn) {
        bBtn.style.outline = useBack ? "2px solid rgba(0,0,0,.25)" : "";
        bBtn.style.outlineOffset = useBack ? "2px" : "";
      }
    } catch (e) {}
  });
    
  };

  if (bdStartGateEnabled) {

  box.classList.remove("is-hidden");
  box.classList.remove("is-open");

  if (designerBody) {
    designerBody.hidden = true;
    designerBody.setAttribute("hidden", "");
  }

  bdSetUploadBlocksVisible(false);
  bdSyncThumbnailLockState();

  if (startBtn && !startBtn.__bdStartBound) {
    startBtn.__bdStartBound = true;
    startBtn.addEventListener("click", () => bdOpenDesignerUi());
  }
}

  const bdMediaGallery = bdGetMediaGallery();
  bdMediaGallery?.addEventListener(
    "click",
    (event) => {
      if (!(bdStartGateEnabled && box.classList.contains("is-open"))) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const thumbButton = target.closest("button.thumbnail");
      if (!thumbButton) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      bdActivateDesignPreviewMedia();
    },
    true
  );
  bdMediaGallery?.addEventListener(
    "keydown",
    (event) => {
      if (!(bdStartGateEnabled && box.classList.contains("is-open"))) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const thumbButton = target.closest("button.thumbnail");
      if (!thumbButton) return;
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      event.stopImmediatePropagation();
      bdActivateDesignPreviewMedia();
    },
    true
  );

  // --------------------------
  // Line item properties
  // --------------------------
  const bdFindCartForm = () => {
    const scope =
      box.closest("product-info") ||
      document.getElementById("MainProduct-" + (box.dataset.section || "")) ||
      document;

    return (
      scope.querySelector('form[data-type="add-to-cart-form"]') ||
      scope.querySelector('form[action^="/cart/add"]:not(.installment)') ||
      document.querySelector('form[data-type="add-to-cart-form"]') ||
      document.querySelector('form[action^="/cart/add"]:not(.installment)') ||
      null
    );
  };

  const BD_UPLOAD_NOTICE_TEXT = "Your image is larger than 10MB, but no worries-you can still edit and preview your design. After placing your order, just email your image to info@sarvsartsandcrafts.com, and we'll handle the proof for you.";
  const BD_DRAFT_SESSION_PREFIX = "bd:tshirt-draft:";

  const bdSafeJsonParse = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const bdIsDurableRestoreUrl = (url) => /^(https?:)?\/\//i.test(String(url || "").trim());

  const bdSafeRevokeObjectUrl = (url) => {
    const value = String(url || "").trim();
    if (!value || !value.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(value);
    } catch (e) {}
  };

  const bdGetRealUploaderDesignUrl = (idx) => {
    const uploader = document.querySelector("[data-cf-uploader]");
    if (!uploader) return "";
    const input = uploader.querySelector(`[data-url="${idx}"]`);
    return input ? String(input.value || "").trim() : "";
  };

  const bdSetRealUploaderDesignUrl = (idx, value) => {
    const uploader = document.querySelector("[data-cf-uploader]");
    if (!uploader) return;
    const nextValue = String(value || "").trim();
    uploader.querySelectorAll(`[data-url="${idx}"]`).forEach((input) => {
      input.value = nextValue;
    });
  };

  const bdRestoreRealUploaderPreview = (side, designUrl) => {
    const normalizedSide = side === "back" ? "back" : "front";
    const idx = normalizedSide === "back" ? "2" : "1";
    const nextUrl = String(designUrl || "").trim();
    const realBlock = bdGetRealUploadBlock(normalizedSide);
    if (!realBlock) return;

    const previewWrap = realBlock.querySelector(`[data-preview-wrap="${idx}"]`);
    const previewImg = realBlock.querySelector(`[data-preview-img="${idx}"]`);
    if (!previewWrap || !previewImg) return;

    if (nextUrl) {
      previewImg.src = nextUrl;
      previewWrap.hidden = false;
      return;
    }

    previewImg.removeAttribute("src");
    previewWrap.hidden = true;
  };

  const bdEnsurePropertyInputs = (form) => {
    if (!form) return {};

    let url = form.querySelector("#bd_design_url");
    if (!url) {
      url = document.createElement("input");
      url.type = "hidden";
      url.name = "properties[_Design Upload URL]";
      url.id = "bd_design_url";
      form.appendChild(url);
    }

    let proofUrl = form.querySelector("#bd_proof_mockup_url");
    let proofFront = form.querySelector("#bd_proof_mockup_url_front");
    let proofBack = form.querySelector("#bd_proof_mockup_url_back");
    if (!proofUrl) {
      proofUrl = document.createElement("input");
      proofUrl.type = "hidden";
      proofUrl.name = "properties[Proof Mockup URL]";
      proofUrl.id = "bd_proof_mockup_url";
      form.appendChild(proofUrl);
    }
    if (!proofFront) {
      proofFront = document.createElement("input");
      proofFront.type = "hidden";
      proofFront.name = "properties[_Front Proof Mockup URL]";
      proofFront.id = "bd_proof_mockup_url_front";
      form.appendChild(proofFront);
    }
    if (!proofBack) {
      proofBack = document.createElement("input");
      proofBack.type = "hidden";
      proofBack.name = "properties[_Back Proof Mockup URL]";
      proofBack.id = "bd_proof_mockup_url_back";
      form.appendChild(proofBack);
    }

    let placementFront = form.querySelector("#bd_design_placement_front");
    let placementBack = form.querySelector("#bd_design_placement_back");
    let editFront = form.querySelector("#bd_design_edit_front");
    let editBack = form.querySelector("#bd_design_edit_back");

    if (!placementFront) {
      placementFront = document.createElement("input");
      placementFront.type = "hidden";
      placementFront.name = "properties[_Design Placement Front]";
      placementFront.id = "bd_design_placement_front";
      form.appendChild(placementFront);
    }

    if (!placementBack) {
      placementBack = document.createElement("input");
      placementBack.type = "hidden";
      placementBack.name = "properties[_Design Placement Back]";
      placementBack.id = "bd_design_placement_back";
      form.appendChild(placementBack);
    }

    if (!editFront) {
      editFront = document.createElement("input");
      editFront.type = "hidden";
      editFront.name = "properties[_Design Edit Front]";
      editFront.id = "bd_design_edit_front";
      form.appendChild(editFront);
    }

    if (!editBack) {
      editBack = document.createElement("input");
      editBack.type = "hidden";
      editBack.name = "properties[_Design Edit Back]";
      editBack.id = "bd_design_edit_back";
      form.appendChild(editBack);
    }

    let uploadNotice = form.querySelector('#bd_upload_notice, #cf_upload_notice, [name="properties[_Upload Notice]"]');
    if (!uploadNotice) {
      uploadNotice = document.createElement("input");
      uploadNotice.type = "hidden";
      uploadNotice.name = "properties[_Upload Notice]";
      uploadNotice.id = "bd_upload_notice";
      form.appendChild(uploadNotice);
    }

    let previewFlow = form.querySelector('#bd_preview_flow, [name="properties[_Preview Flow]"]');
    if (!previewFlow) {
      previewFlow = document.createElement("input");
      previewFlow.type = "hidden";
      previewFlow.name = "properties[_Preview Flow]";
      previewFlow.id = "bd_preview_flow";
      form.appendChild(previewFlow);
    }

    let proofStatus = form.querySelector('#bd_proof_status, [name="properties[_Proof Status]"]');
    if (!proofStatus) {
      proofStatus = document.createElement("input");
      proofStatus.type = "hidden";
      proofStatus.name = "properties[_Proof Status]";
      proofStatus.id = "bd_proof_status";
      form.appendChild(proofStatus);
    }

    return {
      url,
      proofUrl,
      proofFront,
      proofBack,
      placementFront,
      placementBack,
      editFront,
      editBack,
      uploadNotice,
      previewFlow,
      proofStatus
    };
  };

  window.bdSetDesignUploadUrl = function (cloudinaryUrl) {
    const form = bdFindCartForm();
    if (!form) return;
    const { url } = bdEnsurePropertyInputs(form);
    if (!url) return;
    url.value = (cloudinaryUrl || "").trim();
  };

  window.bdSetProofMockupUrl = function (mockupUrl, side) {
    const form = bdFindCartForm();
    if (!form) return;
    const { proofUrl, proofFront, proofBack } = bdEnsurePropertyInputs(form);
    const value = (mockupUrl || "").trim();
    const targetSide = side === "back" ? "back" : side === "front" ? "front" : "";

    if (targetSide === "front" && proofFront) proofFront.value = value;
    if (targetSide === "back" && proofBack) proofBack.value = value;

    if (proofUrl) {
      const frontValue = proofFront ? (proofFront.value || "").trim() : "";
      const backValue = proofBack ? (proofBack.value || "").trim() : "";
      if (!targetSide) {
        proofUrl.value = value;
      } else {
        proofUrl.value = frontValue || backValue || value;
      }
    }
  };

  window.bdSetUploadNotice = function (message) {
    const form = bdFindCartForm();
    if (!form) return;
    const { uploadNotice } = bdEnsurePropertyInputs(form);
    if (!uploadNotice) return;
    uploadNotice.value = (message || "").trim();
  };

  const bdBuildSubmitSnapshot = (form, previewState) => {
    if (!form) return null;

    try {
      if (previewState && typeof previewState.syncBaseByVariantColor === "function") {
        previewState.syncBaseByVariantColor();
      }
    } catch (e) {}

    try { bdWritePlacement(); } catch (e) {}

    const approvedState = bdApprovedProofState;
    const requiredSides = bdGetRequiredProofSides();
    if (!approvedState || !bdCanApproveAddToCart() || !requiredSides.length) return null;

    const { url, proofUrl, proofFront, proofBack, uploadNotice, previewFlow, proofStatus } = bdEnsurePropertyInputs(form);
    const designUrlFront = bdGetRealUploaderDesignUrl(1);
    const designUrlBack = bdGetRealUploaderDesignUrl(2);
    return {
      designUploadUrl: designUrlFront || designUrlBack || "",
      proofFrontUrl: String(approvedState.proofFrontUrl || "").trim(),
      proofBackUrl: String(approvedState.proofBackUrl || "").trim(),
      proofUrl: String(approvedState.proofUrl || "").trim(),
      uploadNotice: "",
      previewFlow: "proof-gated",
      proofStatus: "ready"
    };
  };

  const bdApplySubmitSnapshot = (form, snapshot) => {
    if (!form || !snapshot) return;
    const { url, proofUrl, proofFront, proofBack, uploadNotice, previewFlow, proofStatus } = bdEnsurePropertyInputs(form);
    if (url) url.value = String(snapshot.designUploadUrl || "").trim();
    if (proofFront) proofFront.value = String(snapshot.proofFrontUrl || "").trim();
    if (proofBack) proofBack.value = String(snapshot.proofBackUrl || "").trim();
    if (proofUrl) proofUrl.value = String(snapshot.proofUrl || "").trim();
    if (uploadNotice) uploadNotice.value = String(snapshot.uploadNotice || "").trim();
    if (previewFlow) previewFlow.value = String(snapshot.previewFlow || "").trim();
    if (proofStatus) proofStatus.value = String(snapshot.proofStatus || "").trim();
  };

  window.bdBuildSubmitSnapshot = bdBuildSubmitSnapshot;
  window.bdApplySubmitSnapshot = bdApplySubmitSnapshot;

  const bdGetDraftSessionKey = () => {
    const keyParts = [
      BD_DRAFT_SESSION_PREFIX,
      window.location.pathname || "",
      bdPreviewConfig || "",
      bdConfigId || bdConfigUrl || ""
    ];
    return keyParts.join("|");
  };

  let bdDraftPersistFrame = 0;
  let bdDraftRestoreHandled = false;
  let bdDraftRestoreInProgress = false;

  const bdReadDraftMetaForSide = (side) => {
    const form = bdFindCartForm();
    if (!form) return { placementRaw: "", placement: null, editRaw: "", edit: null };
    const { placementFront, placementBack, editFront, editBack } = bdEnsurePropertyInputs(form);
    const placementEl = side === "back" ? placementBack : placementFront;
    const editEl = side === "back" ? editBack : editFront;
    const placementRaw = String((placementEl && placementEl.value) || "").trim();
    const editRaw = String((editEl && editEl.value) || "").trim();
    return {
      placementRaw,
      placement: bdSafeJsonParse(placementRaw),
      editRaw,
      edit: bdSafeJsonParse(editRaw)
    };
  };

  const bdBuildDraftSessionSnapshot = () => {
    const frontMeta = bdReadDraftMetaForSide("front");
    const backMeta = bdReadDraftMetaForSide("back");
    const frontUrl = bdGetRealUploaderDesignUrl(1);
    const backUrl = bdGetRealUploaderDesignUrl(2);
    const liveFrontPlacementPayload = bdBuildPlacementPayloadForSideState("front");
    const liveBackPlacementPayload = bdBuildPlacementPayloadForSideState("back");
    const frontPlacementRaw = bdIsTotePreview
      ? (liveFrontPlacementPayload ? JSON.stringify(liveFrontPlacementPayload) : frontMeta.placementRaw)
      : (frontMeta.placementRaw || (liveFrontPlacementPayload ? JSON.stringify(liveFrontPlacementPayload) : ""));
    const backPlacementRaw = bdIsTotePreview
      ? (liveBackPlacementPayload ? JSON.stringify(liveBackPlacementPayload) : backMeta.placementRaw)
      : (backMeta.placementRaw || (liveBackPlacementPayload ? JSON.stringify(liveBackPlacementPayload) : ""));
      const snapshot = {
        version: 1,
        savedAt: Date.now(),
        activeSide: bdPreferredActiveSide === "back" ? "back" : "front",
        resolvedMode: bdIsTotePreview ? bdResolvedPreviewMode : "",
        front: null,
        back: null
      };

    if (hasFrontDesign && bdIsDurableRestoreUrl(frontUrl) && frontPlacementRaw) {
      snapshot.front = {
        designUrl: frontUrl,
        placementRaw: frontPlacementRaw,
        editRaw: frontMeta.editRaw
      };
    }

    if (hasBackDesign && bdIsDurableRestoreUrl(backUrl) && backPlacementRaw) {
      snapshot.back = {
        designUrl: backUrl,
        placementRaw: backPlacementRaw,
        editRaw: backMeta.editRaw
      };
    }

    if (bdIsTotePreview) {
      snapshot.resolvedMode = snapshot.back ? "front-back" : "front-only";
    }

    if (!snapshot.front && !snapshot.back) return null;
    return snapshot;
  };

  const bdPersistDraftSessionNow = () => {
    const key = bdGetDraftSessionKey();
    try {
      const snapshot = bdBuildDraftSessionSnapshot();
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

  const bdScheduleDraftSessionPersist = () => {
    if (bdDraftPersistFrame) return;
    bdDraftPersistFrame = requestAnimationFrame(() => {
      bdDraftPersistFrame = 0;
      bdPersistDraftSessionNow();
    });
  };

  const bdReadDraftSessionSnapshot = () => {
    try {
      const raw = window.sessionStorage.getItem(bdGetDraftSessionKey());
      return bdSafeJsonParse(raw);
    } catch (e) {
      return null;
    }
  };

  const bdClearDraftSessionSnapshot = () => {
    try {
      window.sessionStorage.removeItem(bdGetDraftSessionKey());
    } catch (e) {}
  };

  const bdCloseTransientCartUi = () => {
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

  const bdDispatchPreviewRefreshBatch = () => {
    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
    try {
      if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate();
    } catch (e) {}
  };

  const bdRunDraftRestorePass = ({ persisted = false } = {}) => {
    if (bdDraftRestoreInProgress) return false;
    if (!bdShouldRestoreDraftSession({ persisted })) return false;

    bdDraftRestoreInProgress = true;
    bdCloseTransientCartUi();
    const restored = bdRestoreDraftSession();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bdDraftRestoreInProgress = false;
        if (!restored) return;
        try { bdUpdateReviewUi(); } catch (e) {}
        try { bdRefreshFinalizeUi(); } catch (e) {}
        bdDispatchPreviewRefreshBatch();
      });
    });

    return restored;
  };

  // --------------------------
  // Preview base switching (front/back) + color sync
  // --------------------------
  const previewBaseImg = canvas.querySelector(".cf-preview-base");

// ---------------------------------------------
// Robust: Switch PREVIEW base mockup to Front/Back
// - Uses data-front-src / data-back-src if present
// - If missing or stale, resolves from #bd-mockup-registry (side + color)
// - Color option order can change (option1/2/3), supports spaces
// ---------------------------------------------

const bdNormKey = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");

const bdRegistry = () => document.getElementById("bd-mockup-registry");

const bdGetRegistrySrc = (side, colorKey) => {
  const reg = bdRegistry();
  if (!reg) return "";

  // Exact match: side + color
  if (colorKey) {
    const exact = reg.querySelector(
      `img[data-bd-mockup="1"][data-side="${side}"][data-color="${colorKey}"]`
    );
    if (exact && exact.getAttribute("src")) return exact.getAttribute("src");
  }

  // Fallback: any mockup for that side
  const any = reg.querySelector(`img[data-bd-mockup="1"][data-side="${side}"]`);
  return (any && any.getAttribute("src")) || "";
};

// Try to infer selected color from variant UI, without assuming option1
const bdPickColorKeyFromUI = () => {
  const reg = bdRegistry();
  if (!reg) return "";

  const regImgs = Array.from(reg.querySelectorAll('img[data-bd-mockup="1"]'));
  const regColors = new Set(regImgs.map((i) => bdNormKey(i.dataset.color)));

  // Gather all ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“selectedÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â option values we can find in Dawn UI
  const candidates = [];

  // 1) variant-selects dropdowns
  document.querySelectorAll("variant-selects select").forEach((sel) => {
    const v = sel.value || sel.selectedOptions?.[0]?.textContent || "";
    if (v) candidates.push(v);
  });

  // 2) variant-selects radios/buttons (Dawn uses inputs)
  document
    .querySelectorAll('variant-selects input[type="radio"]:checked')
    .forEach((inp) => {
      const v = inp.value || "";
      if (v) candidates.push(v);
    });

  // 3) fallback: any checked radio on page (still safe)
  document
    .querySelectorAll('input[type="radio"][name^="options["]:checked')
    .forEach((inp) => {
      const v = inp.value || "";
      if (v) candidates.push(v);
    });

  // Choose the first candidate that exists in registry colors
  for (const raw of candidates) {
    const k = bdNormKey(raw);
    if (regColors.has(k)) return k;
  }

  return "";
};

// ---------------------------------------------
// Switch PREVIEW base mockup to Front/Back (RESOLVES from registry)
// - Reads selected color from Dawn variant picker (robust)
// - Looks up matching mockup in #bd-mockup-registry:
//     data-side="front|back", data-color="violet" (color may contain spaces)
// - Writes base data-front-src / data-back-src, THEN swaps base.src
// ---------------------------------------------
const bdNormColor = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // keep spaces but normalize

const bdGetColorMockupMap = (() => {
  let parsed = false;
  let cache = null;
  let sharedTried = false;
  let sharedPromise = null;
  const bdSharedCacheKey = [String(bdConfigUrl || "").trim(), String(bdConfigId || "").trim()].join("::");

  const parseInlineMap = () => {
    const node = document.getElementById("bd-color-mockup-map");
    if (!node || !node.textContent) return null;

    try {
      const raw = JSON.parse(node.textContent);
      return raw && typeof raw === "object" ? raw : null;
    } catch (e) {
      return null;
    }
  };

  const startSharedLoad = () => {
    if (sharedPromise) return sharedPromise;
    if (!bdConfigUrl || !bdConfigId || typeof fetch !== "function") {
      sharedPromise = Promise.resolve(parseInlineMap());
      return sharedPromise;
    }

    sharedTried = true;
    sharedPromise = fetch(bdConfigUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const shared = json && json[bdConfigId] && json[bdConfigId].colorMockupMap;
        cache = shared && typeof shared === "object" ? shared : parseInlineMap();
        parsed = true;
        window.__bdTshirtSharedConfigCache = window.__bdTshirtSharedConfigCache || {};
        if (cache && typeof cache === "object") {
          window.__bdTshirtSharedConfigCache[bdSharedCacheKey] = cache;
        }
        try { bdResolvePreviewBaseSources(); } catch (e) {}
        try { bdSwitchMainMockup(bdGetActiveSide()); } catch (e) {}
        return cache;
      })
      .catch(() => {
        cache = parseInlineMap();
        parsed = true;
        return cache;
      });

    return sharedPromise;
  };

  window.bdEnsureTshirtColorMockupMapLoaded = () => {
    if (parsed) return Promise.resolve(cache);
    if (bdConfigUrl && bdConfigId) return startSharedLoad();
    parsed = true;
    cache = parseInlineMap();
    return Promise.resolve(cache);
  };

  return () => {
    if (parsed) return cache;

    if (!sharedTried && bdConfigUrl && bdConfigId && window.__bdTshirtSharedConfigCache && window.__bdTshirtSharedConfigCache[bdSharedCacheKey]) {
      sharedTried = true;
      cache = window.__bdTshirtSharedConfigCache[bdSharedCacheKey];
      parsed = true;
      return cache;
    }

    if (!sharedTried && bdConfigUrl && bdConfigId && typeof fetch === "function") {
      startSharedLoad();
      return cache;
    }

    parsed = true;
    cache = parseInlineMap();
    return cache;
  };
})();

  const bdGetMappedMockupSrc = (side, colorValue) => {
  const map = bdGetColorMockupMap();
  if (!map || typeof map !== "object") return "";

  const wantSide = side === "back" ? "back" : "front";
  const wantColor = bdNormColor(colorValue);
  const entries = Object.entries(map);
  const hit = wantColor ? entries.find(([key]) => bdNormColor(key) === wantColor) : null;
  const fallback = entries.find(([key]) => bdNormColor(key) === "default");
  const resolved = (hit && hit[1] && typeof hit[1] === "object") ? hit[1] : (fallback && fallback[1] && typeof fallback[1] === "object" ? fallback[1] : null);
  if (!resolved) return "";

  const src = resolved[wantSide];
  return typeof src === "string" ? src.trim() : "";
};

const bdGetSelectedColorValue = () => {
  const rememberColor = (value) => {
    const next = String(value || "").trim();
    if (next) bdLastKnownSelectedColor = next;
    return next;
  };

  // 1) checked radios (swatches/buttons)
  const radio =
    document.querySelector('variant-selects input[type="radio"]:checked') ||
    document.querySelector('.product-form__input input[type="radio"]:checked');
  if (radio && radio.value) return rememberColor(radio.value);

  // 2) selects inside variant-selects (dropdowns)
  const selects = Array.from(document.querySelectorAll("variant-selects select"));
  if (selects.length) {
    // Prefer the select whose label/name mentions "color"
    for (const sel of selects) {
      const name = (sel.name || "").toLowerCase();
      const id = sel.id || "";
      const lbl = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const ltxt = (lbl ? lbl.textContent : "").toLowerCase();

      if (ltxt.includes("color") || name.includes("color")) {
        return rememberColor(sel.value || "");
      }
    }
    // Fallback: first select value
    return rememberColor(selects[0].value || "");
  }

  // 3) last resort: try any input that looks like an option
  const any =
    document.querySelector('[name^="options["]:checked') ||
    document.querySelector('[name^="options["]');
  if (any && any.value) return rememberColor(any.value);

  return bdLastKnownSelectedColor;
};

const bdFindMockupSrc = (side, colorValue) => {
  const reg = document.getElementById("bd-mockup-registry");
  if (!reg) return "";

  const wantSide = side === "back" ? "back" : "front";
  const wantColor = bdNormColor(colorValue);

  const imgs = Array.from(reg.querySelectorAll('img[data-bd-mockup="1"][data-side][data-color]'));
  if (!imgs.length) return "";

  // 1) exact match side + color
  if (wantColor) {
    const hit = imgs.find((img) => {
      const s = (img.getAttribute("data-side") || "").toLowerCase().trim();
      const c = bdNormColor(img.getAttribute("data-color") || "");
      return s === wantSide && c === wantColor;
    });
    if (hit) return hit.getAttribute("src") || "";
  }

  // 2) fallback: any for that side
  const sideHit = imgs.find((img) => {
    const s = (img.getAttribute("data-side") || "").toLowerCase().trim();
    return s === wantSide;
  });
  if (sideHit) return sideHit.getAttribute("src") || "";

  // 3) fallback: any image at all
  return (imgs[0] && imgs[0].getAttribute("src")) || "";
};

const bdGetActiveGalleryImageSrc = () => {
  const gallery = document.querySelector('[id^="MediaGallery-"]');
  if (!gallery) return "";

  const activeImg = gallery.querySelector(
    '.product__media-item.is-active:not([data-bd-design-preview-slide="1"]) img[src]:not(.cf-preview-base):not([data-bd-design-preview-base]):not([data-bd-design-preview-overlay])'
  );
  if (activeImg) return activeImg.currentSrc || activeImg.src || "";

  const firstImg = gallery.querySelector(
    '.product__media-item:not([data-bd-design-preview-slide="1"]) img[src]:not(.cf-preview-base):not([data-bd-design-preview-base]):not([data-bd-design-preview-overlay])'
  );
  return firstImg ? (firstImg.currentSrc || firstImg.src || "") : "";
};

const bdResolvePreviewBaseSources = () => {
  const base = canvas.querySelector(".cf-preview-base");
  if (!base) return { frontSrc: "", backSrc: "" };

  const colorValue = bdGetSelectedColorValue();
  const firstVariantSrc = (box.dataset.firstVariantSrc || "").trim();
  const hasManualVariantInteraction =
    document.documentElement.classList.contains("variant-interacted");

  let frontSrc = "";
  let backSrc = "";
  const mappedFrontSrc = !bdIsBackOnlyMode() ? bdGetMappedMockupSrc("front", colorValue) : "";
  const mappedBackSrc = !bdIsFrontOnlyMode() ? bdGetMappedMockupSrc("back", colorValue) : "";
  const registryFrontSrc = bdFindMockupSrc("front", colorValue);
  const registryBackSrc = bdFindMockupSrc("back", colorValue);
  const variantFrontSrc = bdGetActiveGalleryImageSrc();

  // Prefer the selected-color mockup sources first so both sides stay in sync
  // with the active variant, even if the gallery image is stale.
  if (mappedFrontSrc || registryFrontSrc) {
    frontSrc = mappedFrontSrc || registryFrontSrc;
  } else if (!hasManualVariantInteraction && firstVariantSrc) {
    frontSrc = firstVariantSrc;
  } else {
    frontSrc = variantFrontSrc || registryFrontSrc;
  }

  if (bdIsFrontOnlyMode()) {
    backSrc = frontSrc;
  } else if (bdIsBackOnlyMode()) {
    backSrc = registryBackSrc || frontSrc;
  } else {
    backSrc = mappedBackSrc || registryBackSrc || frontSrc;
  }

  if (frontSrc) base.setAttribute("data-front-src", frontSrc);
  if (backSrc) base.setAttribute("data-back-src", backSrc);

  return { frontSrc, backSrc };
};

const bdGetFreshProofBaseSrcForSide = (side) => {
  const s = side === "back" ? "back" : "front";
  const colorValue = bdGetSelectedColorValue();
  const mappedSrc = bdGetMappedMockupSrc(s, colorValue);
  const registrySrc = bdFindMockupSrc(s, colorValue);
  const fallbackFront = bdGetActiveGalleryImageSrc();
  const base = canvas.querySelector(".cf-preview-base");
  const cachedSrc = base
    ? (base.getAttribute(s === "back" ? "data-back-src" : "data-front-src") || "")
    : "";

  if (mappedSrc) return mappedSrc;
  if (registrySrc) return registrySrc;
  if (s === "front" && fallbackFront) return fallbackFront;
  if (s === "back" && fallbackFront) return fallbackFront;
  return cachedSrc;
};

const bdSwitchMainMockup = (side) => {
  const s = side === "back" ? "back" : "front";
  const base = canvas.querySelector(".cf-preview-base");
  if (!base) return;

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Always resolve latest front/back sources first (prevents "stuck")

  bdResolvePreviewBaseSources();
  const frontSrc = base.getAttribute("data-front-src") || "";
  const backSrc = base.getAttribute("data-back-src") || "";
  const next = (s === "back" ? backSrc : frontSrc) || frontSrc || backSrc;
  if (!next) return;

  const cur = base.currentSrc || base.src || "";
  if (cur && next && cur.split("?")[0] === next.split("?")[0]) {
    if (bdDraftRestoreInProgress) return;
    // still fire event so other code can re-align zone/hero
    try { document.dispatchEvent(new CustomEvent("bd:base-changed")); } catch (e) {}
    return;
  }

  base.src = next;

  if (bdDraftRestoreInProgress) return;
  try { document.dispatchEvent(new CustomEvent("bd:base-changed")); } catch (e) {}
};

// Keep preview base in sync with variant/color changes (Dawn events vary)
const bdOnVariantMaybeChanged = () => {
  try { bdSyncBaseByVariantColor(); } catch (e) {}
};

document.addEventListener("variant:change", bdOnVariantMaybeChanged);
document.addEventListener("variantChange", bdOnVariantMaybeChanged);
document.addEventListener("product:variant-change", bdOnVariantMaybeChanged);

// Also catch direct input changes (covers some Dawn setups)
document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (!t) return;
    if (t.closest && (t.closest("variant-selects") || t.closest(".product-form__input"))) {
      bdOnVariantMaybeChanged();
    }
  },
  true
);

// Resolve once on load so back/front have correct sources immediately
requestAnimationFrame(() => {
  try { bdResolvePreviewBaseSources(); } catch (e) {}
  try { bdSwitchMainMockup(bdGetActiveSide()); } catch (e) {}
});



  // expose (your side toggle calls it)
  window.__bdSwitchMainMockup = bdSwitchMainMockup;

  const bdGetCurrentColorFromUI = () => {
    // Try within this product-info section first
    const root = box.closest("product-info") || document;

    // Common Dawn option inputs: options[Color] or select
    const checkedRadio = root.querySelector('variant-selects input[type="radio"][name^="options["]:checked');
    if (checkedRadio && checkedRadio.value) return checkedRadio.value;

    const select = root.querySelector('variant-selects select[name^="options["]');
    if (select && select.value) return select.value;

    // Fallback: any checked radio for options
    const anyChecked = root.querySelector('input[type="radio"][name^="options["]:checked');
    if (anyChecked && anyChecked.value) return anyChecked.value;

    const anySelect = root.querySelector('select[name^="options["]');
    if (anySelect && anySelect.value) return anySelect.value;

    return "";
  };

  const bdPickMockupsFromRegistry = (colorValue) => {
    const registry = document.getElementById("bd-mockup-registry");
    if (!registry) return { front: "", back: "" };

    const key = bdNormalizeKey(colorValue);
    const imgs = Array.from(registry.querySelectorAll("img[data-bd-mockup='1']"));

    let anyFront = "";
    let anyBack = "";
    let matchFront = "";
    let matchBack = "";

    imgs.forEach((img) => {
      const side = (img.getAttribute("data-side") || "").toLowerCase().trim();
      const c = bdNormalizeKey(img.getAttribute("data-color") || "");
      const src = img.getAttribute("src") || "";

      if (!src) return;

      if (side === "front" && !anyFront) anyFront = src;
      if (side === "back" && !anyBack) anyBack = src;

      if (key && c === key) {
        if (side === "front" && !matchFront) matchFront = src;
        if (side === "back" && !matchBack) matchBack = src;
      }
    });

    return {
      front: matchFront || anyFront || "",
      back: matchBack || anyBack || "",
    };
  };

  const bdSyncBaseByVariantColor = () => {
    if (!previewBaseImg) return;
    const modeChanged = bdSyncResolvedPreviewMode({ announce: true });
    if (modeChanged) {
      try { bdApplyProductConfigUi(); } catch (e) {}
      try { bdRefreshFinalizeUi(); } catch (e) {}
      requestAnimationFrame(() => {
        try {
          if (typeof bdSyncInlineUploadInfo === "function") bdSyncInlineUploadInfo();
        } catch (e) {}
      });
    }

    const prevFrontSrc = previewBaseImg.getAttribute("data-front-src") || "";
    const prevBackSrc = previewBaseImg.getAttribute("data-back-src") || "";
    const resolved = bdResolvePreviewBaseSources();
    const nextFrontResolved = resolved && resolved.frontSrc ? resolved.frontSrc : "";
    const nextBackResolved = resolved && resolved.backSrc ? resolved.backSrc : "";

    const nextFrontSrc = previewBaseImg.getAttribute("data-front-src") || "";
    const nextBackSrc = previewBaseImg.getAttribute("data-back-src") || "";
    const baseChanged =
      (!!nextFrontResolved && prevFrontSrc.split("?")[0] !== nextFrontSrc.split("?")[0]) ||
      (!!nextBackResolved && prevBackSrc.split("?")[0] !== nextBackSrc.split("?")[0]);

    if (baseChanged) {
      try { bdInvalidateProofMockupsForBaseChange(); } catch (e) {}
    }

    // ensure base image matches current side
    bdSwitchMainMockup(bdActiveSide);

    // also update ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Design PreviewÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â slide if present
    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
    bdScheduleSoftPrintRefresh();
  };

  // keep zone aligned with base load
  const printZoneEl = canvas.querySelector(".cf-print-zone");
  const bdSoftPrintAreaEl = (() => {
    let el = canvas.querySelector(".bd-soft-print-area");
    if (!el) {
      el = document.createElement("div");
      el.className = "bd-soft-print-area";
      el.setAttribute("aria-hidden", "true");
      canvas.appendChild(el);
    }
    return el;
  })();
  const SAFE_PRINT_AREAS = {
    tshirt: {
      front: { left: 35.5, top: 32, width: 30, height: 38 },
      back: { left: 36.5, top: 32, width: 30, height: 38 }
    },
    tote: {
      front: { left: 31.5, top: 50.5, width: 35, height: 34 },
      back: { left: 31.5, top: 50.5, width: 35, height: 34 }
    },
    "girls-onesies": {
      front: { left: 36.2, top: 21, width: 30, height: 40 },
      back: { left: 36.5, top: 21, width: 30, height: 40 }
    },
    "boys-onesies": {
      front: { left: 35.5, top: 21, width: 30, height: 40 },
      back: { left: 36.5, top: 21, width: 30, height: 40 }
    },
    hoodie: {
      front: { left: 35.5, top: 28, width: 30, height: 31 },
      back: { left: 35.5, top: 32, width: 30, height: 40 }
    },
    polo: {
      front: { left: 32, top: 24, width: 36, height: 42 },
      back: { left: 31.5, top: 26, width: 36, height: 43 }
    }
  };
  const SAFE_PRINT_PLACEMENT_OVERRIDES = {
    "left-chest": {
      tshirt: {
        front: { left: 53, top: 30, width: 12, height: 12 }
      },
      hoodie: {
        front: { left: 55, top: 32, width: 16, height: 16 }
      },
      polo: {
        front: { left: 61, top: 28, width: 15, height: 16 }
      }
    },
    "back-wide": {
      tshirt: {
        back: { left: 34, top: 27, width: 36, height: 12 }
      }
    }
  };
  let bdSoftPrintRefreshFrame = 0;

  const bdGetSafePrintGarmentType = () => {
    const garment = String(box.dataset.safePrintGarment || "").toLowerCase().trim();
    return SAFE_PRINT_AREAS[garment] ? garment : "tshirt";
  };

  const bdGetSafePrintPlacement = () => String(box.dataset.safePrintPlacement || "").toLowerCase().trim();

  const bdGetSafePrintSkipMeta = () => {
    const skipped = String(box.dataset.safePrintSkip || "").toLowerCase() === "true";
    const reason = String(box.dataset.safePrintSkipReason || "").trim();
    return { skipped, reason };
  };

  const bdSetSafePrintState = (next = {}) => {
    const previewState = window.__bdTshirtPreviewState;
    if (!previewState) return;
    if (Object.prototype.hasOwnProperty.call(next, "outsideSafePrintArea")) {
      previewState.outsideSafePrintArea = !!next.outsideSafePrintArea;
    }
    if (Object.prototype.hasOwnProperty.call(next, "safePrintGarmentType")) {
      previewState.safePrintGarmentType = String(next.safePrintGarmentType || "tshirt");
    }
    if (Object.prototype.hasOwnProperty.call(next, "safePrintSide")) {
      previewState.safePrintSide = String(next.safePrintSide || bdGetActiveSide());
    }
    if (Object.prototype.hasOwnProperty.call(next, "safePrintAreaSkipped")) {
      previewState.safePrintAreaSkipped = !!next.safePrintAreaSkipped;
    }
    if (Object.prototype.hasOwnProperty.call(next, "safePrintAreaSkipReason")) {
      previewState.safePrintAreaSkipReason = String(next.safePrintAreaSkipReason || "");
    }
  };

  const bdSetSafePrintWarningVisible = (visible) => {
    const warning = bdEnsureSafePrintWarning();
    if (!warning) return;
    warning.hidden = !visible;
    warning.textContent = visible
      ? "Part of your design may be outside the ideal print area. We’ll review it before production."
      : "";
  };

  const bdHideSoftPrintArea = ({ skipped = false, reason = "" } = {}) => {
    if (bdSoftPrintAreaEl) {
      bdSoftPrintAreaEl.style.left = "";
      bdSoftPrintAreaEl.style.top = "";
      bdSoftPrintAreaEl.style.width = "";
      bdSoftPrintAreaEl.style.height = "";
      bdSoftPrintAreaEl.style.opacity = "";
      bdSoftPrintAreaEl.hidden = true;
    }
    box.classList.remove("is-outside-safe-area");
    bdSetSafePrintWarningVisible(false);
    bdSetSafePrintState({
      outsideSafePrintArea: false,
      safePrintGarmentType: bdGetSafePrintGarmentType(),
      safePrintSide: bdGetActiveSide(),
      safePrintAreaSkipped: skipped,
      safePrintAreaSkipReason: reason
    });
  };

  const bdRefreshSoftPrintArea = () => {
    bdSoftPrintRefreshFrame = 0;

    const skipMeta = bdGetSafePrintSkipMeta();
    const garment = bdGetSafePrintGarmentType();
    const placement = bdGetSafePrintPlacement();
    const side = bdGetActiveSide();

    if (skipMeta.skipped) {
      bdHideSoftPrintArea({ skipped: true, reason: skipMeta.reason });
      return;
    }

    const baseImg = canvas.querySelector(".cf-preview-base");
    const presetByGarment = SAFE_PRINT_AREAS[garment] || SAFE_PRINT_AREAS.tshirt;
    const placementPreset =
      placement &&
      SAFE_PRINT_PLACEMENT_OVERRIDES[placement] &&
      SAFE_PRINT_PLACEMENT_OVERRIDES[placement][garment] &&
      SAFE_PRINT_PLACEMENT_OVERRIDES[placement][garment][side]
        ? SAFE_PRINT_PLACEMENT_OVERRIDES[placement][garment][side]
        : null;
    const preset = placementPreset || presetByGarment[side] || presetByGarment.front;
    if (!bdSoftPrintAreaEl || !baseImg || !preset) {
      bdHideSoftPrintArea();
      return;
    }

    const cRect = canvas.getBoundingClientRect();
    const bRect = baseImg.getBoundingClientRect();
    if (!cRect.width || !cRect.height || !bRect.width || !bRect.height) {
      bdHideSoftPrintArea();
      return;
    }

    const left = bRect.left - cRect.left + (bRect.width * preset.left) / 100;
    const top = bRect.top - cRect.top + (bRect.height * preset.top) / 100;
    const width = (bRect.width * preset.width) / 100;
    const height = (bRect.height * preset.height) / 100;

    bdSoftPrintAreaEl.hidden = false;
    bdSoftPrintAreaEl.style.left = `${left}px`;
    bdSoftPrintAreaEl.style.top = `${top}px`;
    bdSoftPrintAreaEl.style.width = `${width}px`;
    bdSoftPrintAreaEl.style.height = `${height}px`;

    const hasVisibleDesign = wrap && wrap.style.display !== "none" && !designImg.hidden && (hasFrontDesign || hasBackDesign);
    let outsideSafePrintArea = false;
    if (hasVisibleDesign) {
      const safeRect = bdSoftPrintAreaEl.getBoundingClientRect();
      const artRect = wrap.getBoundingClientRect();
      const toleranceX = Math.max(4, safeRect.width * 0.025);
      const toleranceY = Math.max(4, safeRect.height * 0.025);
      const effectiveSafeRect = {
        left: safeRect.left - toleranceX,
        top: safeRect.top - toleranceY,
        right: safeRect.right + toleranceX,
        bottom: safeRect.bottom + toleranceY
      };
      outsideSafePrintArea =
        artRect.left < effectiveSafeRect.left ||
        artRect.top < effectiveSafeRect.top ||
        artRect.right > effectiveSafeRect.right ||
        artRect.bottom > effectiveSafeRect.bottom;
    }

    box.classList.toggle("is-outside-safe-area", outsideSafePrintArea);
    bdSetSafePrintWarningVisible(!!(hasVisibleDesign && outsideSafePrintArea));
    bdSetSafePrintState({
      outsideSafePrintArea,
      safePrintGarmentType: garment,
      safePrintSide: side,
      safePrintAreaSkipped: false,
      safePrintAreaSkipReason: ""
    });
  };

  const bdScheduleSoftPrintRefresh = () => {
    if (bdSoftPrintRefreshFrame) return;
    bdSoftPrintRefreshFrame = requestAnimationFrame(bdRefreshSoftPrintArea);
  };

  const canvasRect = () => canvas.getBoundingClientRect();

  const bdUpdatePrintZoneFromInches = () => {
    const zone = printZoneEl;
    const baseImg = canvas.querySelector(".cf-preview-base");
    if (!zone || !baseImg) return;

    const cRect = canvas.getBoundingClientRect();
    const bRect = baseImg.getBoundingClientRect();
    if (!cRect.width || !cRect.height || !bRect.width || !bRect.height) return;

    const baseLeft = bRect.left - cRect.left;
    const baseTop = bRect.top - cRect.top;
    const baseW = bRect.width;
    const baseH = bRect.height;

    const wIn = parseFloat(box.dataset.printWIn || "12");
    const hIn = parseFloat(box.dataset.printHIn || "14");
    const maxWIn = parseFloat(box.dataset.maxPrintWIn || "14");
    const maxHIn = parseFloat(box.dataset.maxPrintHIn || "16");

    const centerX = parseFloat(box.dataset.printCenterX || "0.50");
    const centerY = parseFloat(box.dataset.printCenterY || "0.52");

    const safeMaxW = maxWIn > 0 ? maxWIn : 1;
    const safeMaxH = maxHIn > 0 ? maxHIn : 1;

    const wPct = Math.max(0.01, Math.min(1.0, wIn / safeMaxW));
    const hPct = Math.max(0.01, Math.min(1.0, hIn / safeMaxH));

    const scaleW = parseFloat(box.dataset.printScaleW || "0.60");
    const scaleH = parseFloat(box.dataset.printScaleH || "0.62");

    const zoneW = baseW * wPct * scaleW;
    const zoneH = baseH * hPct * scaleH;

    const left = baseLeft + baseW * centerX - zoneW / 2;
    const top = baseTop + baseH * centerY - zoneH / 2;

    zone.style.left = `${left}px`;
    zone.style.top = `${top}px`;
    zone.style.width = `${zoneW}px`;
    zone.style.height = `${zoneH}px`;
  };

  const bdGetZone = () => {
    const cRect = canvasRect();
    const cw = cRect.width || canvas.clientWidth || 1;
    const ch = cRect.height || canvas.clientHeight || 1;

    if (!printZoneEl) {
      return { left: 0, top: 0, right: cw, bottom: ch, width: cw, height: ch };
    }

    const zRect = printZoneEl.getBoundingClientRect();
    if (!(zRect.width > 10 && zRect.height > 10) || !cRect.width || !cRect.height) {
      return { left: 0, top: 0, right: cw, bottom: ch, width: cw, height: ch };
    }

    const left = zRect.left - cRect.left;
    const top = zRect.top - cRect.top;
    const width = zRect.width;
    const height = zRect.height;

    return { left, top, right: left + width, bottom: top + height, width, height };
  };

  const bdGetInitialCenterZone = () => {
    const zone = bdGetZone();
    if (!bdIsTotePreview || !bdSoftPrintAreaEl) return zone;

    const cRect = canvasRect();
    const sRect = bdSoftPrintAreaEl.getBoundingClientRect();
    if (!(sRect.width > 10 && sRect.height > 10) || !cRect.width || !cRect.height) {
      return zone;
    }

    const left = sRect.left - cRect.left;
    const top = sRect.top - cRect.top;
    const width = sRect.width;
    const height = sRect.height;
    return { left, top, right: left + width, bottom: top + height, width, height };
  };

  const bdGetBaseBounds = () => {
    const cRect = canvasRect();
    const cw = cRect.width || canvas.clientWidth || 1;
    const ch = cRect.height || canvas.clientHeight || 1;
    const baseImg = canvas.querySelector(".cf-preview-base");

    if (!baseImg) {
      return { left: 0, top: 0, right: cw, bottom: ch, width: cw, height: ch };
    }

    const bRect = baseImg.getBoundingClientRect();
    if (!(bRect.width > 10 && bRect.height > 10) || !cRect.width || !cRect.height) {
      return { left: 0, top: 0, right: cw, bottom: ch, width: cw, height: ch };
    }

    const left = bRect.left - cRect.left;
    const top = bRect.top - cRect.top;
    const width = bRect.width;
    const height = bRect.height;

    return { left, top, right: left + width, bottom: top + height, width, height };
  };

  // --------------------------
  // Overlay wrapper + handles
  // --------------------------
  let wrap = canvas.querySelector(".cf-design-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "cf-design-wrap";
    canvas.appendChild(wrap);
  }

  wrap.style.zIndex = "2";
  wrap.hidden = false;
  wrap.removeAttribute("hidden");
  wrap.style.display = "none";
  wrap.style.left = "50%";
  wrap.style.top = "50%";
  wrap.style.transform = "translate(-50%, -50%)";
  wrap.style.touchAction = "none";
  wrap.style.position = "absolute";

  if (designImg.parentElement !== wrap) wrap.appendChild(designImg);
  designImg.hidden = true;
  designImg.removeAttribute("hidden");

  let dimLabel = wrap.querySelector(".cf-dim-label");
  if (!dimLabel) {
    dimLabel = document.createElement("div");
    dimLabel.className = "cf-dim-label";
    wrap.appendChild(dimLabel);
  }
  dimLabel.hidden = true;
  dimLabel.removeAttribute("hidden");

  const handlePos = ["nw", "ne", "sw", "se", "n", "s", "w", "e"];
  handlePos.forEach((pos) => {
    let h = wrap.querySelector(`.cf-handle[data-handle="${pos}"]`);
    if (!h) {
      h = document.createElement("span");
      h.className = `cf-handle ${pos} ${["nw", "ne", "sw", "se"].includes(pos) ? "corner" : ""}`.trim();
      h.dataset.handle = pos;
      wrap.appendChild(h);
    }
    h.hidden = false;
    h.removeAttribute("hidden");
  });

  // --------------------------
  // Per-side states
  // --------------------------
  const stateFront = { cx: 0, cy: 0, w: 0, h: 0, ar: 1 };
  const stateBack = { cx: 0, cy: 0, w: 0, h: 0, ar: 1 };
  let state = bdActiveSide === "back" ? stateBack : stateFront;

// ---------------------------
// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Per-side state persist (robust)
// Saves based on which state object is currently active,
// NOT based on bdActiveSide (prevents cross-over bugs).
// ---------------------------
const bdPersistActiveState = () => {
  if (state === stateBack) {
    stateBack.cx = state.cx; stateBack.cy = state.cy;
    stateBack.w  = state.w;  stateBack.h  = state.h;
    stateBack.ar = state.ar;
  } else {
    stateFront.cx = state.cx; stateFront.cy = state.cy;
    stateFront.w  = state.w;  stateFront.h  = state.h;
    stateFront.ar = state.ar;
  }
};

const bdUseSideState = (side) => {
  state = (side === "back") ? stateBack : stateFront;
};



  let objectUrlFront = null;
  let objectUrlBack = null;
  let hasFrontDesign = false;
  let hasBackDesign = false;

  const bdClampSizeAndPosToZone = () => {
    if (BD_DISABLE_ZONE) {
      const b = bdGetBaseBounds();
      if (!b.width || !b.height) return;

      const halfW = state.w / 2;
      const halfH = state.h / 2;
      const overflowX = Math.min(state.w * 0.35, b.width * 0.12);
      const overflowY = Math.min(state.h * 0.35, b.height * 0.12);
      const minCx = b.left + halfW - overflowX;
      const maxCx = b.right - halfW + overflowX;
      const minCy = b.top + halfH - overflowY;
      const maxCy = b.bottom - halfH + overflowY;

      state.cx = minCx <= maxCx ? clamp(state.cx, minCx, maxCx) : b.left + b.width / 2;
      state.cy = minCy <= maxCy ? clamp(state.cy, minCy, maxCy) : b.top + b.height / 2;
      return;
    }

    const z = bdGetZone();
    if (!z.width || !z.height) return;

    const minW = bdGetMinDesignWidth(z.width);
    const maxW = Math.max(minW, Math.round(z.width * 0.98));

    state.w = clamp(state.w, minW, maxW);
    state.h = Math.round(state.w / state.ar);

    const maxH = Math.max(40, Math.round(z.height * 0.98));
    if (state.h > maxH) {
      state.h = maxH;
      state.w = Math.round(state.h * state.ar);
      state.w = clamp(state.w, minW, maxW);
      state.h = Math.round(state.w / state.ar);
    }

    const halfW = state.w / 2;
    const halfH = state.h / 2;

    state.cx = clamp(state.cx, z.left + halfW, z.right - halfW);
    state.cy = clamp(state.cy, z.top + halfH, z.bottom - halfH);
  };

  const bdRefreshZoneAndClamp = () => {
    bdUpdatePrintZoneFromInches();
    bdClampSizeAndPosToZone();
  };

  const bdWritePlacement = () => {
    const form = bdFindCartForm();
    if (!form) return;

    const { placementFront, placementBack } = bdEnsurePropertyInputs(form);
    const placementEl = bdActiveSide === "back" ? placementBack : placementFront;
    if (!placementEl) return;

    const cw = canvas.clientWidth || 0;
    const ch = canvas.clientHeight || 0;
    if (!cw || !ch) return;

    const cRect = canvas.getBoundingClientRect();
    const baseImg = canvas.querySelector(".cf-preview-base");
    let baseLeft = 0,
      baseTop = 0,
      baseW = cw,
      baseH = ch;

    if (baseImg) {
      const bRect = baseImg.getBoundingClientRect();
      if (cRect.width && cRect.height && bRect.width && bRect.height) {
        baseLeft = bRect.left - cRect.left;
        baseTop = bRect.top - cRect.top;
        baseW = bRect.width;
        baseH = bRect.height;
      }
    }

    const payload = {
      side: bdActiveSide,
      cx: Math.round(state.cx),
      cy: Math.round(state.cy),
      w: Math.round(state.w),
      h: Math.round(state.h),
      canvasW: Math.round(cw),
      canvasH: Math.round(ch),
      baseLeft: Math.round(baseLeft),
      baseTop: Math.round(baseTop),
      baseW: Math.round(baseW),
      baseH: Math.round(baseH),
      ar: Number(state.ar || 1),
    };

    placementEl.value = JSON.stringify(payload);
    bdScheduleDraftSessionPersist();
  };

  const bdBuildPlacementPayloadForSideState = (side) => {
    const targetSide = side === "back" ? "back" : "front";
    const targetState = targetSide === "back" ? stateBack : stateFront;
    if (!targetState || !(targetState.w > 0) || !(targetState.h > 0)) return null;

    const cw = canvas.clientWidth || 0;
    const ch = canvas.clientHeight || 0;
    if (!cw || !ch) return null;

    const cRect = canvas.getBoundingClientRect();
    const baseImg = canvas.querySelector(".cf-preview-base");
    let baseLeft = 0;
    let baseTop = 0;
    let baseW = cw;
    let baseH = ch;

    if (baseImg) {
      const bRect = baseImg.getBoundingClientRect();
      if (cRect.width && cRect.height && bRect.width && bRect.height) {
        baseLeft = bRect.left - cRect.left;
        baseTop = bRect.top - cRect.top;
        baseW = bRect.width;
        baseH = bRect.height;
      }
    }

    return {
      side: targetSide,
      cx: Math.round(targetState.cx || 0),
      cy: Math.round(targetState.cy || 0),
      w: Math.round(targetState.w || 0),
      h: Math.round(targetState.h || 0),
      canvasW: Math.round(cw),
      canvasH: Math.round(ch),
      baseLeft: Math.round(baseLeft),
      baseTop: Math.round(baseTop),
      baseW: Math.round(baseW),
      baseH: Math.round(baseH),
      ar: Number(targetState.ar || 1)
    };
  };

  const bdWriteEditorMetaForSide = (side) => {
    const form = bdFindCartForm();
    if (!form) return;

    const { editFront, editBack } = bdEnsurePropertyInputs(form);
    const target = side === "back" ? editBack : editFront;
    if (!target) return;

    const editorSide = bdGetEditorSideState(side);
    if (!editorSide || !editorSide.originalFile) {
      target.value = "";
      return;
    }

    target.value = JSON.stringify({
      side: side === "back" ? "back" : "front",
      originalFilename: editorSide.originalFile.name || "",
      crop: editorSide.crop
        ? {
            x: Math.round(editorSide.crop.x),
            y: Math.round(editorSide.crop.y),
            w: Math.round(editorSide.crop.w),
            h: Math.round(editorSide.crop.h),
            naturalWidth: Math.round(editorSide.crop.naturalWidth || 0),
            naturalHeight: Math.round(editorSide.crop.naturalHeight || 0),
            unit: "px"
          }
        : null
    });
    bdScheduleDraftSessionPersist();
  };

  const bdGetProofCloudConfig = () => {
    const uploaderRoot = document.querySelector("[data-cf-uploader]");
    const cloud =
      (box.dataset.cloudName || "").trim() ||
      (uploaderRoot && uploaderRoot.dataset.cloud) ||
      "";
    const preset =
      (box.dataset.uploadPreset || "").trim() ||
      (uploaderRoot && uploaderRoot.dataset.preset) ||
      "";
    const folder =
      (box.dataset.proofFolder || "").trim() ||
      (uploaderRoot && uploaderRoot.dataset.folder) ||
      "proofs";

    return {
      cloud: String(cloud || "").trim(),
      preset: String(preset || "").trim(),
      folder: String(folder || "").trim()
    };
  };

  const bdLoadImageForProof = (src) =>
    new Promise((resolve, reject) => {
      if (!src) {
        reject(new Error("Missing image source"));
        return;
      }

      const img = new Image();
      if (!String(src).startsWith("blob:")) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load proof image source"));
      img.src = src;
    });

  const BD_PROOF_UPLOAD_MIME = "image/jpeg";
  const BD_PROOF_UPLOAD_EXT = "jpg";
  const BD_PROOF_UPLOAD_QUALITY = 0.82;

  const bdCanvasToBlob = (proofCanvas) =>
    new Promise((resolve, reject) => {
      proofCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Proof blob export failed"));
        },
        BD_PROOF_UPLOAD_MIME,
        BD_PROOF_UPLOAD_QUALITY
      );
    });

  const bdRecordProofPhase = (side, phase) => {
    try {
      const probe = window.__bdProofPhaseProbe;
      if (!probe || typeof probe.record !== "function") return;
      probe.record({
        side: side === "back" ? "back" : "front",
        phase: String(phase || "").trim(),
        ts: Date.now()
      });
    } catch (e) {}
  };

  const bdUploadProofBlobToCloudinary = ({ blob, side }) => {
    const { cloud, preset, folder } = bdGetProofCloudConfig();
    if (!blob) {
      return Promise.reject(new Error("Missing proof upload blob"));
    }
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
      filename: `proof-${side}-${Date.now()}.${BD_PROOF_UPLOAD_EXT}`,
      folder
    }).then((result) => String((result && (result.secureUrl || result.url)) || "").trim());
  };

  const bdGetPlacementPayloadForSide = (side) => {
    const form = bdFindCartForm();
    if (!form) return bdBuildPlacementPayloadForSideState(side);

    const { placementFront, placementBack } = bdEnsurePropertyInputs(form);
    const el = side === "back" ? placementBack : placementFront;
    if (!el || !el.value) return bdBuildPlacementPayloadForSideState(side);

    try {
      return JSON.parse(el.value);
    } catch (e) {
      return bdBuildPlacementPayloadForSideState(side);
    }
  };

  const bdRenderProofBlobForSide = async (side, { silent = false } = {}) => {
    const s = side === "back" ? "back" : "front";
    const hasDesign = s === "back" ? hasBackDesign : hasFrontDesign;
    let designSrc = s === "back" ? objectUrlBack : objectUrlFront;
    if (!hasDesign || !designSrc) return null;

    let ephemeralDesignUrl = "";
    if (!String(designSrc).startsWith("blob:")) {
      const workingFile = await bdReadWorkingUploadFileForSide(s);
      if (workingFile) {
        try {
          ephemeralDesignUrl = URL.createObjectURL(workingFile);
          designSrc = ephemeralDesignUrl;
        } catch (e) {}
      }
    }

    if (typeof window.bdEnsureTshirtColorMockupMapLoaded === "function") {
      try { await window.bdEnsureTshirtColorMockupMapLoaded(); } catch (e) {}
    }

    const activeSideBefore = bdGetActiveSide();
    if (!silent && activeSideBefore !== s && typeof window.bdSwitchPreviewSide === "function") {
      window.bdSwitchPreviewSide(s, { skipPersistBeforeSwitch: true });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (!silent) {
      bdSetActiveSideUi(s);
      bdUseSideState(s);
      if (typeof bdResolvePreviewBaseSources === "function") {
        try { bdResolvePreviewBaseSources(); } catch (e) {}
      }
      if (typeof bdSwitchMainMockup === "function") {
        try { bdSwitchMainMockup(s); } catch (e) {}
      }
      bdWritePlacement();
    }

    const placement = bdGetPlacementPayloadForSide(s);
    const freshBaseSrc = bdGetFreshProofBaseSrcForSide(s);
    const baseSrc = freshBaseSrc || (
      previewBaseImg
        ? (
            previewBaseImg.getAttribute(s === "back" ? "data-back-src" : "data-front-src") ||
            previewBaseImg.currentSrc ||
            previewBaseImg.src ||
            ""
          )
        : ""
    );
    if (!placement || !baseSrc) return null;

    try {
      const [baseImg, overlayImg] = await Promise.all([
        bdLoadImageForProof(baseSrc),
        bdLoadImageForProof(designSrc)
      ]);
      const outW = Math.max(1, baseImg.naturalWidth || baseImg.width || 1);
      const outH = Math.max(1, baseImg.naturalHeight || baseImg.height || 1);
      const proofCanvas = document.createElement("canvas");
      proofCanvas.width = outW;
      proofCanvas.height = outH;

      const ctx = proofCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not get proof canvas context");

      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(baseImg, 0, 0, outW, outH);

      const baseW = Math.max(1, Number(placement.baseW || placement.canvasW || outW));
      const baseH = Math.max(1, Number(placement.baseH || placement.canvasH || outH));
      const baseLeft = Number(placement.baseLeft || 0);
      const baseTop = Number(placement.baseTop || 0);

      const xRel = (Number(placement.cx || 0) - baseLeft) / baseW;
      const yRel = (Number(placement.cy || 0) - baseTop) / baseH;
      const wRel = Number(placement.w || 0) / baseW;
      const hRel = Number(placement.h || 0) / baseH;

      const drawW = wRel * outW;
      const drawH = hRel * outH;
      const drawX = xRel * outW - drawW / 2;
      const drawY = yRel * outH - drawH / 2;

      ctx.drawImage(overlayImg, drawX, drawY, drawW, drawH);

      return await bdCanvasToBlob(proofCanvas);
    } catch (err) {
      console.error("Proof render failed", err);
      throw err;
    } finally {
      if (ephemeralDesignUrl) {
        try {
          URL.revokeObjectURL(ephemeralDesignUrl);
        } catch (e) {}
      }
    }
  };

  let bdProofSyncTimer = { front: null, back: null };
  let bdProofRefreshTimer = null;
  let bdProofSubmitLock = false;
  let bdProofSyncSeq = { front: 0, back: 0 };
  let bdProofLastUploadedKey = { front: "", back: "" };
  let bdProofLastUrl = { front: "", back: "" };
  let bdProofInFlightPromise = { front: null, back: null };
  let bdProofDirty = { front: false, back: false };
  let bdDesignFinalized = false;
  let bdFinalizeInProgress = false;
  let bdFinalizePromise = null;
  let bdFinalizeRunSeq = 0;
  let bdFinalizeOwnedSideRunSeq = { front: 0, back: 0 };
  let bdApprovedProofState = null;
  let bdLastInvalidationReason = "";

  const bdBuildFinalizeRecoveryDebugState = () => {
    const approvedState = bdApprovedProofState
      ? {
          requiredSides: (bdApprovedProofState.requiredSides || []).slice(),
          proofFrontUrl: String(bdApprovedProofState.proofFrontUrl || "").trim(),
          proofBackUrl: String(bdApprovedProofState.proofBackUrl || "").trim(),
          proofKeys: {
            front: String((bdApprovedProofState.proofKeys && bdApprovedProofState.proofKeys.front) || "").trim(),
            back: String((bdApprovedProofState.proofKeys && bdApprovedProofState.proofKeys.back) || "").trim()
          }
        }
      : null;

    return {
      activeSide: bdGetActiveSide(),
      requiredSides: bdGetRequiredProofSides(),
      designFinalized: !!bdDesignFinalized,
      finalizeInProgress: !!bdFinalizeInProgress,
      lastInvalidationReason: String(bdLastInvalidationReason || "").trim(),
      proofDirty: {
        front: !!bdProofDirty.front,
        back: !!bdProofDirty.back
      },
      proofValid: {
        front: bdIsProofValidForSide("front"),
        back: bdIsProofValidForSide("back")
      },
      proofLastUploadedKey: {
        front: String(bdProofLastUploadedKey.front || "").trim(),
        back: String(bdProofLastUploadedKey.back || "").trim()
      },
      proofLastUrl: {
        front: String(bdProofLastUrl.front || "").trim(),
        back: String(bdProofLastUrl.back || "").trim()
      },
      finalizeOwnedSideRunSeq: {
        front: Number(bdFinalizeOwnedSideRunSeq.front || 0),
        back: Number(bdFinalizeOwnedSideRunSeq.back || 0)
      },
      approvedProofState: approvedState
    };
  };

  const bdGetDesignedProofSides = () => {
    const sides = [];
    if (hasFrontDesign) sides.push("front");
    if (hasBackDesign) sides.push("back");
    return sides;
  };

  const bdHasDesignForSide = (side) => (side === "back" ? hasBackDesign : hasFrontDesign);

  const bdGetRequiredProofSides = () => {
    if (bdIsBackOnlyMode()) return hasBackDesign ? ["back"] : [];
    if (bdIsFrontOnlyMode()) return hasFrontDesign ? ["front"] : [];
    const sides = [];
    if (hasFrontDesign) sides.push("front");
    if (hasBackDesign) sides.push("back");
    return sides;
  };

  const bdGetCurrentProofUrls = () => ({
    front: (bdProofLastUrl.front || "").trim(),
    back: (bdProofLastUrl.back || "").trim()
  });

  const bdGetReadyCopy = () => {
    if (hasFrontDesign && hasBackDesign) {
      return {
        review: "Front and back designs ready",
        cta: "<strong>Front and back designs ready</strong><br>Satisfied with your design?<br>Add it to your cart."
      };
    }
    if (hasFrontDesign) {
      return {
        review: "Front design ready. Back side will be blank.",
        cta: "<strong>Front design ready. Back will be blank.</strong><br>Satisfied with your design?<br>Add it to your cart."
      };
    }
    if (hasBackDesign) {
      return {
        review: "Back design ready. Front side will be blank.",
        cta: "<strong>Back design ready. Front will be blank.</strong><br>Satisfied with your design?<br>Add it to your cart."
      };
    }
    return {
      review: "Proof ready. Review your final design below.",
      cta: "<strong>Satisfied with your design?</strong><br>Add it to your cart."
    };
  };

  const bdGetCurrentCombinedProofUrl = () => {
    const current = bdGetCurrentProofUrls();
    return current.front || current.back || "";
  };

  const bdHasApprovedProofForSide = (side) => {
    if (!bdApprovedProofState) return false;
    const targetSide = side === "back" ? "back" : "front";
    const approvedKey = (bdApprovedProofState.proofKeys && bdApprovedProofState.proofKeys[targetSide]) || "";
    const approvedUrl = targetSide === "back"
      ? (bdApprovedProofState.proofBackUrl || "")
      : (bdApprovedProofState.proofFrontUrl || "");
    return !!(
      approvedKey &&
      approvedUrl &&
      bdProofLastUploadedKey[targetSide] === approvedKey &&
      bdProofLastUrl[targetSide] === approvedUrl &&
      bdIsProofValidForSide(targetSide)
    );
  };

  const bdPruneApprovedProofState = (sides) => {
    if (!bdApprovedProofState) return;
    const blockedSides = Array.from(new Set((sides || []).map((side) => (side === "back" ? "back" : "front"))));
    if (!blockedSides.length) return;

    const remainingSides = (bdApprovedProofState.requiredSides || []).filter((side) => !blockedSides.includes(side));
    if (!remainingSides.length) {
      bdApprovedProofState = null;
      return;
    }

    bdApprovedProofState = {
      requiredSides: remainingSides.slice(),
      proofFrontUrl: remainingSides.includes("front") ? (bdApprovedProofState.proofFrontUrl || "") : "",
      proofBackUrl: remainingSides.includes("back") ? (bdApprovedProofState.proofBackUrl || "") : "",
      proofUrl: remainingSides.includes("front")
        ? (bdApprovedProofState.proofFrontUrl || "")
        : (bdApprovedProofState.proofBackUrl || ""),
      proofKeys: {
        front: remainingSides.includes("front") ? ((bdApprovedProofState.proofKeys && bdApprovedProofState.proofKeys.front) || "") : "",
        back: remainingSides.includes("back") ? ((bdApprovedProofState.proofKeys && bdApprovedProofState.proofKeys.back) || "") : ""
      }
    };
  };

  const bdGetPendingReviewCopy = ({ frontApproved, backApproved } = {}) => {
    if (bdLastInvalidationReason === "base-change" && (hasFrontDesign || hasBackDesign)) {
        return bdIsTotePreview
          ? "Product type changed. Please finalize your design again to generate updated proofs."
          : "Color changed. Please finalize your design again to generate updated proofs.";
    }
    if (hasFrontDesign && hasBackDesign) {
      if (frontApproved && !backApproved) return "Front design ready. Finalize your back design to continue.";
      if (backApproved && !frontApproved) return "Back design ready. Finalize your front design to continue.";
    }
    return "";
  };

  const bdSetReviewStatusContent = (node, line1, { ready = false } = {}) => {
    if (!node) return;
    if (!ready) {
      node.textContent = line1 || "";
      return;
    }
    node.innerHTML = "";
    const primary = document.createElement("div");
    primary.textContent = line1 || "";
    const secondary = document.createElement("div");
    secondary.textContent = "Add to cart below or edit your design.";
    secondary.style.marginTop = "4px";
    secondary.style.opacity = "0.85";
    node.appendChild(primary);
    node.appendChild(secondary);
  };

  const bdIsProofValidForSide = (side) => {
    const targetSide = side === "back" ? "back" : "front";
    const currentKey = bdGetProofStateKey(targetSide);
    return !!(
      currentKey &&
      bdProofLastUploadedKey[targetSide] &&
      bdProofLastUploadedKey[targetSide] === currentKey &&
      bdProofLastUrl[targetSide]
    );
  };

  const bdResetFinalizedState = ({ keepProofs = true, preserveApprovedProofState = false } = {}) => {
    bdFinalizeRecoveryLog("reset-finalized-state:before", {
      keepProofs,
      preserveApprovedProofState,
      state: bdBuildFinalizeRecoveryDebugState()
    });
    bdDesignFinalized = false;
    bdFinalizeInProgress = false;
    bdFinalizePromise = null;
    if (!preserveApprovedProofState) {
      bdApprovedProofState = null;
    }
    bdFinalizeRunSeq += 1;
    if (!keepProofs) {
      bdProofDirty = { front: false, back: false };
    }
    bdFinalizeRecoveryLog("reset-finalized-state:after", {
      keepProofs,
      preserveApprovedProofState,
      state: bdBuildFinalizeRecoveryDebugState()
    });
  };

  const bdForceDisableNativeAddToCart = () => {
    try {
      document.querySelectorAll('form[action^="/cart/add"]').forEach((form) => {
        const addButton =
          form.querySelector('[data-bd-native-add="1"]') ||
          form.querySelector('.product-form__submit[name="add"]') ||
          form.querySelector('button[type="submit"][name="add"]');
        const buttonWrap = addButton ? addButton.closest(".product-form__buttons") : null;
        if (!addButton) return;
        addButton.setAttribute("disabled", "disabled");
        addButton.setAttribute("aria-disabled", "true");
        addButton.dataset.bdPreviewDisabled = "1";
        if (buttonWrap) {
          buttonWrap.dataset.bdPreviewDisabled = "1";
          buttonWrap.classList.add("is-preview-blocked");
        }
      });
    } catch (e) {}
  };

  const bdForceSyncNativeAddToCart = () => {
    try {
      document.querySelectorAll('form[action^="/cart/add"]').forEach((form) => {
        const addButton =
          form.querySelector('[data-bd-native-add="1"]') ||
          form.querySelector('.product-form__submit[name="add"]') ||
          form.querySelector('button[type="submit"][name="add"]');
        const buttonWrap = addButton ? addButton.closest(".product-form__buttons") : null;
        if (!addButton) return;

        const shouldBlock = !bdCanApproveAddToCart() || bdIsCropPending();
        if (shouldBlock) {
          addButton.setAttribute("disabled", "disabled");
          addButton.setAttribute("aria-disabled", "true");
          addButton.dataset.bdPreviewDisabled = "1";
          if (buttonWrap) {
            buttonWrap.dataset.bdPreviewDisabled = "1";
            buttonWrap.classList.add("is-preview-blocked");
          }
          return;
        }

        if (buttonWrap) {
          delete buttonWrap.dataset.bdPreviewDisabled;
          buttonWrap.classList.remove("is-preview-blocked");
        }
        delete addButton.dataset.bdPreviewDisabled;
        const variantInput = form.querySelector(".product-variant-id");
        const labelEl = addButton.querySelector("span");
        const currentLabel = String((labelEl ? labelEl.textContent : addButton.textContent) || "").trim();
        const soldOutLabel = String(addButton.dataset.bdSoldoutLabel || "").trim();
        const unavailableLabel = String(addButton.dataset.bdUnavailableLabel || "").trim();
        const nativeBlocked =
          (variantInput && variantInput.disabled) ||
          (soldOutLabel && currentLabel === soldOutLabel) ||
          (unavailableLabel && currentLabel === unavailableLabel);

        if (nativeBlocked) {
          addButton.setAttribute("disabled", "disabled");
          addButton.setAttribute("aria-disabled", "true");
          return;
        }

        addButton.removeAttribute("disabled");
        addButton.removeAttribute("aria-disabled");
      });
    } catch (e) {}
  };

  const bdRefreshFinalizeUi = () => {
    try {
      bdForceSyncNativeAddToCart();
    } catch (e) {}
    try {
      if (typeof window.bdTshirtGateRefresh === "function") window.bdTshirtGateRefresh();
    } catch (e) {}
    requestAnimationFrame(() => {
      try {
        bdForceSyncNativeAddToCart();
      } catch (e) {}
      try {
        if (typeof window.bdTshirtGateRefresh === "function") window.bdTshirtGateRefresh();
      } catch (e) {}
    });
  };

  const bdCaptureApprovedProofState = () => {
    const requiredSides = bdGetRequiredProofSides();
    if (!requiredSides.length) {
      bdFinalizeRecoveryLog("capture-approved-proof-state", {
        result: "no-required-sides",
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return null;
    }
    if (!requiredSides.every((side) => bdIsProofValidForSide(side))) {
      bdFinalizeRecoveryLog("capture-approved-proof-state", {
        result: "missing-valid-proof",
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return null;
    }
    const proofUrls = bdGetCurrentProofUrls();
    const approvedState = {
      requiredSides: requiredSides.slice(),
      proofFrontUrl: requiredSides.includes("front") ? proofUrls.front : "",
      proofBackUrl: requiredSides.includes("back") ? proofUrls.back : "",
      proofUrl: proofUrls.front || proofUrls.back || "",
      proofKeys: {
        front: requiredSides.includes("front") ? bdProofLastUploadedKey.front : "",
        back: requiredSides.includes("back") ? bdProofLastUploadedKey.back : ""
      }
    };
    bdFinalizeRecoveryLog("capture-approved-proof-state", {
      result: "captured",
      approvedState,
      state: bdBuildFinalizeRecoveryDebugState()
    });
    return approvedState;
  };

  const bdReevaluateFinalizeState = ({ source = "", finalizeRunSeq = 0 } = {}) => {
    const requiredSides = bdGetRequiredProofSides();
    const approvedState = bdCaptureApprovedProofState();
    const ready = !!(!bdIsCropPending() && requiredSides.length && approvedState);
    const finalizeOwnsProofStore = source === "proof-stored" && finalizeRunSeq > 0 && finalizeRunSeq === bdFinalizeRunSeq;
    const finalizeWasActive = !!(bdFinalizeInProgress || bdDesignFinalized || finalizeOwnsProofStore);

    bdFinalizeRecoveryLog("reevaluate-finalize-state:start", {
      source,
      finalizeRunSeq,
      finalizeOwnsProofStore,
      ready,
      finalizeWasActive,
      approvedState,
      state: bdBuildFinalizeRecoveryDebugState()
    });

    if (ready && finalizeWasActive) {
      bdApprovedProofState = approvedState;
      bdDesignFinalized = true;
      bdLastInvalidationReason = "";
      if (bdFinalizeInProgress) {
        bdFinalizeInProgress = false;
        bdFinalizePromise = null;
      }
    }

    bdFinalizeRecoveryLog("reevaluate-finalize-state:end", {
      source,
      finalizeRunSeq,
      finalizeOwnsProofStore,
      ready,
      finalizeWasActive,
      approvedState,
      state: bdBuildFinalizeRecoveryDebugState()
    });

    return !!(ready && finalizeWasActive);
  };

  const bdCanApproveAddToCart = () => {
    if (bdIsCropPending()) return false;
    if (bdLastInvalidationReason === "base-change") return false;
    if (!bdDesignFinalized || !bdApprovedProofState) return false;
    const requiredSides = bdGetRequiredProofSides();
    if (!requiredSides.length) return false;
    return requiredSides.every((side) => {
      const approvedKey = bdApprovedProofState.proofKeys[side] || "";
      const approvedUrl = side === "back" ? bdApprovedProofState.proofBackUrl : bdApprovedProofState.proofFrontUrl;
      return !!(
        approvedKey &&
        approvedUrl &&
        bdProofLastUploadedKey[side] === approvedKey &&
        bdProofLastUrl[side] === approvedUrl &&
        bdIsProofValidForSide(side)
      );
    });
  };

  const bdApplyRestoredDraftForSide = (side, draftSide) => {
    const s = side === "back" ? "back" : "front";
    if (!draftSide || !bdIsDurableRestoreUrl(draftSide.designUrl)) return false;

    const placement = bdSafeJsonParse(draftSide.placementRaw);
    if (!placement) return false;

    const nextUrl = String(draftSide.designUrl || "").trim();
    const nextPlacementRaw = JSON.stringify(placement);
    const nextEditRaw = String(draftSide.editRaw || "").trim();
    const form = bdFindCartForm();
    const targetState = s === "back" ? stateBack : stateFront;

    if (s === "back") {
      bdSafeRevokeObjectUrl(objectUrlBack);
      objectUrlBack = nextUrl;
      hasBackDesign = true;
    } else {
      bdSafeRevokeObjectUrl(objectUrlFront);
      objectUrlFront = nextUrl;
      hasFrontDesign = true;
    }

    targetState.cx = Number(placement.cx || 0);
    targetState.cy = Number(placement.cy || 0);
    targetState.w = Number(placement.w || 0);
    targetState.h = Number(placement.h || 0);
    targetState.ar = Number(placement.ar || (targetState.w && targetState.h ? targetState.w / Math.max(1, targetState.h) : 1) || 1);

    if (form) {
      const { placementFront, placementBack, editFront, editBack } = bdEnsurePropertyInputs(form);
      const placementEl = s === "back" ? placementBack : placementFront;
      const editEl = s === "back" ? editBack : editFront;
      if (placementEl) placementEl.value = nextPlacementRaw;
      if (editEl) editEl.value = nextEditRaw;
    }

    bdSetRealUploaderDesignUrl(s === "back" ? 2 : 1, nextUrl);
    bdRestoreRealUploaderPreview(s, nextUrl);
    return true;
  };

  const bdRestoreDraftSession = () => {
    if (bdDraftRestoreHandled) return false;
    const snapshot = bdReadDraftSessionSnapshot();
    if (!snapshot) return false;

    if (bdIsTotePreview) {
      let restoredMode = String(snapshot.resolvedMode || "").trim().toLowerCase();
      if (snapshot.back && bdIsDurableRestoreUrl(snapshot.back.designUrl)) {
        restoredMode = "front-back";
      } else if (snapshot.front && bdIsDurableRestoreUrl(snapshot.front.designUrl) && restoredMode !== "front-back") {
        restoredMode = "front-only";
      }
      if (restoredMode === "front-only" || restoredMode === "front-back") {
        bdResolvedPreviewMode = restoredMode;
        box.dataset.bdResolvedMode = restoredMode;
      }
    }

    const restoredFront = bdApplyRestoredDraftForSide("front", snapshot.front);
    const restoredBack = bdApplyRestoredDraftForSide("back", snapshot.back);
    const restoredSides = [];
    if (restoredFront) restoredSides.push("front");
    if (restoredBack) restoredSides.push("back");
    if (!restoredSides.length) {
      bdClearDraftSessionSnapshot();
      return false;
    }

    if (bdIsTotePreview) {
      const restoredMode = restoredBack ? "front-back" : "front-only";
      bdResolvedPreviewMode = restoredMode;
      box.dataset.bdResolvedMode = restoredMode;
    }

    bdProofDirty.front = restoredFront;
    bdProofDirty.back = restoredBack;
    bdSignalUploadSelected(true);

    const form = bdFindCartForm();
    if (form) {
      const inputs = bdEnsurePropertyInputs(form);
      if (inputs.previewFlow) inputs.previewFlow.value = "";
      if (inputs.proofStatus) inputs.proofStatus.value = "";
    }

    window.bdSetProofMockupUrl("", "front");
    window.bdSetProofMockupUrl("", "back");
    window.bdSetProofMockupUrl("");
    window.bdSetDesignUploadUrl(bdGetRealUploaderDesignUrl(1) || bdGetRealUploaderDesignUrl(2) || "");

    const activeSide =
      snapshot.activeSide === "back" && restoredBack
        ? "back"
        : restoredFront
          ? "front"
          : "back";
    bdRememberPreferredActiveSide(activeSide);

    try {
      bdApplyProductConfigUi();
    } catch (e) {}
    bdSetActiveSideUi(activeSide);
    bdUseSideState(activeSide);
    try {
      if (typeof bdSyncInlineUploadInfo === "function") bdSyncInlineUploadInfo();
    } catch (e) {}
    bdInvalidateProofState(restoredSides, {
      reason: "draft-restore",
      markDirty: {
        front: restoredFront,
        back: restoredBack
      }
    });

    try {
      if (bdStartGateEnabled) {
        bdOpenDesignerUi({ suppressAutoStartSide: true, suppressScroll: true });
      }
    } catch (e) {}

    requestAnimationFrame(() => {
      try {
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide(activeSide, { deferVisibleUntilLoaded: true, skipPersistBeforeSwitch: true });
        }
      } catch (e) {}
      bdScheduleDraftSessionPersist();
    });

    bdDraftRestoreHandled = true;
    return true;
  };

  const bdGetNavigationType = () => {
    try {
      const navEntries = window.performance && typeof window.performance.getEntriesByType === "function"
        ? window.performance.getEntriesByType("navigation")
        : [];
      const navEntry = navEntries && navEntries[0];
      return String((navEntry && navEntry.type) || "").trim().toLowerCase();
    } catch (e) {
      return "";
    }
  };

  const bdShouldRestoreDraftSession = ({ persisted = false } = {}) => {
    if (persisted) return true;
    const navType = bdGetNavigationType();
    if (navType === "back_forward") return true;
    const referrer = String(document.referrer || "").trim().toLowerCase();
    return /\/cart(?:[?#]|$)/.test(referrer);
  };

  const bdUpdateReviewUi = () => {
    const finalizeBtn = box.querySelector('[data-bd-finalize-btn="1"]');
    const editBtn = box.querySelector('[data-bd-edit-btn="1"]');
    const reviewStatus = box.querySelector('[data-bd-finalize-status="1"]');
    const reviewActions = box.querySelector('[data-bd-finalize-actions="1"]');
    const reviewWrap = box.querySelector('[data-bd-proof-review-wrap="1"]');
    if (!finalizeBtn || !editBtn || !reviewStatus || !reviewActions || !reviewWrap) return;

    const requiredSides = bdGetRequiredProofSides();
    const hasAnyDesign = requiredSides.length > 0;
    const isCropPending = bdIsCropPending();
    const readyNow = bdReevaluateFinalizeState({ source: "review-ui" });
    const currentProofs = bdGetCurrentProofUrls();
    const frontValid = bdIsProofValidForSide("front");
    const backValid = bdIsProofValidForSide("back");
    const frontApproved = bdHasApprovedProofForSide("front");
    const backApproved = bdHasApprovedProofForSide("back");
    const pendingReviewCopy = bdGetPendingReviewCopy({ frontApproved, backApproved });

    reviewWrap.innerHTML = "";
    [
      { side: "front", label: "Front proof", url: currentProofs.front, show: (readyNow && requiredSides.includes("front") && frontValid) || frontApproved },
      { side: "back", label: "Back proof", url: currentProofs.back, show: (readyNow && requiredSides.includes("back") && backValid) || backApproved }
    ].forEach((entry) => {
      if (!entry.show || !entry.url) return;
      const item = document.createElement("a");
      item.href = entry.url;
      item.target = "_blank";
      item.rel = "noopener";
      item.className = "bd-proof-review__item";
      const img = document.createElement("img");
      img.src = entry.url;
      img.alt = entry.label;
      img.loading = "lazy";
      img.width = 88;
      img.height = 88;
      const caption = document.createElement("span");
      caption.textContent = entry.label;
      item.appendChild(img);
      item.appendChild(caption);
      reviewWrap.appendChild(item);
    });
    reviewWrap.hidden = isCropPending || reviewWrap.childElementCount === 0;

    finalizeBtn.hidden = !hasAnyDesign || bdFinalizeInProgress || (bdDesignFinalized && !isCropPending);
    finalizeBtn.disabled = !hasAnyDesign || bdFinalizeInProgress || isCropPending;
    finalizeBtn.setAttribute("aria-disabled", finalizeBtn.disabled ? "true" : "false");
    editBtn.hidden = !hasAnyDesign || bdFinalizeInProgress || !bdDesignFinalized || isCropPending;
    editBtn.disabled = !bdDesignFinalized || isCropPending;
    editBtn.setAttribute("aria-disabled", editBtn.disabled ? "true" : "false");
    reviewActions.hidden = !hasAnyDesign;

    if (!hasAnyDesign) {
      bdSetReviewStatusContent(reviewStatus, "Please upload your design before finalizing.");
    } else if (isCropPending) {
      bdSetReviewStatusContent(reviewStatus, "Apply or cancel crop before finalizing your design.");
    } else if (readyNow && bdDesignFinalized && bdCanApproveAddToCart()) {
      bdSetReviewStatusContent(reviewStatus, bdGetReadyCopy().review, { ready: true });
    } else if (pendingReviewCopy) {
      bdSetReviewStatusContent(reviewStatus, pendingReviewCopy);
    } else if (requiredSides.some((side) => bdProofDirty[side])) {
      bdSetReviewStatusContent(reviewStatus, "Design changed. Finalize again to regenerate the required proof before adding to cart.");
    } else {
      bdSetReviewStatusContent(reviewStatus, "Finalize your design to generate the required proof before adding to cart.");
    }
    bdScheduleSoftPrintRefresh();
  };

  const bdInvalidateProofState = (sides, { reason = "", markDirty = {} } = {}) => {
    const uniqueSides = Array.from(new Set((sides || []).map((side) => (side === "back" ? "back" : "front"))));
    if (!uniqueSides.length) return;

    bdFinalizeRecoveryLog("invalidate-proof-state:start", {
      reason,
      sides: uniqueSides.slice(),
      markDirty,
      state: bdBuildFinalizeRecoveryDebugState()
    });

    uniqueSides.forEach((side) => {
      clearTimeout(bdProofSyncTimer[side]);
      bdProofSyncTimer[side] = null;
      bdProofSyncSeq[side] += 1;
      bdProofLastUploadedKey[side] = "";
      bdProofLastUrl[side] = "";
      bdProofDirty[side] = !!markDirty[side];
      window.bdSetProofMockupUrl("", side);
    });
    window.bdSetProofMockupUrl(bdGetCurrentCombinedProofUrl());
    try {
      const form = bdFindCartForm();
      const inputs = bdEnsurePropertyInputs(form);
      if (inputs.previewFlow) inputs.previewFlow.value = "";
      if (inputs.proofStatus) inputs.proofStatus.value = "";
    } catch (e) {}
    bdLastInvalidationReason = reason || "";
    if (reason === "base-change") {
      bdResetFinalizedState();
    } else {
      bdPruneApprovedProofState(uniqueSides);
      bdResetFinalizedState({ preserveApprovedProofState: true });
    }
    bdForceDisableNativeAddToCart();
    bdUpdateReviewUi();
    bdRefreshFinalizeUi();
    requestAnimationFrame(() => {
      bdForceDisableNativeAddToCart();
      bdRefreshFinalizeUi();
    });
    bdFinalizeRecoveryLog("invalidate-proof-state:end", {
      reason,
      sides: uniqueSides.slice(),
      state: bdBuildFinalizeRecoveryDebugState()
    });
  };

  const bdEnterEditDesignMode = () => {
    bdFinalizeRecoveryLog("enter-edit-design-mode", {
      state: bdBuildFinalizeRecoveryDebugState()
    });
    bdResetFinalizedState({ keepProofs: true, preserveApprovedProofState: true });
    bdUpdateReviewUi();
    bdRefreshFinalizeUi();
  };

  const bdFinalizeDesignProofs = async () => {
    const requiredSides = bdGetRequiredProofSides();
    const originalActiveSide = bdLastInvalidationReason === "draft-restore"
      ? (bdPreferredActiveSide === "back" ? "back" : "front")
      : bdGetActiveSide();
    bdFinalizeRecoveryLog("finalize-design-proofs:start", {
      originalActiveSide,
      requiredSides: requiredSides.slice(),
      state: bdBuildFinalizeRecoveryDebugState()
    });
    if (!requiredSides.length) {
      bdUpdateReviewUi();
      bdRefreshFinalizeUi();
      return false;
    }
    if (bdIsCropPending()) {
      bdUpdateReviewUi();
      bdRefreshFinalizeUi();
      return false;
    }
    if (bdFinalizeInProgress && bdFinalizePromise) return bdFinalizePromise;

    const runSeq = ++bdFinalizeRunSeq;
    const forceVisibleRestoreRender = false;
    bdDesignFinalized = false;
    bdApprovedProofState = null;
    bdFinalizeInProgress = true;
    bdFinalizeRecoveryLog("finalize-design-proofs:armed", {
      runSeq,
      requiredSides: requiredSides.slice(),
      state: bdBuildFinalizeRecoveryDebugState()
    });
    bdUpdateReviewUi();
    bdRefreshFinalizeUi();

    bdFinalizePromise = (async () => {
      const pendingSides = requiredSides.filter((side) => {
        if (!bdHasDesignForSide(side)) return false;
        if (!bdProofDirty[side] && bdIsProofValidForSide(side)) return false;
        return true;
      });
      const isDraftRestoreFinalize = bdLastInvalidationReason === "draft-restore";

      bdFinalizeRecoveryLog("finalize-design-proofs:pending-sides", {
        runSeq,
        pendingSides: pendingSides.slice(),
        forceVisibleRestoreRender,
        state: bdBuildFinalizeRecoveryDebugState()
      });

      let preparedPromise = null;
      pendingSides.forEach((side) => {
        bdFinalizeOwnedSideRunSeq[side] = runSeq;
      });
      for (let i = 0; i < pendingSides.length; i += 1) {
        const side = pendingSides[i];
        const nextSide = pendingSides[i + 1] || null;

        bdFinalizeRecoveryLog("finalize-design-proofs:before-side-commit", {
          runSeq,
          side,
          nextSide,
          state: bdBuildFinalizeRecoveryDebugState()
        });

        if (bdProofInFlightPromise[side]) {
          try {
            await bdProofInFlightPromise[side];
          } catch (e) {}
        }

        if (!preparedPromise) {
          preparedPromise = bdPrepareProofSyncForSide({
            side,
            force: true,
            silent: side !== bdGetActiveSide()
          });
        }

        const prepared = await preparedPromise;

        if (nextSide) {
          preparedPromise = bdPrepareProofSyncForSide({
            side: nextSide,
            force: true,
            silent: nextSide !== bdGetActiveSide()
          });
        } else {
          preparedPromise = null;
        }

        const seq = ++bdProofSyncSeq[side];
        await bdCommitPreparedProofSync({ prepared, seq, finalizeRunSeq: runSeq });

        bdFinalizeRecoveryLog("finalize-design-proofs:after-side-commit", {
          runSeq,
          side,
          seq,
          state: bdBuildFinalizeRecoveryDebugState()
        });
      }

      if (runSeq !== bdFinalizeRunSeq) return false;
      const approvedState = bdCaptureApprovedProofState();
      bdApprovedProofState = approvedState;
      bdDesignFinalized = !!approvedState;
      if (bdDesignFinalized) {
        bdLastInvalidationReason = "";
      }
      bdFinalizeRecoveryLog("finalize-design-proofs:resolved", {
        runSeq,
        approvedState,
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return bdDesignFinalized;
    })().catch(() => false).finally(() => {
      Object.keys(bdFinalizeOwnedSideRunSeq).forEach((side) => {
        if (bdFinalizeOwnedSideRunSeq[side] === runSeq) {
          bdFinalizeOwnedSideRunSeq[side] = 0;
        }
      });
      if (runSeq === bdFinalizeRunSeq) {
        bdFinalizeInProgress = false;
      }
      bdFinalizePromise = null;
      bdFinalizeRecoveryLog("finalize-design-proofs:finally", {
        runSeq,
        state: bdBuildFinalizeRecoveryDebugState()
      });
      bdUpdateReviewUi();
      bdRefreshFinalizeUi();
      if (runSeq === bdFinalizeRunSeq && forceVisibleRestoreRender) {
        bdRememberPreferredActiveSide(originalActiveSide);
        try {
          if (typeof window.bdSwitchPreviewSide === "function") {
            window.bdSwitchPreviewSide(originalActiveSide, { deferVisibleUntilLoaded: true, skipPersistBeforeSwitch: true });
          } else {
            bdSetActiveSideUi(originalActiveSide);
            bdUseSideState(originalActiveSide);
          }
        } catch (e) {}
        try {
          bdPersistDraftSessionNow();
        } catch (e) {}
      }
      if (runSeq === bdFinalizeRunSeq && bdDesignFinalized) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            bdRevealProofAreaAfterFinalize();
          }, 120);
        });
      }
    });

    return bdFinalizePromise;
  };

  const bdInvalidateProofMockupsForBaseChange = () => {
    clearTimeout(bdProofSyncTimer.front);
    clearTimeout(bdProofSyncTimer.back);
    clearTimeout(bdProofRefreshTimer);
    bdProofSyncTimer.front = null;
    bdProofSyncTimer.back = null;
    bdProofRefreshTimer = null;

    bdInvalidateProofState(["front", "back"], {
      reason: "base-change",
      markDirty: {
        front: hasFrontDesign,
        back: hasBackDesign
      }
    });
  };

  const bdGetProofStateKey = (side) => {
    const s = side === "back" ? "back" : "front";
    const designSrc = s === "back" ? objectUrlBack : objectUrlFront;
    const hasDesign = s === "back" ? hasBackDesign : hasFrontDesign;
    const placement = bdGetPlacementPayloadForSide(s);
    const freshBaseSrc = bdGetFreshProofBaseSrcForSide(s);
    const baseSrc = freshBaseSrc || (
      previewBaseImg
        ? (
            previewBaseImg.getAttribute(s === "back" ? "data-back-src" : "data-front-src") ||
            previewBaseImg.currentSrc ||
            previewBaseImg.src ||
            ""
          )
        : ""
    );
    if (!hasDesign || !designSrc || !placement || !baseSrc) return "";
    return JSON.stringify({
      side: s,
      baseSrc,
      designSrc,
      placement
    });
  };

  const bdPrepareProofSyncForSide = async ({ side, force = false, silent = false } = {}) => {
    const targetSide = side === "back" ? "back" : "front";
    if (typeof window.bdEnsureTshirtColorMockupMapLoaded === "function") {
      try { await window.bdEnsureTshirtColorMockupMapLoaded(); } catch (e) {}
    }
    const proofKey = bdGetProofStateKey(targetSide);
    if (!proofKey) {
      window.bdSetProofMockupUrl("", targetSide);
      bdProofLastUploadedKey[targetSide] = "";
      bdProofLastUrl[targetSide] = "";
      bdProofDirty[targetSide] = bdHasDesignForSide(targetSide);
      if (!hasFrontDesign && !hasBackDesign) window.bdSetProofMockupUrl("");
      return { side: targetSide, proofKey: "", blob: null, reused: false, url: "" };
    }

    if (!force && bdProofLastUploadedKey[targetSide] === proofKey && bdProofLastUrl[targetSide]) {
      window.bdSetProofMockupUrl(bdProofLastUrl[targetSide], targetSide);
      return {
        side: targetSide,
        proofKey,
        blob: null,
        reused: true,
        url: bdProofLastUrl[targetSide]
      };
    }

    bdRecordProofPhase(targetSide, "render-start");
    const blob = await bdRenderProofBlobForSide(targetSide, { silent });
    if (!blob) return { side: targetSide, proofKey: "", blob: null, reused: false, url: "" };
    bdRecordProofPhase(targetSide, "blob-ready");
    return { side: targetSide, proofKey, blob, reused: false, url: "" };
  };

  const bdCommitPreparedProofSync = async ({ prepared, seq, finalizeRunSeq = 0 } = {}) => {
    const targetSide = prepared && prepared.side === "back" ? "back" : "front";
    const proofKey = prepared ? String(prepared.proofKey || "").trim() : "";

    bdFinalizeRecoveryLog("commit-prepared-proof-sync:start", {
      side: targetSide,
      seq,
      finalizeRunSeq,
      proofKey,
      prepared: prepared
        ? {
            side: prepared.side,
            reused: !!prepared.reused,
            url: String(prepared.url || "").trim(),
            hasBlob: !!prepared.blob
          }
        : null,
      state: bdBuildFinalizeRecoveryDebugState()
    });

    if (!proofKey) {
      window.bdSetProofMockupUrl("", targetSide);
      bdProofLastUploadedKey[targetSide] = "";
      bdProofLastUrl[targetSide] = "";
      bdProofDirty[targetSide] = bdHasDesignForSide(targetSide);
      if (!hasFrontDesign && !hasBackDesign) window.bdSetProofMockupUrl("");
      bdFinalizeRecoveryLog("commit-prepared-proof-sync:no-proof-key", {
        side: targetSide,
        seq,
        finalizeRunSeq,
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return "";
    }

    if (prepared && prepared.reused && prepared.url) {
      bdFinalizeRecoveryLog("commit-prepared-proof-sync:reused", {
        side: targetSide,
        seq,
        finalizeRunSeq,
        url: String(prepared.url || "").trim(),
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return String(prepared.url || "").trim();
    }

    const blob = prepared ? prepared.blob : null;
    if (!blob) {
      bdFinalizeRecoveryLog("commit-prepared-proof-sync:missing-blob", {
        side: targetSide,
        seq,
        finalizeRunSeq,
        state: bdBuildFinalizeRecoveryDebugState()
      });
      return "";
    }

    let url = "";
    try {
      url = await bdUploadProofBlobToCloudinary({ blob, side: targetSide });
    } catch (err) {
      console.error("Proof Cloudinary upload failed", err);
      throw err;
    }
    if (seq !== bdProofSyncSeq[targetSide]) return "";
    bdRecordProofPhase(targetSide, "upload-done");

    bdProofLastUploadedKey[targetSide] = proofKey;
    bdProofLastUrl[targetSide] = (url || "").trim();
    bdProofDirty[targetSide] = false;
    try {
      window.bdSetProofMockupUrl(bdProofLastUrl[targetSide], targetSide);
    } catch (err) {
      console.error("Proof URL assignment failed", err);
      throw err;
    }
    bdFinalizeRecoveryLog("commit-prepared-proof-sync:stored", {
      side: targetSide,
      seq,
      finalizeRunSeq,
      uploadedUrl: bdProofLastUrl[targetSide],
      state: bdBuildFinalizeRecoveryDebugState()
    });
    bdReevaluateFinalizeState({ source: "proof-stored", finalizeRunSeq });
    bdFinalizeRecoveryLog("commit-prepared-proof-sync:after-reevaluate", {
      side: targetSide,
      seq,
      finalizeRunSeq,
      state: bdBuildFinalizeRecoveryDebugState()
    });
    bdUpdateReviewUi();
    bdRefreshFinalizeUi();
    return bdProofLastUrl[targetSide];
  };

  const bdSyncProofMockupNow = async ({ side, force = false, silent = false } = {}) => {
    const targetSide = side === "back" ? "back" : side === "front" ? "front" : bdGetActiveSide();
    const finalizeOwnerRunSeq = Number(bdFinalizeOwnedSideRunSeq[targetSide] || 0);

    if (finalizeOwnerRunSeq > 0 && bdFinalizeInProgress) {
      bdFinalizeRecoveryLog("sync-proof-mockup-now:deferred-to-finalize-owner", {
        side: targetSide,
        force,
        silent,
        finalizeOwnerRunSeq,
        state: bdBuildFinalizeRecoveryDebugState()
      });
      if (bdFinalizePromise) {
        try {
          await bdFinalizePromise;
        } catch (e) {}
      }
      return String(bdProofLastUrl[targetSide] || "").trim();
    }

    const seq = ++bdProofSyncSeq[targetSide];
    bdProofInFlightPromise[targetSide] = (async () => {
      const prepared = await bdPrepareProofSyncForSide({ side: targetSide, force, silent });
      return bdCommitPreparedProofSync({ prepared, seq });
    })().catch((err) => {
      console.error("Proof mockup sync failed", err);
      return "";
    }).finally(() => {
      bdProofInFlightPromise[targetSide] = null;
    });

    return bdProofInFlightPromise[targetSide];
  };

  const bdScheduleProofMockupSync = ({ delay = 650, side, force = false, silent = false } = {}) => {
    if (bdProofSubmitLock) return;
    const targetSide = side === "back" ? "back" : side === "front" ? "front" : bdGetActiveSide();
    clearTimeout(bdProofSyncTimer[targetSide]);
    bdProofSyncTimer[targetSide] = setTimeout(() => {
      bdProofSyncTimer[targetSide] = null;
      if (bdProofSubmitLock) return;
      bdSyncProofMockupNow({ side: targetSide, force, silent });
    }, Math.max(500, Math.min(800, delay)));
  };

  window.bdEnsureProofMockupUrl = async function ({ force = false, silent = false } = {}) {
    const side = bdGetActiveSide();
    clearTimeout(bdProofSyncTimer[side]);
    bdProofSyncTimer[side] = null;
    clearTimeout(bdProofRefreshTimer);
    bdProofRefreshTimer = null;
    if (bdProofInFlightPromise[side]) {
      try {
        await bdProofInFlightPromise[side];
      } catch (e) {}
    }
    return bdSyncProofMockupNow({ side, force, silent });
  };

  window.bdEnsureAllProofMockupUrls = async function ({ force = false } = {}) {
    clearTimeout(bdProofSyncTimer.front);
    clearTimeout(bdProofSyncTimer.back);
    bdProofSyncTimer.front = null;
    bdProofSyncTimer.back = null;
    clearTimeout(bdProofRefreshTimer);
    bdProofRefreshTimer = null;
    const tasks = [];
    if (hasFrontDesign) tasks.push("front");
    if (hasBackDesign) tasks.push("back");
    if (!tasks.length) return "";

    for (const side of tasks) {
      if (bdProofInFlightPromise[side]) {
        try {
          await bdProofInFlightPromise[side];
        } catch (e) {}
      }
      await bdSyncProofMockupNow({ side, force, silent: side !== bdGetActiveSide() });
    }

    const form = bdFindCartForm();
    return bdProofLastUrl.front || bdProofLastUrl.back || "";
  };

  window.__bdTshirtPreviewState = {
    isFrontBack: () => !!bdIsFrontBackMode(),
    hasFrontDesign: () => !!hasFrontDesign,
    hasBackDesign: () => !!hasBackDesign,
    getActiveSide: () => bdGetActiveSide(),
    outsideSafePrintArea: false,
    safePrintGarmentType: bdGetSafePrintGarmentType(),
    safePrintSide: bdGetActiveSide(),
    safePrintAreaSkipped: bdGetSafePrintSkipMeta().skipped,
    safePrintAreaSkipReason: bdGetSafePrintSkipMeta().reason,
    syncBaseByVariantColor: () => bdSyncBaseByVariantColor(),
    invalidateProofMockupsForBaseChange: () => bdInvalidateProofMockupsForBaseChange(),
    getRequiredProofSides: () => bdGetRequiredProofSides(),
    isProofValidForSide: (side) => bdIsProofValidForSide(side),
    isFinalizeInProgress: () => !!bdFinalizeInProgress,
    isDesignFinalized: () => !!bdDesignFinalized,
    canApproveAddToCart: () => bdCanApproveAddToCart(),
    isCropPending: () => bdIsCropPending(),
    reevaluateFinalizeState: (opts) => bdReevaluateFinalizeState(opts),
    hasApprovedProofForSide: (side) => bdHasApprovedProofForSide(side),
    getPendingReviewCopy: (opts) => bdGetPendingReviewCopy(opts),
    getReadyCopy: () => bdGetReadyCopy(),
    finalizeDesignProofs: () => bdFinalizeDesignProofs(),
    enterEditDesignMode: () => bdEnterEditDesignMode(),
    getApprovedProofState: () => (bdApprovedProofState ? JSON.parse(JSON.stringify(bdApprovedProofState)) : null),
    buildApprovedSubmitSnapshot: (form) => bdBuildSubmitSnapshot(form, window.__bdTshirtPreviewState),
    clearProofRefreshTimers: () => {
      clearTimeout(bdProofSyncTimer.front);
      clearTimeout(bdProofSyncTimer.back);
      clearTimeout(bdProofRefreshTimer);
      bdProofSyncTimer.front = null;
      bdProofSyncTimer.back = null;
      bdProofRefreshTimer = null;
    },
    setProofSubmitLock: (value) => {
      bdProofSubmitLock = !!value;
    },
    switchPreviewSide: (side) => {
      if (typeof window.bdSwitchPreviewSide === "function") {
        window.bdSwitchPreviewSide(side);
      }
    },
    refreshFinalizeUi: () => {
      bdUpdateReviewUi();
    }
  };

  let bdPlacementRefreshFrame = 0;
  const bdSchedulePlacementRefresh = () => {
    if (bdPlacementRefreshFrame) return;
    bdPlacementRefreshFrame = requestAnimationFrame(() => {
      bdPlacementRefreshFrame = 0;
      if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate();
    });
  };

  const apply = () => {
    wrap.style.left = `${state.cx}px`;
    wrap.style.top = `${state.cy}px`;
    wrap.style.width = `${state.w}px`;
    wrap.style.height = `${state.h}px`;

    dimLabel.textContent = `W: ${Math.round(state.w)}px  H: ${Math.round(state.h)}px`;
    dimLabel.hidden = false;

    bdWritePlacement();
    bdSchedulePlacementRefresh();
    bdScheduleSoftPrintRefresh();
  };

  // safe hook for other scripts
  window.bdHeroPreviewUpdate = function () {
    try {
      document.dispatchEvent(new CustomEvent("bd:placement-updated"));
    } catch (e) {}
  };

  // keep zone aligned with base loads/resizes
  if (previewBaseImg) {
    previewBaseImg.addEventListener("load", () => {
      try {
        bdUpdatePrintZoneFromInches();
      } catch (e) {}
      bdScheduleSoftPrintRefresh();
      if (bdDraftRestoreInProgress) return;
      try {
        document.dispatchEvent(new CustomEvent("bd:base-changed"));
      } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
      } catch (e) {}
      try {
        if (typeof bdUpdateReviewUi === "function") bdUpdateReviewUi();
        if (typeof bdRefreshFinalizeUi === "function") bdRefreshFinalizeUi();
      } catch (e) {}
    });
  }

  requestAnimationFrame(() => {
    try {
      bdUpdatePrintZoneFromInches();
    } catch (e) {}
    bdScheduleSoftPrintRefresh();
  });

  window.addEventListener("resize", () =>
    requestAnimationFrame(() => {
      try {
        bdUpdatePrintZoneFromInches();
      } catch (e) {}
      bdScheduleSoftPrintRefresh();
    })
  );

  // --------------------------
  // Show/hide
  // --------------------------
  const resetToCenter = () => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    if (!cw || !ch) {
      requestAnimationFrame(resetToCenter);
      return;
    }

    bdUpdatePrintZoneFromInches();
    if (bdIsTotePreview) {
      try {
        bdRefreshSoftPrintArea();
      } catch (e) {}
    }

    const z = bdGetInitialCenterZone();
    state.cx = z.left + z.width / 2;
    state.cy = z.top + z.height / 2;

    const initW = Math.round(cw * 0.4);
    state.w = clamp(initW, 60, Math.round(cw * 0.95));
    state.h = Math.round(state.w / state.ar);

    bdClampSizeAndPosToZone();
  };

  const showPreview = () => {
    if (bdStartGateEnabled && designerBody && bdIsElementActuallyHidden(designerBody)) {
      bdOpenDesignerUi({ suppressAutoStartSide: true, suppressScroll: true });
    }

    box.classList.remove("is-hidden");

    wrap.hidden = false;
    wrap.removeAttribute("hidden");
    wrap.style.display = "block";
    wrap.classList.add("is-active");

    designImg.hidden = false;
    designImg.removeAttribute("hidden");

    box.classList.add("has-design");

    requestAnimationFrame(() => {
      bdUpdatePrintZoneFromInches();
      bdClampSizeAndPosToZone();
      apply();
      bdScheduleSoftPrintRefresh();
    });
  };

  const bdSignalUploadSelected = (hasFile) => {
    try {
      window.__bdTshirtHasFileSelected = !!hasFile;
      if (typeof window.bdTshirtGateRefresh === "function") window.bdTshirtGateRefresh();
    } catch (e) {}
  };

  const hidePreview = (sideToClear) => {
    if (sideToClear === "back") {
      bdSafeRevokeObjectUrl(objectUrlBack);
      objectUrlBack = null;
      hasBackDesign = false;
    } else if (sideToClear === "front") {
      bdSafeRevokeObjectUrl(objectUrlFront);
      objectUrlFront = null;
      hasFrontDesign = false;
    }

    const any = !!(hasFrontDesign || hasBackDesign);
    bdSignalUploadSelected(any);

    designImg.hidden = true;
    wrap.style.display = "none";
    dimLabel.hidden = true;
    box.classList.toggle("has-design", any);

    const form = bdFindCartForm();
    if (form) {
      const { placementFront, placementBack, editFront, editBack } = bdEnsurePropertyInputs(form);
      if (sideToClear === "back" && placementBack) placementBack.value = "";
      if (sideToClear === "front" && placementFront) placementFront.value = "";
      if (sideToClear === "back" && editBack) editBack.value = "";
      if (sideToClear === "front" && editFront) editFront.value = "";
    }

    if (!any) {
      bdProofDirty = { front: false, back: false };
      bdProofLastUploadedKey = { front: "", back: "" };
      bdProofLastUrl = { front: "", back: "" };
      window.bdSetProofMockupUrl("");
      try {
        const inputs = bdEnsurePropertyInputs(form);
        if (inputs.previewFlow) inputs.previewFlow.value = "";
        if (inputs.proofStatus) inputs.proofStatus.value = "";
      } catch (e) {}
      bdResetFinalizedState({ keepProofs: false });
      bdUpdateReviewUi();
      bdRefreshFinalizeUi();
    } else {
      bdInvalidateProofState([sideToClear === "back" ? "back" : "front"], {
        reason: "side-cleared",
        markDirty: {
          [sideToClear === "back" ? "back" : "front"]: false
        }
      });
      bdScheduleProofMockupSync({ side: bdGetActiveSide() });
    }

    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
    bdScheduleSoftPrintRefresh();
    bdScheduleDraftSessionPersist();
  };

  // --------------------------
  // Side switch (global)
  // --------------------------
// ---------------------------
// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Side switch (fixed): front/back positions are independent
// ---------------------------
window.bdSwitchPreviewSide = function (side, opts = {}) {
  // 1) Save current sideÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢s geometry before switching
  try { bdPersistActiveState(); } catch (e) {}

  const s = (side === "back") ? "back" : "front";
  const deferVisibleUntilLoaded = !!(opts && opts.deferVisibleUntilLoaded);
    // UX: visually hint which upload button matches the selected side
  try {
    const fBtn = box.querySelector("[data-bd-inline-front='1']");
    const bBtn = box.querySelector("[data-bd-inline-back='1']");
    if (fBtn && bBtn) {
      const onFront = s !== "back";
      fBtn.style.outline = onFront ? "2px solid rgba(0,0,0,.25)" : "";
      fBtn.style.outlineOffset = onFront ? "2px" : "";
      bBtn.style.outline = !onFront ? "2px solid rgba(0,0,0,.25)" : "";
      bBtn.style.outlineOffset = !onFront ? "2px" : "";
    }
  } catch (e) {}

  // 2) Switch UI + active side
  bdSetActiveSideUi(s);
  bdUseSideState(s);

  // 3) Always switch the base mockup too
  if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup(s);
  bdScheduleSoftPrintRefresh();

  // Keep preview UI visible
  box.classList.remove("is-hidden");
  if (designerBody) {
    designerBody.hidden = false;
    designerBody.removeAttribute("hidden");
    designerBody.style.display = "";
    designerBody.style.visibility = "";
    designerBody.style.opacity = "";
  }

  const url = (s === "back") ? objectUrlBack : objectUrlFront;
  const has = (s === "back") ? hasBackDesign : hasFrontDesign;
  // If no design on this side yet: show base only, hide overlay
  if (!has || !url) {
    designImg.hidden = true;
    wrap.style.display = "none";
    dimLabel.hidden = true;

    // Keep has-design if ANY side has a design
    const any = !!(hasFrontDesign || hasBackDesign);
    if (any) box.classList.add("has-design");

    requestAnimationFrame(() => {
      try { bdSyncPreviewBase(); } catch (e) {}
      try { bdUpdatePrintZoneFromInches(); } catch (e) {}
      bdScheduleSoftPrintRefresh();
      try {
        if (typeof window.bdGalleryRestorePrimaryMedia === "function") {
          window.bdGalleryRestorePrimaryMedia();
        }
      } catch (e) {}
      if (!bdDraftRestoreInProgress) {
        bdDispatchPreviewRefreshBatch();
      }
    });

    return;
  }

  // Has design: show overlay for this side
  if (deferVisibleUntilLoaded) {
    designImg.hidden = true;
    wrap.style.display = "none";
  } else {
    designImg.hidden = false;
    wrap.style.display = "block";
  }
  box.classList.add("has-design");
  designImg.onload = () => {
    designImg.onload = null;
    designImg.onerror = null;

    state = (s === "back") ? stateBack : stateFront;
    state.ar =
      designImg.naturalWidth && designImg.naturalHeight
        ? designImg.naturalWidth / designImg.naturalHeight
        : state.ar || 1;

    requestAnimationFrame(() => {
      designImg.hidden = false;
      wrap.style.display = "block";
      try { bdRefreshZoneAndClamp(); } catch (e) {}
      try { apply(); } catch (e) {}
      bdScheduleSoftPrintRefresh();
      if (!bdDraftRestoreInProgress) {
        try { bdScheduleProofMockupSync({ side: s }); } catch (e) {}
        bdDispatchPreviewRefreshBatch();
      }
    });
  };
  designImg.onerror = () => {
    designImg.onload = null;
    designImg.onerror = null;
  };
  designImg.src = url;
};

  const __bdOriginalSwitchPreviewSide = window.bdSwitchPreviewSide;
  window.bdSwitchPreviewSide = function (side, opts = {}) {
    const skipPersistBeforeSwitch = !!(opts && opts.skipPersistBeforeSwitch);
    if (!skipPersistBeforeSwitch) {
      return __bdOriginalSwitchPreviewSide(side, opts);
    }

    const s = side === "back" ? "back" : "front";
    const deferVisibleUntilLoaded = !!(opts && opts.deferVisibleUntilLoaded);

    try {
      const fBtn = box.querySelector("[data-bd-inline-front='1']");
      const bBtn = box.querySelector("[data-bd-inline-back='1']");
      if (fBtn && bBtn) {
        const onFront = s !== "back";
        fBtn.style.outline = onFront ? "2px solid rgba(0,0,0,.25)" : "";
        fBtn.style.outlineOffset = onFront ? "2px" : "";
        bBtn.style.outline = !onFront ? "2px solid rgba(0,0,0,.25)" : "";
        bBtn.style.outlineOffset = !onFront ? "2px" : "";
      }
    } catch (e) {}

    bdSetActiveSideUi(s);
    bdUseSideState(s);

    if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup(s);
    bdScheduleSoftPrintRefresh();

    box.classList.remove("is-hidden");
    if (designerBody) {
      designerBody.hidden = false;
      designerBody.removeAttribute("hidden");
      designerBody.style.display = "";
      designerBody.style.visibility = "";
      designerBody.style.opacity = "";
    }

    const url = s === "back" ? objectUrlBack : objectUrlFront;
    const has = s === "back" ? hasBackDesign : hasFrontDesign;

    if (!has || !url) {
      designImg.hidden = true;
      wrap.style.display = "none";
      dimLabel.hidden = true;

      const any = !!(hasFrontDesign || hasBackDesign);
      if (any) box.classList.add("has-design");

      requestAnimationFrame(() => {
        try { bdSyncPreviewBase(); } catch (e) {}
        try { bdUpdatePrintZoneFromInches(); } catch (e) {}
        bdScheduleSoftPrintRefresh();
        try {
          if (typeof window.bdGalleryRestorePrimaryMedia === "function") {
            window.bdGalleryRestorePrimaryMedia();
          }
        } catch (e) {}
        if (!bdDraftRestoreInProgress) {
          bdDispatchPreviewRefreshBatch();
        }
      });

      return;
    }

    if (deferVisibleUntilLoaded) {
      designImg.hidden = true;
      wrap.style.display = "none";
    } else {
      designImg.hidden = false;
      wrap.style.display = "block";
    }
    box.classList.add("has-design");
    designImg.onload = () => {
      designImg.onload = null;
      designImg.onerror = null;

      state = s === "back" ? stateBack : stateFront;
      state.ar =
        designImg.naturalWidth && designImg.naturalHeight
          ? designImg.naturalWidth / designImg.naturalHeight
          : state.ar || 1;

      requestAnimationFrame(() => {
        designImg.hidden = false;
        wrap.style.display = "block";
        try { bdRefreshZoneAndClamp(); } catch (e) {}
        try { apply(); } catch (e) {}
        bdScheduleSoftPrintRefresh();
        if (!bdDraftRestoreInProgress) {
          try { bdScheduleProofMockupSync({ side: s }); } catch (e) {}
          bdDispatchPreviewRefreshBatch();
        }
      });
    };
    designImg.onerror = () => {
      designImg.onload = null;
      designImg.onerror = null;
    };
    designImg.src = url;
  };

  // --------------------------
  // Upload -> per-side overlay
  // --------------------------
  const setDesignFromFile = (file, side, opts = {}) => {
    const s = side === "back" ? "back" : "front";
    const resetPlacement = opts.resetPlacement !== false;
    const placementOverride = opts.placementOverride || null;
    if (!file) {
      hidePreview(s);
      return;
    }

    bdInvalidateProofState([s], {
      reason: "side-edit",
      markDirty: {
        [s]: true
      }
    });

    // keep UI visible
    box.classList.remove("is-hidden");

    try {
      bdSetActiveSideUi(s);
      bdUseSideState(s);
      if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup(s);
    } catch (e) {}

    // hide while loading
    designImg.hidden = true;
    wrap.style.display = "none";
    dimLabel.hidden = true;

    // keep has-design if any side has it
    if (hasFrontDesign || hasBackDesign) box.classList.add("has-design");

    bdSignalUploadSelected(true);

    if (s === "front") {
      bdSafeRevokeObjectUrl(objectUrlFront);
      objectUrlFront = URL.createObjectURL(file);
    } else {
      bdSafeRevokeObjectUrl(objectUrlBack);
      objectUrlBack = URL.createObjectURL(file);
    }

    const nextUrl = s === "back" ? objectUrlBack : objectUrlFront;

// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ One-time handlers (so toggling sides won't re-run upload logic)
const __bdUploadToken = (setDesignFromFile.__tok = (setDesignFromFile.__tok || 0) + 1);

designImg.onload = () => {
  // ignore stale loads
  if (__bdUploadToken !== setDesignFromFile.__tok) return;

  // remove handlers so future side toggles don't trigger this logic
  designImg.onload = null;
  designImg.onerror = null;

  bdSetActiveSideUi(s);
  state = (s === "back") ? stateBack : stateFront;
  if (s === "front") hasFrontDesign = true; else hasBackDesign = true;

  state.ar =
    designImg.naturalWidth && designImg.naturalHeight
      ? designImg.naturalWidth / designImg.naturalHeight
      : 1;

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Switch correct base for THIS upload side
  if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup(s);

  requestAnimationFrame(() => {
    showPreview();
    if (placementOverride) {
      state.cx = placementOverride.cx;
      state.cy = placementOverride.cy;
      state.w = placementOverride.w;
      state.h = placementOverride.h;
      apply();
      bdScheduleProofMockupSync({ side: s, delay: 700, force: true });
    } else if (resetPlacement) {
      resetToCenter(); // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ only for first upload on that side
      bdRefreshZoneAndClamp();
      apply();
      bdScheduleProofMockupSync({ side: s, delay: 700, force: true });
    } else {
      bdRefreshZoneAndClamp();
      apply();
      bdScheduleProofMockupSync({ side: s, delay: 700, force: true });
    }
  });
};

designImg.onerror = () => {
  if (__bdUploadToken !== setDesignFromFile.__tok) return;
  designImg.onload = null;
  designImg.onerror = null;
  hidePreview(s);
};

    designImg.src = nextUrl;
  };

  const bindFileInput = (inp) => {
    if (!inp || inp.__bdBound) return;
    inp.__bdBound = true;

    inp.addEventListener("change", (e) => {
      if ((inp.__bdCropBypassCount || 0) > 0) {
        inp.__bdCropBypassCount -= 1;
        return;
      }

      const file = e.target.files && e.target.files[0];
      const side = inp.id === "cfUploadBack" ? "back" : "front";
      if (!file) return;
      bdRememberPreferredActiveSide(side);
      try {
        bdSetActiveSideUi(side);
        bdUseSideState(side);
        if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup(side);
      } catch (e) {}
      if (file) {
        bdSetOriginalEditorFile(side, file);
        bdWriteEditorMetaForSide(side);
      }
      setDesignFromFile(file, side);
    });
  };

  bindFileInput(inputFront);
  bindFileInput(inputBack);

  document.addEventListener(
    "change",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "file") return;

      if (t.id === "cfUploadFront" || t.id === "cfUploadBack" || t.closest("#cf-tshirt-preview-container")) {
        bindFileInput(t);
        return;
      }
    },
    true
  );

  document.addEventListener("bd:upload-slot-updated", (e) => {
    const detail = e && e.detail ? e.detail : {};
    const slot = String(detail.slot || "").trim();
    if (slot !== "1" && slot !== "2") return;
    requestAnimationFrame(() => {
      try {
        if (typeof bdSyncInlineUploadInfo === "function") bdSyncInlineUploadInfo();
      } catch (err) {}
      try {
        bdScheduleDraftSessionPersist();
      } catch (err) {}
    });
  });

  // Resize updates
  window.addEventListener("resize", () => {
    if (wrap.style.display === "none") return;
    requestAnimationFrame(() => {
      bdUpdatePrintZoneFromInches();
      bdClampSizeAndPosToZone();
      apply();
    });
  });

  // --------------------------
  // Pointer drag + resize
  // --------------------------
  let mode = null;
  let activeHandle = null;
  let bdInteractionChanged = false;
  const start = { x: 0, y: 0, cx: 0, cy: 0, w: 0, h: 0 };

  const isHandle = (el) => el && el.dataset && el.dataset.handle;

  wrap.addEventListener("pointerdown", (e) => {
    if (bdCropState.isOpen) return;
    if (wrap.style.display === "none") return;

    if (isHandle(e.target)) {
      mode = "resize";
      activeHandle = e.target.dataset.handle;
    } else {
      mode = "drag";
      activeHandle = null;
    }

    box.classList.add("is-interacting");
    wrap.setPointerCapture(e.pointerId);
    bdInteractionChanged = false;

    start.x = e.clientX;
    start.y = e.clientY;
    start.cx = state.cx;
    start.cy = state.cy;
    start.w = state.w;
    start.h = state.h;

    e.preventDefault();
  });

  wrap.addEventListener("pointermove", (e) => {
    if (bdCropState.isOpen) return;
    if (!mode) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (mode === "drag") {
      state.cx = start.cx + dx;
      state.cy = start.cy + dy;
      bdInteractionChanged = true;
      bdClampSizeAndPosToZone();
      apply();
      return;
    }

    if (mode === "resize" && activeHandle) {
      const z = bdGetZone();
      const r = canvasRect();
      const minW = bdGetMinDesignWidth(z.width || r.width);
      const maxW = Math.round(r.width * 0.95);

      let newW = start.w;

      if (["nw", "ne", "sw", "se"].includes(activeHandle)) {
        const signX = activeHandle.includes("w") ? -1 : 1;
        const signY = activeHandle.includes("n") ? -1 : 1;
        const delta = (dx * signX + dy * signY) * 0.9;
        newW = clamp(Math.round(start.w + delta), minW, maxW);
      } else if (activeHandle === "e" || activeHandle === "w") {
        const sign = activeHandle === "w" ? -1 : 1;
        newW = clamp(Math.round(start.w + dx * sign), minW, maxW);
      } else if (activeHandle === "n" || activeHandle === "s") {
        const sign = activeHandle === "n" ? -1 : 1;
        const newH = Math.max(40, Math.round(start.h + dy * sign));
        newW = clamp(Math.round(newH * state.ar), minW, maxW);
      }

      state.w = newW;
      state.h = Math.round(state.w / state.ar);
      bdInteractionChanged = true;
      bdClampSizeAndPosToZone();
      apply();
    }
  });

const endPointer = () => {
  if (bdCropState.isOpen) return;
  mode = null;
  activeHandle = null;
  box.classList.remove("is-interacting");
  const skipPersistBeforeSwitch = !!(opts && opts.skipPersistBeforeSwitch);
  if (!skipPersistBeforeSwitch) {
    try { bdPersistActiveState(); } catch (e) {}
  }
  if (bdInteractionChanged) {
    bdInvalidateProofState([bdGetActiveSide()], {
      reason: "placement-edit",
      markDirty: {
        [bdGetActiveSide()]: true
      }
    });
  }
  try { bdScheduleProofMockupSync({ side: bdGetActiveSide() }); } catch (e) {}
};

  wrap.addEventListener("pointerup", endPointer);
  wrap.addEventListener("pointercancel", endPointer);
  wrap.addEventListener("lostpointercapture", endPointer);

  // Wheel zoom
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (bdCropState.isOpen) return;
      if (wrap.style.display === "none") return;
      e.preventDefault();

      const delta = Math.sign(e.deltaY);
      const step = e.ctrlKey ? 28 : 18;

      state.w = state.w + (delta > 0 ? -step : step);
      state.h = Math.round(state.w / state.ar);
      bdInvalidateProofState([bdGetActiveSide()], {
        reason: "placement-edit",
        markDirty: {
          [bdGetActiveSide()]: true
        }
      });
      bdClampSizeAndPosToZone();
      apply();
      bdScheduleProofMockupSync({ side: bdGetActiveSide() });
    },
    { passive: false }
  );

  // Ensure inputs exist
  requestAnimationFrame(() => {
    const form = bdFindCartForm();
    bdEnsurePropertyInputs(form);
    bdWritePlacement();
  });

  // --------------------------
  // IMPORTANT: Variant/color change listeners
  // --------------------------
  const bdBindVariantChangeListeners = () => {
    const root = box.closest("product-info") || document;

    // 1) Listen to changes inside variant-selects
    const vs = root.querySelector("variant-selects");
    if (vs && !vs.__bdBound) {
      vs.__bdBound = true;
      vs.addEventListener(
        "change",
        () => {
          // update base mockup data attrs and src
          bdSyncBaseByVariantColor();
        },
        true
      );
    }

    // 2) Dawn custom events (varies by version)
    ["variant:change", "variantChange", "product:variant-change"].forEach((ev) => {
      document.addEventListener(ev, () => bdSyncBaseByVariantColor());
    });

    // 3) Mutation observer on variant id hidden input (very robust)
    const idInput = root.querySelector('form[action^="/cart/add"] input[name="id"]');
    if (idInput && !idInput.__bdObs) {
      idInput.__bdObs = true;
      const mo = new MutationObserver(() => bdSyncBaseByVariantColor());
      mo.observe(idInput, { attributes: true, attributeFilter: ["value"] });
    }
  };

  bdBindVariantChangeListeners();

  window.addEventListener("pagehide", () => {
    bdDraftRestoreHandled = false;
    bdPersistDraftSessionNow();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      bdPersistDraftSessionNow();
    }
  });

  window.addEventListener("pageshow", (event) => {
    requestAnimationFrame(() => {
      if (!bdRunDraftRestorePass({ persisted: !!(event && event.persisted) })) {
        bdCloseTransientCartUi();
      }
    });
  });

  // Initial sync once DOM ready
  requestAnimationFrame(() => {
    if (bdRunDraftRestorePass()) return;
    bdCloseTransientCartUi();
    bdSyncBaseByVariantColor();
    // set correct side base right away
    bdSwitchMainMockup(bdActiveSide);
    bdScheduleSoftPrintRefresh();
  });
})();

/* ----------------------------
   STEP 1 (DAWN-SAFE) Gate: message + block submit if no upload
---------------------------- */
(function () {
  const bdGetActiveSide = window.bdGetActiveSide || function () {
    const hidden = document.querySelector("#bd_active_side");
    const v = ((hidden && hidden.value) || "").toLowerCase();
    return v === "back" ? "back" : "front";
  };

  function bdPreviewState() {
    return window.__bdTshirtPreviewState || null;
  }

  function bdIsPreviewRequired() {
    return document.documentElement.classList.contains("bd-tshirt-preview-required");
  }

  function bdIsFrontBackStatusMode() {
    const box = document.getElementById("cf-tshirt-preview-container");
    if (!box) return false;
    return String(box.dataset.bdResolvedMode || box.dataset.cfConfig || "").toLowerCase().trim() === "front-back";
  }

  function bdGetUploadedUrlForIndex(idx) {
    const input = document.querySelector(`[data-url="${idx}"]`);
    return String((input && input.value) || "").trim();
  }

  function bdHasDesignForSide(side) {
    const previewState = bdPreviewState();
    if (previewState && previewState.hasApprovedProofForSide && previewState.hasApprovedProofForSide(side)) {
      return true;
    }
    if (previewState) {
      if (side === "front" && previewState.hasFrontDesign && previewState.hasFrontDesign()) return true;
      if (side === "back" && previewState.hasBackDesign && previewState.hasBackDesign()) return true;
    }
    const idx = side === "back" ? "2" : "1";
    if (bdGetUploadedUrlForIndex(idx)) return true;
    const input = side === "back" ? document.getElementById("cfUploadBack") : document.getElementById("cfUploadFront");
    return !!(input && input.files && input.files.length);
  }

  function bdHasLiteUploadSelected() {
    if (typeof window.__bdTshirtHasFileSelected === "boolean") {
      if (window.__bdTshirtHasFileSelected) return true;
    }
    return bdHasDesignForSide("front") || bdHasDesignForSide("back");
  }

  function bdGetForms() {
    return Array.from(document.querySelectorAll('form[action^="/cart/add"]'));
  }

  function bdEnsureStatusBox(form) {
    let box = form.querySelector(".bd-tshirt-status");
    if (!box) {
      box = document.createElement("div");
      box.className = "bd-tshirt-status";
      box.setAttribute("role", "status");
      box.style.marginTop = "10px";
      box.style.padding = "10px 12px";
      box.style.border = "1px solid rgba(0,0,0,.15)";
      box.style.borderRadius = "8px";
      box.style.fontSize = "14px";
      box.style.lineHeight = "1.35";
    }
    const buttonWrap = form.querySelector(".product-form__buttons");
    if (buttonWrap) {
      buttonWrap.insertAdjacentElement("beforebegin", box);
    } else if (!box.parentNode) {
      form.appendChild(box);
    }
    return box;
  }

  function bdSetStatusBoxContent(box, text, mode = "plain") {
    if (!box) return;
    if (mode === "cta-ready") {
      const previewState = bdPreviewState();
      const readyCopy =
        previewState && previewState.getReadyCopy ? previewState.getReadyCopy() : null;
      box.innerHTML = readyCopy && readyCopy.cta ? readyCopy.cta : "";
      return;
    }
    box.textContent = text || "";
  }

  function bdGetNativeAddControls(form) {
    if (!form) return {};
    const addButton =
      form.querySelector('[data-bd-native-add="1"]') ||
      form.querySelector('.product-form__submit[name="add"]') ||
      form.querySelector('button[type="submit"][name="add"]');
    const acceleratedCheckout =
      form.querySelector('[data-bd-accelerated-checkout="1"]') ||
      form.querySelector('.shopify-payment-button');
    return { addButton, acceleratedCheckout };
  }

  function bdNativeButtonCanBeEnabled(form, addButton) {
    if (!form || !addButton) return false;
    const variantInput = form.querySelector(".product-variant-id");
    if (variantInput && variantInput.disabled) return false;

    const labelEl = addButton.querySelector("span");
    const currentLabel = String((labelEl ? labelEl.textContent : addButton.textContent) || "").trim();
    const soldOutLabel = String(addButton.dataset.bdSoldoutLabel || "").trim();
    const unavailableLabel = String(addButton.dataset.bdUnavailableLabel || "").trim();

    if (soldOutLabel && currentLabel === soldOutLabel) return false;
    if (unavailableLabel && currentLabel === unavailableLabel) return false;
    return true;
  }

  function bdSetPreviewGateState(form, addButton, blocked) {
    if (!form || !addButton) return;
    const buttonWrap = addButton.closest(".product-form__buttons");

    if (blocked) {
      addButton.setAttribute("disabled", "disabled");
      addButton.setAttribute("aria-disabled", "true");
      addButton.dataset.bdPreviewDisabled = "1";
      if (buttonWrap) {
        buttonWrap.dataset.bdPreviewDisabled = "1";
        buttonWrap.classList.add("is-preview-blocked");
      }
      return;
    }

    if (buttonWrap) {
      delete buttonWrap.dataset.bdPreviewDisabled;
      buttonWrap.classList.remove("is-preview-blocked");
    }
    delete addButton.dataset.bdPreviewDisabled;

    if (bdNativeButtonCanBeEnabled(form, addButton)) {
      addButton.removeAttribute("disabled");
      addButton.removeAttribute("aria-disabled");
    } else {
      addButton.setAttribute("disabled", "disabled");
      addButton.setAttribute("aria-disabled", "true");
    }
  }

  function bdSetUi(form) {
    if (!bdIsPreviewRequired()) return;

    const box = bdEnsureStatusBox(form);
    const { addButton } = bdGetNativeAddControls(form);
    const hasFrontUpload = bdHasDesignForSide("front");
    const hasBackUpload = bdHasDesignForSide("back");
    const hasUpload = hasFrontUpload || hasBackUpload;
    const previewState = bdPreviewState();
    const requiredSides = previewState && previewState.getRequiredProofSides ? previewState.getRequiredProofSides() : [];
    const isGenerating = !!(previewState && previewState.isFinalizeInProgress && previewState.isFinalizeInProgress());
    const readyNow = !!(
      previewState &&
      previewState.reevaluateFinalizeState &&
      previewState.reevaluateFinalizeState({ source: "gate-ui" })
    );
    const canApprove = !!(previewState && previewState.canApproveAddToCart && previewState.canApproveAddToCart());
    const isFinalized = !!(previewState && previewState.isDesignFinalized && previewState.isDesignFinalized());
    const isCropPending = !!(previewState && previewState.isCropPending && previewState.isCropPending());
    const frontApproved = !!(
      previewState &&
      previewState.hasApprovedProofForSide &&
      previewState.hasApprovedProofForSide("front")
    );
    const backApproved = !!(
      previewState &&
      previewState.hasApprovedProofForSide &&
      previewState.hasApprovedProofForSide("back")
    );
    const pendingReviewCopy =
      previewState && previewState.getPendingReviewCopy
        ? previewState.getPendingReviewCopy({ frontApproved, backApproved })
        : "";
    const hasDirtyRequiredSide = !!(
      isFinalized &&
      !canApprove &&
      requiredSides.length
    );

    if (!hasUpload) {
      bdSetStatusBoxContent(box, "Upload your design to get started.");
    } else if (isCropPending) {
      bdSetStatusBoxContent(box, "Apply or cancel crop before finalizing your design.");
    } else if (readyNow && canApprove) {
      bdSetStatusBoxContent(box, "", "cta-ready");
    } else if (pendingReviewCopy) {
      bdSetStatusBoxContent(box, pendingReviewCopy);
    } else if (hasDirtyRequiredSide) {
      bdSetStatusBoxContent(box, "Design changed. Finalize again to regenerate the required proof before adding to cart.");
    } else if (bdIsFrontBackStatusMode()) {
      if (hasFrontUpload && hasBackUpload) {
        bdSetStatusBoxContent(box, "Front and back designs uploaded. Finalize design to generate proofs.");
      } else if (hasFrontUpload) {
        bdSetStatusBoxContent(box, "Front design uploaded. Finalize design to generate the required proof.");
      } else if (hasBackUpload) {
        bdSetStatusBoxContent(box, "Back design uploaded. Finalize design to generate the required proof.");
      }
    } else {
      bdSetStatusBoxContent(box, "Design selected. Finalize design to generate the required proof.");
    }
    box.style.opacity = hasUpload ? "1" : "0.95";

    if (addButton) {
      const shouldBlock = !canApprove || isCropPending;
      bdSetPreviewGateState(form, addButton, shouldBlock);
      if (!shouldBlock) {
        requestAnimationFrame(() => {
          bdSetPreviewGateState(form, addButton, false);
        });
      }
    }

    if (previewState && previewState.refreshFinalizeUi) {
      previewState.refreshFinalizeUi();
    }
  }

  function bdRefreshAll() {
    if (!bdIsPreviewRequired()) return;
    bdGetForms().forEach(bdSetUi);
  }

  async function bdSyncSelectedColorBeforeSubmit(form) {
    const previewState = bdPreviewState();
    if (!previewState || !previewState.isFrontBack() || !(previewState.hasFrontDesign() || previewState.hasBackDesign())) return;

    const statusBox = bdEnsureStatusBox(form);
    const prevStatus = statusBox ? statusBox.textContent : "";
    if (statusBox) statusBox.textContent = "Updating design...";

    try {
      try { previewState.syncBaseByVariantColor(); } catch (e) {}
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const activeBefore = previewState.getActiveSide();
      const sides = [];
      if (previewState.hasFrontDesign()) sides.push("front");
      if (previewState.hasBackDesign()) sides.push("back");

      for (const side of sides) {
        previewState.switchPreviewSide(side);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      previewState.switchPreviewSide(activeBefore);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    } finally {
      bdRefreshAll();
    }
  }

  function bdAttach() {
    if (!bdIsPreviewRequired()) return;

    window.bdTshirtGateRefresh = bdRefreshAll;
    bdRefreshAll();

    const f1 = document.getElementById("cfUploadFront");
    const f2 = document.getElementById("cfUploadBack");
    [f1, f2].forEach((inp) => {
      if (!inp || inp.__bdFinalizeUiBound) return;
      inp.__bdFinalizeUiBound = true;
      inp.addEventListener("change", () => {
        window.__bdTshirtHasFileSelected = bdHasLiteUploadSelected();
        bdRefreshAll();
      });
    });

    if (document.__bdPreviewSubmitBound) return;
    document.__bdPreviewSubmitBound = true;
    document.addEventListener(
      "submit",
      async function (e) {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.action || !form.action.includes("/cart/add")) return;
        if (!bdIsPreviewRequired()) return;

        if (!bdHasLiteUploadSelected()) {
          e.preventDefault();
          e.stopPropagation();
          bdSetUi(form);
          const box = form.querySelector(".bd-tshirt-status");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        const previewState = bdPreviewState();
        const hasAnyDesign = !!(previewState && (previewState.hasFrontDesign() || previewState.hasBackDesign()));

        if (hasAnyDesign) {
          const snapshot = typeof window.bdBuildSubmitSnapshot === "function"
            ? window.bdBuildSubmitSnapshot(form, previewState)
            : null;
          if (!snapshot || !previewState || !previewState.canApproveAddToCart || !previewState.canApproveAddToCart()) {
            e.preventDefault();
            e.stopPropagation();
            bdSetUi(form);
            return;
          }
          if (typeof window.bdApplySubmitSnapshot === "function") {
            window.bdApplySubmitSnapshot(form, snapshot);
          }
        }
      },
      true
    );
  }

  document.addEventListener("DOMContentLoaded", bdAttach);
  document.addEventListener("shopify:section:load", bdAttach);
})();

/* ----------------------------
   Design Preview slide mirror:
   - If you add Part 3 (gallery slide), this keeps it updated.
---------------------------- */
(() => {
  const box = document.getElementById("cf-tshirt-preview-container");
  if (!box) return;

  const scope =
    box.closest("product-info") ||
    document.getElementById("MainProduct-" + (box.dataset.section || "")) ||
    document;

  const getPreviewBase = () => box.querySelector(".cf-preview-base");
  const getPreviewDesign = () => box.querySelector(".cf-preview-design");
  const getForm = () =>
    scope.querySelector('form[data-type="add-to-cart-form"]') ||
    scope.querySelector('form[action^="/cart/add"]:not(.installment)') ||
    document.querySelector('form[data-type="add-to-cart-form"]') ||
    document.querySelector('form[action^="/cart/add"]:not(.installment)') ||
    null;

  const getActiveSide = () => {
    const v = (document.getElementById("bd_active_side")?.value || "front").toLowerCase();
    return v === "back" ? "back" : "front";
  };

  const getPlacement = () => {
    const form = getForm();
    if (!form) return null;

    const side = getActiveSide();
    const el =
      (side === "back" ? form.querySelector("#bd_design_placement_back") : form.querySelector("#bd_design_placement_front")) ||
      form.querySelector("#bd_design_placement_front") ||
      form.querySelector("#bd_design_placement_back");

    if (!el || !el.value) return null;
    try {
      return JSON.parse(el.value);
    } catch (e) {
      return null;
    }
  };

  const ensureDesignPreviewSlide = () => {
    // Part 3 creates this
    const slide =
      scope.querySelector('[data-bd-design-preview-slide="1"]') ||
      document.querySelector('[data-bd-design-preview-slide="1"]');
    if (!slide) return null;

    const stage = slide.querySelector(".bd-design-preview-stage");
    const base = slide.querySelector("img[data-bd-design-preview-base]");
    const overlay = slide.querySelector("img[data-bd-design-preview-overlay]");
    if (!stage || !base || !overlay) return null;

    return { slide, stage, base, overlay };
  };

  const designPreviewMediaId = (() => {
    const slide = ensureDesignPreviewSlide();
    return slide ? slide.slide.getAttribute("data-media-id") || "" : "";
  })();

  const activatePreviewSlide = () => {
    if (!designPreviewMediaId || typeof window.bdGalleryActivateMedia !== "function") return;
    try {
      window.bdGalleryActivateMedia(designPreviewMediaId);
    } catch (e) {}
  };

  const activatePreviewSlideStabilized = () => {
    activatePreviewSlide();
    requestAnimationFrame(activatePreviewSlide);
    setTimeout(activatePreviewSlide, 60);
    setTimeout(activatePreviewSlide, 180);
  };

  let lastVisible = false;
  let refreshFrame = 0;

  const refresh = () => {
    const pack = ensureDesignPreviewSlide();
    if (!pack) return;

    const { slide, stage, base, overlay } = pack;

    const previewBase = getPreviewBase();
    const previewDesign = getPreviewDesign();
    const placement = getPlacement();

    // Base image in slide should match preview base
    const baseSrc = previewBase ? (previewBase.currentSrc || previewBase.src || "") : "";
    if (baseSrc && base.src !== baseSrc) base.src = baseSrc;

    // If no design/placement, hide overlay
    const designSrc = previewDesign ? (previewDesign.currentSrc || previewDesign.src || "") : "";
    if (!designSrc || !placement) {
      slide.hidden = true;
      overlay.style.opacity = "0";
      if (lastVisible && designPreviewMediaId) {
        try {
          document.dispatchEvent(new CustomEvent("bd:design-preview-slide-hidden"));
        } catch (e) {}
      }
      lastVisible = false;
      return;
    }

    slide.hidden = false;
    if (overlay.src !== designSrc) overlay.src = designSrc;

    // Position overlay using placement relative to base box
    const baseLeft = Number(placement.baseLeft ?? 0);
    const baseTop = Number(placement.baseTop ?? 0);
    const baseW = Number(placement.baseW ?? 0);
    const baseH = Number(placement.baseH ?? 0);
    const canvasW = Number(placement.canvasW ?? 0);
    const canvasH = Number(placement.canvasH ?? 0);

    const denomW = baseW > 0 ? baseW : (canvasW > 0 ? canvasW : 1);
    const denomH = baseH > 0 ? baseH : (canvasH > 0 ? canvasH : 1);
    const leftRef = baseW > 0 ? baseLeft : 0;
    const topRef = baseH > 0 ? baseTop : 0;

    const xRel = (Number(placement.cx) - leftRef) / denomW;
    const yRel = (Number(placement.cy) - topRef) / denomH;
    const wRel = Number(placement.w) / denomW;
    const hRel = Number(placement.h) / denomH;

    const stageRect = stage.getBoundingClientRect();
    const stageW = Math.max(1, stageRect.width || stage.clientWidth || 1);
    const stageH = Math.max(1, stageRect.height || stage.clientHeight || 1);
    const naturalW = Math.max(1, previewBase?.naturalWidth || 1);
    const naturalH = Math.max(1, previewBase?.naturalHeight || 1);
    const stageRatio = stageW / stageH;
    const imageRatio = naturalW / naturalH;

    let renderW = stageW;
    let renderH = stageH;
    let renderLeft = 0;
    let renderTop = 0;

    if (stageRatio > imageRatio) {
      renderH = stageH;
      renderW = renderH * imageRatio;
      renderLeft = (stageW - renderW) / 2;
    } else {
      renderW = stageW;
      renderH = renderW / imageRatio;
      renderTop = (stageH - renderH) / 2;
    }

    base.style.left = `${renderLeft}px`;
    base.style.top = `${renderTop}px`;
    base.style.width = `${renderW}px`;
    base.style.height = `${renderH}px`;

    overlay.style.left = `${renderLeft + xRel * renderW}px`;
    overlay.style.top = `${renderTop + yRel * renderH}px`;
    overlay.style.width = `${wRel * renderW}px`;
    overlay.style.height = `${hRel * renderH}px`;
    overlay.style.transform = "translate(-50%, -50%)";
    overlay.style.opacity = "1";

    if (!lastVisible) activatePreviewSlideStabilized();
    lastVisible = true;
  };

  const scheduleRefresh = () => {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      refresh();
    });
  };

  document.addEventListener("bd:placement-updated", scheduleRefresh);
  document.addEventListener("bd:base-changed", scheduleRefresh);
  document.addEventListener("bd:design-preview-refresh", scheduleRefresh);
  document.addEventListener("variant:change", () => {
    requestAnimationFrame(() => {
      refresh();
      if (lastVisible) activatePreviewSlideStabilized();
    });
  });
  document.addEventListener("variantChange", () => {
    requestAnimationFrame(() => {
      refresh();
      if (lastVisible) activatePreviewSlideStabilized();
    });
  });
  document.addEventListener("product:variant-change", () => {
    requestAnimationFrame(() => {
      refresh();
      if (lastVisible) activatePreviewSlideStabilized();
    });
  });
  window.addEventListener("resize", scheduleRefresh);
  window.addEventListener("load", scheduleRefresh);

  scheduleRefresh();
})();

