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
  const bdIsFrontOnly = bdPreviewConfig === "front-only";
  const bdIsBackOnly = bdPreviewConfig === "back-only";
  const bdIsFrontBack = bdPreviewConfig === "front-back";


  // --------------------------
  // Helpers
  // --------------------------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

  // --------------------------
  // Side toggle state
  // --------------------------
  let bdActiveSide = "front";

  const bdGetActiveSide = () => {
    const hidden = box.querySelector("#bd_active_side");
    const v = ((hidden && hidden.value) || "").toLowerCase();
    return v === "back" ? "back" : "front";
  };

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

    if (inlineFrontBtn && inlineBackBtn && bdIsFrontBack) {
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
    if (bdIsBackOnly) return "back";
    if (bdIsFrontOnly) return "front";
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

  const bdSyncCropActionButtons = () => {
    const cropBtn = box.querySelector('[data-bd-inline-crop="1"]');
    const cancelBtn = box.querySelector('[data-bd-inline-crop-cancel="1"]');
    const originalBtn = box.querySelector('[data-bd-inline-crop-original="1"]');
    const applyBtn = box.querySelector('[data-bd-inline-crop-apply="1"]');
    const frontBtn = box.querySelector('[data-bd-inline-front="1"]');
    const backBtn = box.querySelector('[data-bd-inline-back="1"]');
    const side = bdGetMirrorSide();
    const originalFile = bdCropState.originalBySide[side];
    const canRecrop = !!(originalFile && bdCanCropFile(originalFile));

    if (cropBtn) cropBtn.style.display = bdCropState.isOpen ? "none" : (canRecrop ? "" : "none");
    if (cancelBtn) cancelBtn.style.display = bdCropState.isOpen ? "" : "none";
    if (originalBtn) originalBtn.style.display = bdCropState.isOpen ? "" : "none";
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
      cropBox.addEventListener("pointerdown", (e) => {
        if (!bdCropState.isOpen) return;
        const handle = e.target && e.target.getAttribute && e.target.getAttribute("data-bd-crop-handle");
        bdCropState.pointerMode = handle ? "resize" : "drag-crop";
        bdCropState.pointerId = e.pointerId;
        bdCropState.pointerStart = {
          x: e.clientX,
          y: e.clientY,
          handle: handle || "",
          cropRect: { ...bdCropState.cropRect }
        };
        cropBox.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
    }

    if (stage) {
      stage.addEventListener("pointermove", (e) => {
        if (!bdCropState.pointerMode || !bdCropState.pointerStart) return;
        const image = bdCropState.image;
        const cropRect = bdCropState.cropRect;
        if (!image.w || !image.h || !cropRect.w || !cropRect.h) return;

        const dx = e.clientX - bdCropState.pointerStart.x;
        const dy = e.clientY - bdCropState.pointerStart.y;
        const startRect = bdCropState.pointerStart.cropRect;
        const minSize = 40;
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
      });

      stage.addEventListener("pointerup", () => {
        bdCropState.pointerMode = null;
        bdCropState.pointerId = null;
        bdCropState.pointerStart = null;
      });

      stage.addEventListener("pointercancel", () => {
        bdCropState.pointerMode = null;
        bdCropState.pointerId = null;
        bdCropState.pointerStart = null;
      });

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

    if (file) {
      bdCropState.originalBySide[bdCropState.side] = file;
    }

    if (bdIsSvgFile(file)) {
      if (note) {
        note.hidden = false;
        note.textContent = "SVG cropping is skipped in V1. You can continue with the original file.";
      }
    } else if (note) {
      note.hidden = false;
      note.textContent = "Drag the crop area to reposition it. Use the edges or corners to resize, then apply crop.";
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
  };

  const bdPushFileIntoRealInput = ({ side, file }) => {
    const input = bdGetInputForSide(side);
    if (!input || !file) return false;

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    // Guard both the capturing document listener and the direct input listener.
    input.__bdCropBypassCount = 2;
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

    const minSize = 40;
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

    let cropW = Math.max(40, Math.round(imageW * 0.72));
    let cropH = Math.max(40, Math.round(imageH * 0.72));
    let cropX = Math.round(imageX + (imageW - cropW) / 2);
    let cropY = Math.round(imageY + (imageH - cropH) / 2);

    if (
      existingCrop &&
      existingCrop.w > 0 &&
      existingCrop.h > 0 &&
      existingCrop.naturalWidth === Math.round(bdCropState.naturalWidth || 0) &&
      existingCrop.naturalHeight === Math.round(bdCropState.naturalHeight || 0)
    ) {
      cropX = Math.round(imageX + existingCrop.x * safeScale);
      cropY = Math.round(imageY + existingCrop.y * safeScale);
      cropW = Math.max(40, Math.round(existingCrop.w * safeScale));
      cropH = Math.max(40, Math.round(existingCrop.h * safeScale));
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

    nextW = clamp(nextW, 40, image.w);
    nextH = clamp(nextH, 40, image.h);

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
  const bdEnsureInlineUploadUI = () => {
    // Prevent duplicates (theme section reload, etc.)
    if (box.querySelector("[data-bd-inline-upload='1']") && box.querySelector("[data-bd-upload-info='1']")) return;

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
      btnFront.textContent = "Upload Front Design";
    btnFront.setAttribute("data-bd-inline-front", "1");
    btnFront.className = "button button--secondary"; // Dawn button styling
    btnFront.style.flex = "1";

    const btnCrop = document.createElement("button");
    btnCrop.type = "button";
    btnCrop.textContent = "Crop image";
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
    btnCropOriginal.textContent = "Use original";
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
    btnBack.textContent = "Upload Back Design";
    btnBack.setAttribute("data-bd-inline-back", "1");
    btnBack.className = "button button--secondary";
    btnBack.style.flex = "1";

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

    // Click handlers: trigger the REAL inputs
    btnFront.addEventListener("click", () => {
      if (bdCropState.isOpen) return;
      try {
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide("front");
        } else {
          bdSetActiveSideUi("front");
          bdUseSideState("front");
          if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup("front");
        }
      } catch (e) {}
      const inp = document.getElementById("cfUploadFront") || inputFront;
      if (inp) inp.click();
    });

    btnBack.addEventListener("click", () => {
      if (bdCropState.isOpen) return;
      try {
        if (typeof window.bdSwitchPreviewSide === "function") {
          window.bdSwitchPreviewSide("back");
        } else {
          bdSetActiveSideUi("back");
          bdUseSideState("back");
          if (typeof bdSwitchMainMockup === "function") bdSwitchMainMockup("back");
        }
      } catch (e) {}
      const inp = document.getElementById("cfUploadBack") || inputBack;
      if (inp) inp.click();
    });

    btnCrop.addEventListener("click", () => {
      const side = bdGetMirrorSide();
      const originalFile = bdCropState.originalBySide[side];
      if (!originalFile || !bdCanCropFile(originalFile)) return;
      bdOpenCropModal({ file: originalFile, side });
    });

    btnCropCancel.addEventListener("click", () => {
      bdCloseCropModal();
    });

    btnCropOriginal.addEventListener("click", () => {
      const side = bdCropState.side;
      const editorSide = bdGetEditorSideState(side);
      const file = editorSide.originalFile || bdCropState.file;
      bdCropState.usingOriginal = true;
      bdCloseCropModal();
      if (file) {
        bdSetEditorCropMeta(side, null);
        bdWriteEditorMetaForSide(side);
        setDesignFromFile(file, side, { resetPlacement: false });
        bdPushFileIntoRealInput({ side, file });
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

      const helpText = "PNG/JPG/SVG up to 10MB";
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
        const uploadStatusText = previewSrc ? "Image uploaded successfully" : "";
        const nextStatusText = [uploadStatusText, qualityText].filter(Boolean).join(" | ");
        statusTarget.textContent = isCancelNoop ? existingStatusText : (keepExistingPreview && !nextStatusText ? existingStatusText : nextStatusText);
        statusTarget.style.display = statusTarget.textContent ? "" : "none";
        statusTarget.style.color =
          longSide > 0 && longSide < 2000
            ? "#8a6d00"
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
  };

  // Create once (safe even if Start Gate is enabled; weÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ll show/hide naturally)
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

    if (bdIsFrontOnly) {
      if (frontSideBtn) frontSideBtn.style.display = "none";
      if (backSideBtn) backSideBtn.style.display = "none";
      if (toggle) toggle.style.display = "none";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "";
      if (inlineFrontBtn) inlineFrontBtn.textContent = "Upload Front Design";
      if (inlineBackBtn) inlineBackBtn.style.display = "none";
      if (inlineTitle) inlineTitle.style.display = "none";
      if (inlineHint) inlineHint.textContent = "Upload your front design to preview it on the selected shirt color.";

      bdSetActiveSideUi("front");
    } else if (bdIsBackOnly) {
      if (frontSideBtn) frontSideBtn.style.display = "none";
      if (backSideBtn) backSideBtn.style.display = "";
      if (toggle) toggle.style.display = backSideBtn ? "" : "none";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "none";
      if (inlineBackBtn) inlineBackBtn.style.display = "";
      if (inlineBackBtn) inlineBackBtn.textContent = "Upload Back Design";
      if (inlineTitle) inlineTitle.style.display = "";
      if (inlineHint) inlineHint.textContent = "Upload your back design to preview it on the selected shirt color.";

      bdSetActiveSideUi("back");
    } else {
      if (frontSideBtn) frontSideBtn.style.display = "";
      if (backSideBtn) backSideBtn.style.display = "";
      if (toggle) toggle.style.display = "";

      if (inlineFrontBtn) inlineFrontBtn.style.display = "";
      if (inlineBackBtn) inlineBackBtn.style.display = "";
      if (inlineFrontBtn) inlineFrontBtn.textContent = "Upload Front Design";
      if (inlineBackBtn) inlineBackBtn.textContent = "Upload Back Design";
      if (inlineTitle) inlineTitle.style.display = "";
      if (inlineHint) inlineHint.textContent = "Tip: Use the Front/Back toggle above to preview each side.";

      bdSetActiveSideUi("front");
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

  const bdOpenDesignerUi = () => {
    box.classList.remove("is-hidden");
    box.classList.add("is-open");
    if (designerBody) {
      designerBody.hidden = false;
      designerBody.removeAttribute("hidden");
      designerBody.style.display = "";
      designerBody.style.visibility = "";
      designerBody.style.opacity = "";
    }

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

        if (bdIsFrontOnly) {
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
    });

  
  // UX: On Start, land user on the correct preview side + highlight the right upload button
  requestAnimationFrame(() => {
    try {
      const bdStartSide = bdIsBackOnly ? "back" : "front";
      if (typeof window.bdSwitchPreviewSide === "function") {
        window.bdSwitchPreviewSide(bdStartSide);
      } else {
        bdSetActiveSideUi(bdStartSide);
      }
    } catch (e) {}

    try {
      const bar = box.querySelector("[data-bd-inline-upload='1']");
      if (bar) bar.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {}

    try {
      const fBtn = box.querySelector("[data-bd-inline-front='1']");
      const bBtn = box.querySelector("[data-bd-inline-back='1']");
      const useBack = bdIsBackOnly;

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

  if (startBtn) {
    startBtn.addEventListener("click", () => bdOpenDesignerUi());
  }
}

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

    return { url, proofUrl, proofFront, proofBack, placementFront, placementBack, editFront, editBack };
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

  return () => {
    if (parsed) return cache;
    parsed = true;

    const node = document.getElementById("bd-color-mockup-map");
    if (!node || !node.textContent) {
      cache = null;
      return cache;
    }

    try {
      const raw = JSON.parse(node.textContent);
      cache = raw && typeof raw === "object" ? raw : null;
    } catch (e) {
      cache = null;
    }

    return cache;
  };
})();

const bdGetMappedMockupSrc = (side, colorValue) => {
  const map = bdGetColorMockupMap();
  if (!map || typeof map !== "object") return "";

  const wantSide = side === "back" ? "back" : "front";
  const wantColor = bdNormColor(colorValue);
  if (!wantColor) return "";

  const entries = Object.entries(map);
  const hit = entries.find(([key]) => bdNormColor(key) === wantColor);
  if (!hit || !hit[1] || typeof hit[1] !== "object") return "";

  const src = hit[1][wantSide];
  return typeof src === "string" ? src.trim() : "";
};

const bdGetSelectedColorValue = () => {
  // 1) checked radios (swatches/buttons)
  const radio =
    document.querySelector('variant-selects input[type="radio"]:checked') ||
    document.querySelector('.product-form__input input[type="radio"]:checked');
  if (radio && radio.value) return radio.value;

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
        return sel.value || "";
      }
    }
    // Fallback: first select value
    return selects[0].value || "";
  }

  // 3) last resort: try any input that looks like an option
  const any =
    document.querySelector('[name^="options["]:checked') ||
    document.querySelector('[name^="options["]');
  if (any && any.value) return any.value;

  return "";
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
  const mappedFrontSrc = bdIsFrontBack ? bdGetMappedMockupSrc("front", colorValue) : "";
  const mappedBackSrc = bdIsFrontBack ? bdGetMappedMockupSrc("back", colorValue) : "";

  // If user has not manually changed color yet,
  // use the first variant image for preview instead of gallery featured image.
  if (mappedFrontSrc) {
    frontSrc = mappedFrontSrc;
  } else if (!hasManualVariantInteraction && firstVariantSrc) {
    frontSrc = firstVariantSrc;
  } else {
    const variantFrontSrc = bdGetActiveGalleryImageSrc();
    frontSrc = variantFrontSrc || bdFindMockupSrc("front", colorValue);
  }

  if (bdIsFrontOnly) {
    backSrc = frontSrc;
  } else if (bdIsBackOnly) {
    backSrc = bdFindMockupSrc("back", colorValue) || frontSrc;
  } else {
    backSrc = mappedBackSrc || bdFindMockupSrc("back", colorValue) || frontSrc;
  }

  if (frontSrc) base.setAttribute("data-front-src", frontSrc);
  if (backSrc) base.setAttribute("data-back-src", backSrc);

  return { frontSrc, backSrc };
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
    // still fire event so other code can re-align zone/hero
    try { document.dispatchEvent(new CustomEvent("bd:base-changed")); } catch (e) {}
    return;
  }

  base.src = next;

  try { document.dispatchEvent(new CustomEvent("bd:base-changed")); } catch (e) {}
};

// Keep preview base in sync with variant/color changes (Dawn events vary)
const bdOnVariantMaybeChanged = () => {
  try { bdResolvePreviewBaseSources(); } catch (e) {}
  try { bdSwitchMainMockup(bdGetActiveSide()); } catch (e) {}
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

    const color = bdGetCurrentColorFromUI();
    const pick = bdPickMockupsFromRegistry(color);

    // update data attrs (these are the source of truth)
    if (pick.front) previewBaseImg.setAttribute("data-front-src", pick.front);
    if (pick.back) previewBaseImg.setAttribute("data-back-src", pick.back);

    // ensure base image matches current side
    bdSwitchMainMockup(bdActiveSide);

    // also update ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Design PreviewÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â slide if present
    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
  };

  // keep zone aligned with base load
  const printZoneEl = canvas.querySelector(".cf-print-zone");

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
    if (BD_DISABLE_ZONE) return;

    const z = bdGetZone();
    if (!z.width || !z.height) return;

    const minW = Math.max(60, Math.round(z.width * 0.12));
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

  const bdCanvasToBlob = (proofCanvas) =>
    new Promise((resolve, reject) => {
      proofCanvas.toBlob(
        (blob) => {
          console.log("[Proof Debug] toBlob result", {
            hasBlob: !!blob,
            blobSize: blob ? blob.size : 0,
            blobType: blob ? blob.type : ""
          });
          if (blob) resolve(blob);
          else reject(new Error("Proof blob export failed"));
        },
        "image/png",
        0.92
      );
    });

  const bdUploadProofBlobToCloudinary = ({ blob, side }) => {
    const { cloud, preset, folder } = bdGetProofCloudConfig();
    if (!cloud || !preset || !blob) {
      return Promise.reject(new Error("Missing proof Cloudinary configuration"));
    }

    console.log("[Proof Debug] Before Cloudinary upload", {
      cloud,
      preset,
      folder,
      side
    });

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`;
    const fd = new FormData();
    fd.append("file", blob, `proof-${side}-${Date.now()}.png`);
    fd.append("upload_preset", preset);
    if (folder) fd.append("folder", folder);

    return fetch(uploadUrl, {
      method: "POST",
      body: fd
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      const proofUrl = json.secure_url || json.url || "";
      console.log("[Proof Debug] After Cloudinary upload response", {
        secure_url: json.secure_url || "",
        url: json.url || "",
        isEmpty: !proofUrl
      });
      return proofUrl;
    });
  };

  const bdGetPlacementPayloadForSide = (side) => {
    const form = bdFindCartForm();
    if (!form) return null;

    const { placementFront, placementBack } = bdEnsurePropertyInputs(form);
    const el = side === "back" ? placementBack : placementFront;
    if (!el || !el.value) return null;

    try {
      return JSON.parse(el.value);
    } catch (e) {
      return null;
    }
  };

  const bdRenderProofBlobForSide = async (side) => {
    const s = side === "back" ? "back" : "front";
    const hasDesign = s === "back" ? hasBackDesign : hasFrontDesign;
    const designSrc = s === "back" ? objectUrlBack : objectUrlFront;
    if (!hasDesign || !designSrc) return null;

    const activeSideBefore = bdGetActiveSide();
    if (activeSideBefore !== s && typeof window.bdSwitchPreviewSide === "function") {
      window.bdSwitchPreviewSide(s);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    bdSetActiveSideUi(s);
    bdUseSideState(s);
    bdWritePlacement();

    const placement = bdGetPlacementPayloadForSide(s);
    const baseSrc = previewBaseImg ? (previewBaseImg.currentSrc || previewBaseImg.src || "") : "";
    console.log("[Proof Debug] Proof sync starts", {
      side: s,
      hasDesign,
      hasBaseSrc: !!baseSrc,
      hasPlacement: !!placement
    });
    if (!placement || !baseSrc) return null;

    let baseImg;
    let overlayImg;
    try {
      [baseImg, overlayImg] = await Promise.all([
        bdLoadImageForProof(baseSrc),
        bdLoadImageForProof(designSrc)
      ]);
    } catch (err) {
      console.error("Proof render failed", err);
      throw err;
    }

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

    console.log("[Proof Debug] After proof canvas render", {
      canvasWidth: outW,
      canvasHeight: outH,
      drawX,
      drawY,
      drawW,
      drawH
    });

    ctx.drawImage(overlayImg, drawX, drawY, drawW, drawH);

    try {
      return await bdCanvasToBlob(proofCanvas);
    } catch (err) {
      console.error("Proof blob export failed", err);
      throw err;
    }
  };

  let bdProofSyncTimer = null;
  let bdProofSyncSeq = 0;
  let bdProofLastUploadedKey = { front: "", back: "" };
  let bdProofLastUrl = { front: "", back: "" };
  let bdProofInFlightPromise = { front: null, back: null };

  const bdGetProofStateKey = (side) => {
    const s = side === "back" ? "back" : "front";
    const designSrc = s === "back" ? objectUrlBack : objectUrlFront;
    const hasDesign = s === "back" ? hasBackDesign : hasFrontDesign;
    const placement = bdGetPlacementPayloadForSide(s);
    const baseSrc = previewBaseImg ? (previewBaseImg.currentSrc || previewBaseImg.src || "") : "";
    if (!hasDesign || !designSrc || !placement || !baseSrc) return "";
    return JSON.stringify({
      side: s,
      baseSrc,
      designSrc,
      placement
    });
  };

  const bdSyncProofMockupNow = async ({ side, force = false } = {}) => {
    console.log("BD DEBUG: sync proof now", { side });
    const targetSide = side === "back" ? "back" : side === "front" ? "front" : bdGetActiveSide();
    const proofKey = bdGetProofStateKey(targetSide);
    if (!proofKey) {
      window.bdSetProofMockupUrl("", targetSide);
      bdProofLastUploadedKey[targetSide] = "";
      bdProofLastUrl[targetSide] = "";
      if (!hasFrontDesign && !hasBackDesign) window.bdSetProofMockupUrl("");
      return "";
    }

    if (!force && bdProofLastUploadedKey[targetSide] === proofKey && bdProofLastUrl[targetSide]) {
      window.bdSetProofMockupUrl(bdProofLastUrl[targetSide], targetSide);
      return bdProofLastUrl[targetSide];
    }

    const seq = ++bdProofSyncSeq;
    bdProofInFlightPromise[targetSide] = (async () => {
      const blob = await bdRenderProofBlobForSide(targetSide);
      if (!blob) return "";

      let url = "";
      try {
        url = await bdUploadProofBlobToCloudinary({ blob, side: targetSide });
      } catch (err) {
        console.error("Proof Cloudinary upload failed", err);
        throw err;
      }
      if (seq !== bdProofSyncSeq) return "";

      bdProofLastUploadedKey[targetSide] = proofKey;
      bdProofLastUrl[targetSide] = (url || "").trim();
      try {
        window.bdSetProofMockupUrl(bdProofLastUrl[targetSide], targetSide);
        const form = bdFindCartForm();
        const proofInput = form
          ? form.querySelector(targetSide === "back" ? "#bd_proof_mockup_url_back" : "#bd_proof_mockup_url_front")
          : null;
        console.log("[Proof Debug] After setting Proof Mockup URL", {
          inputExists: !!proofInput,
          writtenValue: proofInput ? proofInput.value : ""
        });
      } catch (err) {
        console.error("Proof URL assignment failed", err);
        throw err;
      }
      return bdProofLastUrl[targetSide];
    })().catch((err) => {
      console.error("Proof mockup sync failed", err);
      return "";
    }).finally(() => {
      bdProofInFlightPromise[targetSide] = null;
    });

    return bdProofInFlightPromise[targetSide];
  };

  const bdScheduleProofMockupSync = ({ delay = 650, side, force = false } = {}) => {
    console.log("BD DEBUG: schedule proof sync", { side });
    clearTimeout(bdProofSyncTimer);
    bdProofSyncTimer = setTimeout(() => {
      bdSyncProofMockupNow({ side, force });
    }, Math.max(500, Math.min(800, delay)));
  };

  window.bdEnsureProofMockupUrl = async function ({ force = false } = {}) {
    clearTimeout(bdProofSyncTimer);
    const side = bdGetActiveSide();
    if (bdProofInFlightPromise[side]) {
      try {
        await bdProofInFlightPromise[side];
      } catch (e) {}
    }
    return bdSyncProofMockupNow({ side, force });
  };

  window.bdEnsureAllProofMockupUrls = async function ({ force = false } = {}) {
    clearTimeout(bdProofSyncTimer);
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
      await bdSyncProofMockupNow({ side, force });
    }

    return bdProofLastUrl.front || bdProofLastUrl.back || "";
  };

  const apply = () => {
    wrap.style.left = `${state.cx}px`;
    wrap.style.top = `${state.cy}px`;
    wrap.style.width = `${state.w}px`;
    wrap.style.height = `${state.h}px`;

    dimLabel.textContent = `W: ${Math.round(state.w)}px  H: ${Math.round(state.h)}px`;
    dimLabel.hidden = false;

    bdWritePlacement();
    if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate();

    // also refresh design preview slide overlay
    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
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
      try {
        document.dispatchEvent(new CustomEvent("bd:base-changed"));
      } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
      } catch (e) {}
      try {
        if (hasFrontDesign || hasBackDesign) bdScheduleProofMockupSync({ side: bdGetActiveSide() });
      } catch (e) {}
    });
  }

  requestAnimationFrame(() => {
    try {
      bdUpdatePrintZoneFromInches();
    } catch (e) {}
  });

  window.addEventListener("resize", () =>
    requestAnimationFrame(() => {
      try {
        bdUpdatePrintZoneFromInches();
      } catch (e) {}
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

    const z = bdGetZone();
    state.cx = z.left + z.width / 2;
    state.cy = z.top + z.height / 2;

    const initW = Math.round(cw * 0.4);
    state.w = clamp(initW, 60, Math.round(cw * 0.95));
    state.h = Math.round(state.w / state.ar);

    bdClampSizeAndPosToZone();
  };

  const showPreview = () => {
    if (bdStartGateEnabled && designerBody && bdIsElementActuallyHidden(designerBody)) {
      bdOpenDesignerUi();
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
      if (objectUrlBack) URL.revokeObjectURL(objectUrlBack);
      objectUrlBack = null;
      hasBackDesign = false;
    } else if (sideToClear === "front") {
      if (objectUrlFront) URL.revokeObjectURL(objectUrlFront);
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
      bdProofLastUploadedKey = { front: "", back: "" };
      bdProofLastUrl = { front: "", back: "" };
      window.bdSetProofMockupUrl("");
    } else {
      window.bdSetProofMockupUrl("", sideToClear === "back" ? "back" : "front");
      bdScheduleProofMockupSync({ side: bdGetActiveSide() });
    }

    try {
      document.dispatchEvent(new CustomEvent("bd:design-preview-refresh"));
    } catch (e) {}
  };

  // --------------------------
  // Side switch (global)
  // --------------------------
// ---------------------------
// ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Side switch (fixed): front/back positions are independent
// ---------------------------
window.bdSwitchPreviewSide = function (side) {
  // 1) Save current sideÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢s geometry before switching
  try { bdPersistActiveState(); } catch (e) {}

  const s = (side === "back") ? "back" : "front";
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
  const currentFile = bdGetCurrentFileForSide(s);

  // If no design on this side yet: show base only, hide overlay
  if (!has || !url || !currentFile) {
    designImg.hidden = true;
    wrap.style.display = "none";
    dimLabel.hidden = true;

    // Keep has-design if ANY side has a design
    const any = !!(hasFrontDesign || hasBackDesign);
    if (any) box.classList.add("has-design");

    requestAnimationFrame(() => {
      try { bdSyncPreviewBase(); } catch (e) {}
      try { bdUpdatePrintZoneFromInches(); } catch (e) {}
      try {
        if (typeof window.bdGalleryRestorePrimaryMedia === "function") {
          window.bdGalleryRestorePrimaryMedia();
        }
      } catch (e) {}
      try { document.dispatchEvent(new CustomEvent("bd:design-preview-refresh")); } catch (e) {}
      try { if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate(); } catch (e) {}
    });

    return;
  }

  // Has design: show overlay for this side
  designImg.hidden = false;
  wrap.style.display = "block";
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
      try { bdRefreshZoneAndClamp(); } catch (e) {}
      try { apply(); } catch (e) {}
      try { bdScheduleProofMockupSync({ side: s }); } catch (e) {}
      try { document.dispatchEvent(new CustomEvent("bd:design-preview-refresh")); } catch (e) {}
      try { if (typeof window.bdHeroPreviewUpdate === "function") window.bdHeroPreviewUpdate(); } catch (e) {}
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
      if (objectUrlFront) URL.revokeObjectURL(objectUrlFront);
      objectUrlFront = URL.createObjectURL(file);
    } else {
      if (objectUrlBack) URL.revokeObjectURL(objectUrlBack);
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
        if ((t.__bdCropBypassCount || 0) > 0) {
          t.__bdCropBypassCount -= 1;
          return;
        }

        const file = t.files && t.files[0];
        const side = t.id === "cfUploadBack" ? "back" : "front";
        if (!file) return;
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
      }
    },
    true
  );

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
      bdClampSizeAndPosToZone();
      apply();
      return;
    }

    if (mode === "resize" && activeHandle) {
      const r = canvasRect();
      const minW = Math.max(60, Math.round(r.width * 0.12));
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
      bdClampSizeAndPosToZone();
      apply();
    }
  });

const endPointer = () => {
  if (bdCropState.isOpen) return;
  mode = null;
  activeHandle = null;
  box.classList.remove("is-interacting");
  try { bdPersistActiveState(); } catch (e) {}
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
      bdClampSizeAndPosToZone();
      apply();
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

  // Initial sync once DOM ready
  requestAnimationFrame(() => {
    bdSyncBaseByVariantColor();
    // set correct side base right away
    bdSwitchMainMockup(bdActiveSide);
  });
})();

/* ----------------------------
   STEP 1 (DAWN-SAFE) Gate: message + block submit if no upload
---------------------------- */
(function () {
  function bdIsPreviewRequired() {
    return document.documentElement.classList.contains("bd-tshirt-preview-required");
  }

  function bdIsFrontBackStatusMode() {
    const box = document.getElementById("cf-tshirt-preview-container");
    if (!box) return false;
    return String(box.dataset.cfConfig || "").toLowerCase().trim() === "front-back";
  }

  function bdHasLiteUploadSelected() {
    if (typeof window.__bdTshirtHasFileSelected === "boolean") {
      return window.__bdTshirtHasFileSelected;
    }
    const f1 = document.getElementById("cfUploadFront");
    const f2 = document.getElementById("cfUploadBack");
    return !!((f1 && f1.files && f1.files.length) || (f2 && f2.files && f2.files.length));
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
      form.appendChild(box);
    }
    return box;
  }

  function bdSetUi(form) {
    if (!bdIsPreviewRequired()) return;

    const box = bdEnsureStatusBox(form);
    const f1 = document.getElementById("cfUploadFront");
    const f2 = document.getElementById("cfUploadBack");
    const hasFrontUpload = !!(f1 && f1.files && f1.files.length);
    const hasBackUpload = !!(f2 && f2.files && f2.files.length);
    const hasUpload = hasFrontUpload || hasBackUpload;

    if (bdIsFrontBackStatusMode()) {
      if (hasFrontUpload && hasBackUpload) {
        box.textContent = "Front and back designs uploaded. You can add to cart.";
      } else if (hasFrontUpload) {
        box.textContent = "Front design uploaded, back pending. You can add to cart.";
      } else if (hasBackUpload) {
        box.textContent = "Back design uploaded, front pending. You can add to cart.";
      } else {
        box.textContent = "Please upload your design before adding to cart.";
      }
    } else {
      box.textContent = hasUpload ? "Design selected. You can add to cart." : "Please upload your design before adding to cart.";
    }
    box.style.opacity = hasUpload ? "1" : "0.95";
  }

  function bdRefreshAll() {
    if (!bdIsPreviewRequired()) return;
    bdGetForms().forEach(bdSetUi);
  }

  function bdAttach() {
    if (!bdIsPreviewRequired()) return;

    window.bdTshirtGateRefresh = bdRefreshAll;
    bdRefreshAll();

    const f1 = document.getElementById("cfUploadFront");
    const f2 = document.getElementById("cfUploadBack");
    [f1, f2].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("change", () => {
        window.__bdTshirtHasFileSelected = bdHasLiteUploadSelected();
        bdRefreshAll();
      });
    });

    document.addEventListener(
      "submit",
      async function (e) {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.action || !form.action.includes("/cart/add")) return;
        if (!bdIsPreviewRequired()) return;
        if (form.__bdProofSubmitting) return;

        if (!bdHasLiteUploadSelected()) {
          e.preventDefault();
          e.stopPropagation();
          bdSetUi(form);
          const box = form.querySelector(".bd-tshirt-status");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        const proofInputFront = form.querySelector("#bd_proof_mockup_url_front");
        const proofInputBack = form.querySelector("#bd_proof_mockup_url_back");
        const proofInput = form.querySelector("#bd_proof_mockup_url");
        console.log("[Proof Debug] Add-to-cart fallback check", {
          proofUrlBlankBeforeSubmit: !proofInput || !proofInput.value.trim(),
          proofFrontBlankBeforeSubmit: !proofInputFront || !proofInputFront.value.trim(),
          proofBackBlankBeforeSubmit: !proofInputBack || !proofInputBack.value.trim()
        });
        const missingFrontProof = hasFrontDesign && (!proofInputFront || !proofInputFront.value.trim());
        const missingBackProof = hasBackDesign && (!proofInputBack || !proofInputBack.value.trim());
        const missingAnyProof =
          !proofInput ||
          !proofInput.value.trim() ||
          missingFrontProof ||
          missingBackProof;

        if (typeof window.bdEnsureAllProofMockupUrls === "function" && missingAnyProof) {
          e.preventDefault();
          e.stopPropagation();
          console.log("[Proof Debug] Add-to-cart fallback proof generation runs", {
            hasEnsureFn: typeof window.bdEnsureAllProofMockupUrls === "function",
            missingFrontProof,
            missingBackProof
          });

          try {
            await window.bdEnsureAllProofMockupUrls({ force: true });
          } catch (err) {
            console.error("Proof mockup fallback failed", err);
          }

          const proofInputAfter = form.querySelector("#bd_proof_mockup_url");
          const proofFrontAfter = form.querySelector("#bd_proof_mockup_url_front");
          const proofBackAfter = form.querySelector("#bd_proof_mockup_url_back");
          console.log("[Proof Debug] Add-to-cart fallback result", {
            proofUrlAfterFallback: proofInputAfter ? proofInputAfter.value : "",
            proofFrontAfterFallback: proofFrontAfter ? proofFrontAfter.value : "",
            proofBackAfterFallback: proofBackAfter ? proofBackAfter.value : ""
          });

          form.__bdProofSubmitting = true;
          try {
            form.requestSubmit();
          } finally {
            setTimeout(() => {
              form.__bdProofSubmitting = false;
            }, 0);
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

  document.addEventListener("bd:placement-updated", refresh);
  document.addEventListener("bd:base-changed", refresh);
  document.addEventListener("bd:design-preview-refresh", refresh);
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
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);

  requestAnimationFrame(refresh);
})();

