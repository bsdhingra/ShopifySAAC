/* assets/cf-tumbler-preview.js */
(function () {
  const root = document.getElementById("cf-tumbler-preview-container");
  if (!root) return;

  const startBtn = root.querySelector("[data-cf-start-btn]");
  const body = root.querySelector(".cf-tumbler-designer-body");
  const uploadBtn = root.querySelector("[data-cf-tumbler-upload-btn]");
  const cropBtn = root.querySelector("[data-cf-tumbler-crop-btn]");
  const resetBtn = root.querySelector("[data-cf-tumbler-reset-btn]");
  const cropCancelBtn = root.querySelector("[data-cf-tumbler-crop-cancel-btn]");
  const cropOriginalBtn = root.querySelector("[data-cf-tumbler-crop-original-btn]");
  const loadOriginalBtn = root.querySelector("[data-cf-tumbler-load-original-btn]");
  const cropApplyBtn = root.querySelector("[data-cf-tumbler-crop-apply-btn]");
  const stage = root.querySelector("[data-cf-tumbler-stage]");
  const editorCanvas = root.querySelector("[data-cf-tumbler-editor-canvas]");
  const designViewport = root.querySelector("[data-cf-tumbler-design-viewport]");
  const designWrap = root.querySelector("[data-cf-tumbler-design-wrap]");
  const designEditImg = root.querySelector("[data-cf-tumbler-design-edit]");
  const resizeHandle = root.querySelector("[data-cf-tumbler-handle]");
  const compositeCanvas = root.querySelector("[data-cf-tumbler-composite-canvas]");
  const guideEls = Array.from(root.querySelectorAll("[data-cf-guide]"));
  const statusEl = root.querySelector("[data-cf-tumbler-status]");
  const metaEl = root.querySelector("[data-cf-tumbler-meta]");
  const uploadHintEl = root.querySelector(".cf-tumbler-upload-hint");

  const uploader = document.querySelector("[data-cf-uploader]");
  const uploadInput = uploader ? uploader.querySelector('[data-upload-input="1"]') : null;
  const previewWrap = uploader ? uploader.querySelector('[data-preview-wrap="1"]') : null;
  const previewImg = uploader ? uploader.querySelector('[data-preview-img="1"]') : null;
  const statusSource = uploader ? uploader.querySelector('[data-status="1"]') : null;
  const metaSource = uploader ? uploader.querySelector('[data-meta="1"]') : null;
  const designUrlInput = uploader ? uploader.querySelector('[data-url="1"]') : null;
  const masterOriginalUrlInput = uploader ? uploader.querySelector('[data-master-url="1"]') : null;
  const productInfo = root.closest("product-info");
  const productHandle = root.dataset.productHandle || "";
  const configUrl = root.dataset.configUrl || "";

  if (!stage || !editorCanvas || !designViewport || !designWrap || !designEditImg || !compositeCanvas || !uploadInput) return;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const setRgbaAlpha = (color, alpha) => {
    const raw = String(color || "").trim();
    if (!raw) return `rgba(15, 23, 42, ${alpha})`;
    const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(",").map((part) => part.trim());
      if (parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      }
    }
    const hexMatch = raw.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      const normalized = hex.length === 3
        ? hex.split("").map((char) => char + char).join("")
        : hex;
      const red = parseInt(normalized.slice(0, 2), 16);
      const green = parseInt(normalized.slice(2, 4), 16);
      const blue = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    return raw;
  };
  const isMobileViewport = () => window.matchMedia && window.matchMedia("(max-width: 749px)").matches;
  const isLargeUploadMessage = (text) => {
    const value = String(text || "").trim();
    if (!value) return false;
    return /10mb/i.test(value) || /info@sarvsartsandcrafts\.com/i.test(value);
  };
  const state = {
    src: "",
    width: 0,
    height: 0,
    aspect: 1,
    placement: null,
    initialPlacement: null
  };
  const CROP_MIN_SIZE = 20;
  const cropSourceState = {
    ownerOriginalFile: null,
    ownerOriginalUrl: "",
    originalFile: null,
    originalObjectUrl: "",
    currentFile: null,
    currentObjectUrl: "",
    crop: null
  };
  const cropState = {
    isOpen: false,
    file: null,
    objectUrl: "",
    loadedImage: null,
    naturalWidth: 0,
    naturalHeight: 0,
    stage: { x: 0, y: 0, w: 0, h: 0 },
    image: { x: 0, y: 0, w: 0, h: 0, scale: 1 },
    cropRect: { x: 0, y: 0, w: 0, h: 0 },
    pointerMode: null,
    pointerId: null,
    pointerStart: null
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
  let draftPersistFrame = 0;
  let draftEditableSourceSnapshot = null;
  let draftEditableSourceSeq = 0;
  let cropApplyInFlight = false;
  let workingFilePrepareToken = 0;
  const MOBILE_PROOF_WAIT_MS = 1200;
  const MAX_DRAFT_EDITABLE_SOURCE_BYTES = 1800000;
  const PROOF_NOTICE_TEXT = "Proof size is greater than 10MB. Our team will send you the proof before printing.";
  const UPLOAD_NOTICE_TEXT = "Your image is larger than 10MB, but no worries-you can still edit and preview your design. After placing your order, just email your image to info@sarvsartsandcrafts.com, and we'll handle the proof for you.";
  const BOTH_NOTICE_TEXT = "Uploaded file size and proof size are greater than 10MB. Please send your image by email at info@sarvsartsandcrafts.com, and our team will send you the proof before printing.";
  const getScopedProductRoot = () =>
    productInfo ||
    root.closest(".shopify-section") ||
    document;
  const getMediaGallery = () =>
    root.closest(".shopify-section")?.querySelector("media-gallery") ||
    document.querySelector("media-gallery");
  const getThumbnailSlider = () => getMediaGallery()?.querySelector('[id^="GalleryThumbnails-"]') || null;
  const getDraftSessionKey = () =>
    `cf-customizer-draft:tumbler:${productHandle || window.location.pathname}`;
  const DRAFT_EDITABLE_SOURCE_DB = "bd-customizer-drafts";
  const DRAFT_EDITABLE_SOURCE_STORE = "editable-sources";

  const openDraftEditableSourceDb = (() => {
    let dbPromise = null;
    return () => {
      if (dbPromise) return dbPromise;
      if (!window.indexedDB) return Promise.resolve(null);
      dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(DRAFT_EDITABLE_SOURCE_DB, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DRAFT_EDITABLE_SOURCE_STORE)) {
              db.createObjectStore(DRAFT_EDITABLE_SOURCE_STORE, { keyPath: "key" });
            }
          };
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
      return dbPromise;
    };
  })();

  const withDraftEditableSourceStore = async (mode, runner) => {
    const db = await openDraftEditableSourceDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(DRAFT_EDITABLE_SOURCE_STORE, mode);
        const store = tx.objectStore(DRAFT_EDITABLE_SOURCE_STORE);
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        tx.oncomplete = () => finish(null);
        tx.onerror = () => finish(null);
        tx.onabort = () => finish(null);
        runner(store, finish);
      } catch (e) {
        resolve(null);
      }
    });
  };

  const persistDraftEditableSource = (file) => {
    const draftKey = getDraftSessionKey();
    if (!draftKey) return Promise.resolve(false);
    if (!file || !canCropFile(file)) {
      return withDraftEditableSourceStore("readwrite", (store, finish) => {
        const req = store.delete(draftKey);
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
      }).then((result) => result === true);
    }
    return file.arrayBuffer()
      .then((buffer) =>
        withDraftEditableSourceStore("readwrite", (store, finish) => {
          const req = store.put({
            key: draftKey,
            savedAt: Date.now(),
            name: String(file.name || "tumbler-design.png"),
            type: String(file.type || "image/png"),
            lastModified: Number(file.lastModified || Date.now()),
            buffer
          });
          req.onsuccess = () => finish(true);
          req.onerror = () => finish(false);
        })
      )
      .then((result) => result === true)
      .catch(() => false);
  };

  const readDraftEditableSource = () => {
    const draftKey = getDraftSessionKey();
    if (!draftKey) return Promise.resolve(null);
    return withDraftEditableSourceStore("readonly", (store, finish) => {
      const req = store.get(draftKey);
      req.onsuccess = () => finish(req.result || null);
      req.onerror = () => finish(null);
    });
  };

  const clearDraftEditableSource = () => persistDraftEditableSource(null);
  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read draft editable source"));
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });

  const getProductForm = () => {
    if (productInfo) {
      return productInfo.querySelector('form[data-type="add-to-cart-form"]');
    }
    return document.querySelector('form[data-type="add-to-cart-form"]');
  };

  const ensureThumbnailLockNotice = () => {
    const slider = getThumbnailSlider();
    if (!slider) return null;
    let notice = slider.parentElement ? slider.parentElement.querySelector("[data-cf-tumbler-thumb-lock-note]") : null;
    if (notice) return notice;
    notice = document.createElement("p");
    notice.setAttribute("data-cf-tumbler-thumb-lock-note", "");
    notice.className = "cf-tumbler-thumbnail-lock-note";
    notice.hidden = true;
    notice.textContent = "While editing, product gallery thumbnails are unavailable.";
    slider.insertAdjacentElement("afterend", notice);
    return notice;
  };

  const syncThumbnailLockState = () => {
    const gallery = getMediaGallery();
    if (!gallery) return;
    const isLocked = !!state.src;
    gallery.classList.toggle("bd-tumbler-thumbs-locked", isLocked);

    const notice = ensureThumbnailLockNotice();
    if (notice) notice.hidden = !isLocked;

    gallery.querySelectorAll("button.thumbnail").forEach((button) => {
      button.classList.toggle("is-tumbler-thumb-locked", isLocked);
      button.setAttribute("aria-disabled", isLocked ? "true" : "false");
      button.disabled = isLocked;
      if (isLocked) {
        button.setAttribute("title", "Finish reviewing the active design before browsing other product images.");
      } else {
        button.removeAttribute("title");
      }
    });
  };

  const mountSharedUploadNotice = () => {
    const notice = getScopedProductRoot().querySelector("[data-cf-upload-notice]");
    if (!notice || !uploadBtn || !uploadBtn.parentNode) return;

    notice.style.marginTop = "0";
    notice.style.marginBottom = "0";
    if (notice.parentNode !== uploadBtn.parentNode || notice.nextElementSibling !== uploadBtn) {
      uploadBtn.insertAdjacentElement("beforebegin", notice);
    }
  };

  const setBodyOpen = () => {
    if (body && body.hidden) body.hidden = false;
    root.classList.add("is-design-open");
  };

  const isSvgFile = (file) => !!(file && file.type === "image/svg+xml");
  const canCropFile = (file) => !!(file && !isSvgFile(file) && String(file.type || "").startsWith("image/"));
  const isCropPending = () => !!cropState.isOpen;
  const getFileBaseName = (fileName) => String(fileName || "design").replace(/\.[^.]+$/, "");

  const revokeOriginalObjectUrl = () => {
    if (!cropSourceState.originalObjectUrl) return;
    try {
      URL.revokeObjectURL(cropSourceState.originalObjectUrl);
    } catch (e) {}
    cropSourceState.originalObjectUrl = "";
  };

  const revokeCurrentObjectUrl = () => {
    if (!cropSourceState.currentObjectUrl) return;
    try {
      URL.revokeObjectURL(cropSourceState.currentObjectUrl);
    } catch (e) {}
    cropSourceState.currentObjectUrl = "";
  };

  const setOwnerOriginalFile = (file) => {
    cropSourceState.ownerOriginalFile = file || null;
    cropSourceState.ownerOriginalUrl = "";
  };

  const setOriginalEditorFile = (file) => {
    revokeOriginalObjectUrl();
    revokeCurrentObjectUrl();
    cropSourceState.originalFile = file || null;
    cropSourceState.currentFile = file || null;
    cropSourceState.crop = null;
    cropSourceState.originalObjectUrl = file ? URL.createObjectURL(file) : "";
    cropSourceState.currentObjectUrl = file ? URL.createObjectURL(file) : "";
    persistDraftEditableSource(file);
    cacheDraftEditableSource(file);
  };

  const setCurrentEditorFile = (file) => {
    revokeCurrentObjectUrl();
    cropSourceState.currentFile = file || null;
    cropSourceState.currentObjectUrl = file ? URL.createObjectURL(file) : "";
  };

  const setEditorCropMeta = (cropMeta) => {
    cropSourceState.crop = cropMeta ? { ...cropMeta } : null;
  };

  const getMasterOriginalUrl = () => String((masterOriginalUrlInput && masterOriginalUrlInput.value) || "").trim();
  const readMasterOriginalFile = () => {
    if (typeof window.bdReadMasterOriginalUpload !== "function" || !uploader) {
      return Promise.resolve(null);
    }
    return Promise.resolve(window.bdReadMasterOriginalUpload(uploader, "1")).catch(() => null);
  };

  const inferFilenameFromUrl = (src, fallback = "tumbler-design.png") => {
    try {
      const url = new URL(String(src || "").trim(), window.location.origin);
      const pathname = String(url.pathname || "").trim();
      const base = pathname ? pathname.split("/").filter(Boolean).pop() || "" : "";
      return base || fallback;
    } catch (e) {
      return fallback;
    }
  };

  const assignRestoredCropFile = (file, options = {}) => {
    const promoteOriginal = !!(options && options.promoteOriginal);
    setCurrentEditorFile(file);
    if (promoteOriginal || !cropSourceState.originalFile) {
      setOriginalEditorFile(file);
    }
  };

  const ensureRemoteCropSourceFile = (() => {
    let inFlight = null;
    let lastUrl = "";
    return async (src, options = {}) => {
      const designSrc = String(src || "").trim();
      if (!isRemoteDesignSrc(designSrc)) return null;
      if (
        cropSourceState.currentFile &&
        cropSourceState.currentObjectUrl &&
        lastUrl === designSrc
      ) {
        return cropSourceState.currentFile;
      }
      if (inFlight && lastUrl === designSrc) return inFlight;
      lastUrl = designSrc;
      inFlight = fetch(designSrc, { credentials: "omit" })
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to restore remote crop source (${response.status})`);
          return response.blob();
        })
        .then((blob) => {
          const blobType = String((blob && blob.type) || "").trim();
          if (!/^image\//i.test(blobType)) return null;
          const restoredFile = new File(
            [blob],
            inferFilenameFromUrl(designSrc, /^image\/png$/i.test(blobType) ? "tumbler-design.png" : "tumbler-design.jpg"),
            {
              type: blobType || "image/png",
              lastModified: Date.now()
            }
          );
          assignRestoredCropFile(restoredFile, { promoteOriginal: !!options.promoteOriginal });
          syncCropActionButtons();
          return restoredFile;
        })
        .catch(() => null)
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    };
  })();

  const ensureOriginalSvgInput = () => {
    const productForm = getProductForm();
    if (!productForm) return null;
    let input = productForm.querySelector("#cf_tumbler_original_svg_url");
    if (input) return input;
    input = document.createElement("input");
    input.type = "hidden";
    input.id = "cf_tumbler_original_svg_url";
    input.name = "properties[_Original SVG URL]";
    productForm.appendChild(input);
    return input;
  };

  const setOriginalSvgUrl = (url) => {
    const input = ensureOriginalSvgInput();
    if (input) input.value = String(url || "").trim();
  };

  const shouldPreferWorkingRenderSrc = () =>
    !!(
      cropSourceState.currentObjectUrl &&
      cropSourceState.currentFile
    );

  const syncCropActionButtons = () => {
    const hasUploadedDesign = !!String(
      (designUrlInput && designUrlInput.value) ||
      state.src ||
      ""
    ).trim();
    const canRecrop = !!hasUploadedDesign;
    const hasAppliedCrop = !!cropSourceState.crop;
    const shouldShowCropBtn = !cropState.isOpen && canRecrop;
    const shouldShowResetBtn = !cropState.isOpen && hasUploadedDesign;
    const shouldShowLoadOriginalBtn = !cropState.isOpen && hasUploadedDesign;
    const shouldShowCancelBtn = cropState.isOpen;
    const shouldShowApplyBtn = cropState.isOpen;
    const shouldShowOriginalBtn = cropState.isOpen && !!cropSourceState.originalFile;

    if (cropBtn) {
      cropBtn.hidden = !shouldShowCropBtn;
      cropBtn.style.display = shouldShowCropBtn ? "" : "none";
    }
    if (resetBtn) {
      resetBtn.hidden = !shouldShowResetBtn;
      resetBtn.style.display = shouldShowResetBtn ? "" : "none";
    }
    if (loadOriginalBtn) {
      loadOriginalBtn.hidden = !shouldShowLoadOriginalBtn;
      loadOriginalBtn.style.display = shouldShowLoadOriginalBtn ? "" : "none";
    }
    if (cropCancelBtn) {
      cropCancelBtn.hidden = !shouldShowCancelBtn;
      cropCancelBtn.style.display = shouldShowCancelBtn ? "" : "none";
    }
    if (cropApplyBtn) {
      cropApplyBtn.hidden = !shouldShowApplyBtn;
      cropApplyBtn.style.display = shouldShowApplyBtn ? "" : "none";
    }
    if (cropOriginalBtn) {
      cropOriginalBtn.hidden = !shouldShowOriginalBtn;
      cropOriginalBtn.style.display = shouldShowOriginalBtn ? "" : "none";
    }
    if (uploadHintEl) {
      uploadHintEl.hidden = !hasUploadedDesign;
      uploadHintEl.style.display = hasUploadedDesign ? "" : "none";
    }

    if (uploadBtn) uploadBtn.disabled = cropState.isOpen;
    if (resetBtn) resetBtn.disabled = cropState.isOpen;
    if (cropBtn) cropBtn.disabled = cropState.isOpen;
    if (loadOriginalBtn) loadOriginalBtn.disabled = cropApplyInFlight;
    if (cropCancelBtn) cropCancelBtn.disabled = cropApplyInFlight;
    if (cropOriginalBtn) cropOriginalBtn.disabled = cropApplyInFlight;
    if (cropApplyBtn) cropApplyBtn.disabled = cropApplyInFlight;

    if (uploadBtn) uploadBtn.style.opacity = cropState.isOpen ? "0.55" : "";
    if (resetBtn) resetBtn.style.opacity = cropState.isOpen ? "0.55" : "";
    if (cropBtn) cropBtn.style.opacity = cropState.isOpen ? "0.55" : "";
  };

  const revokeCropObjectUrl = () => {
    if (!cropState.objectUrl) return;
    try {
      URL.revokeObjectURL(cropState.objectUrl);
    } catch (e) {}
    cropState.objectUrl = "";
  };

  const resetCropState = () => {
    cropState.isOpen = false;
    cropState.file = null;
    cropState.loadedImage = null;
    cropState.naturalWidth = 0;
    cropState.naturalHeight = 0;
    cropState.stage = { x: 0, y: 0, w: 0, h: 0 };
    cropState.image = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
    cropState.cropRect = { x: 0, y: 0, w: 0, h: 0 };
    cropState.pointerMode = null;
    cropState.pointerId = null;
    cropState.pointerStart = null;
    revokeCropObjectUrl();
  };

  const setCropEditorIsolation = (isOpen) => {
    if (designWrap) {
      designWrap.style.pointerEvents = isOpen ? "none" : "";
    }
    if (resizeHandle) {
      resizeHandle.style.pointerEvents = isOpen ? "none" : "";
    }
  };

  const resetMainEditorInteraction = () => {
    pointerMode = null;
    activePointerId = null;
    pointerStart = null;
    startPlacement = null;
    if (designWrap) {
      designWrap.classList.remove("is-dragging", "is-resizing");
    }
  };

  const isRemoteDesignSrc = (src) => /^(https?:)?\/\//i.test(String(src || "").trim());
  const isBlobDesignSrc = (src) => /^blob:/i.test(String(src || "").trim());
  const getDurableDesignUrl = (fallback = "") => {
    const inputUrl = designUrlInput ? String(designUrlInput.value || "").trim() : "";
    if (isRemoteDesignSrc(inputUrl)) return inputUrl;
    const safeFallback = String(fallback || "").trim();
    return isRemoteDesignSrc(safeFallback) ? safeFallback : "";
  };

  const loadDesignEditImage = (src, onload) => {
    const nextSrc = String(src || "").trim();
    const needsCors = nextSrc && !/^blob:/i.test(nextSrc) && isRemoteDesignSrc(nextSrc);
    const currentSrc = String(designEditImg.currentSrc || designEditImg.getAttribute("src") || designEditImg.src || "").trim();
    const corsReady = !needsCors || designEditImg.crossOrigin === "anonymous";

    designEditImg.onload = onload;
    designEditImg.crossOrigin = needsCors ? "anonymous" : null;

    if (currentSrc === nextSrc && designEditImg.complete && designEditImg.naturalWidth && corsReady) {
      designEditImg.onload();
      return;
    }

    if (currentSrc === nextSrc && needsCors && !corsReady) {
      designEditImg.removeAttribute("src");
    }

    designEditImg.src = nextSrc;
  };

  const buildDraftSessionSnapshot = () => {
    const designUrl = String(
      (designUrlInput && designUrlInput.value) ||
      state.src ||
      ""
    ).trim();
    if (!designUrl || !state.placement) return null;
    return {
      designUrl,
      editableSource: draftEditableSourceSnapshot ? { ...draftEditableSourceSnapshot } : null,
      placement: { ...state.placement },
      initialPlacement: state.initialPlacement ? { ...state.initialPlacement } : null,
      width: Number(state.width || 0),
      height: Number(state.height || 0),
      aspect: Number(state.aspect || 1),
      isOpen: root.classList.contains("is-design-open") || !body.hidden
    };
  };

  const dataUrlToBlob = (dataUrl) => {
    const raw = String(dataUrl || "");
    const parts = raw.split(",");
    if (parts.length < 2) throw new Error("Invalid data URL");
    const match = /^data:([^;]+);base64$/i.exec(parts[0]);
    const mimeType = match && match[1] ? match[1] : "application/octet-stream";
    const binary = window.atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  };

  const cacheDraftEditableSource = (file) => {
    const nextSeq = ++draftEditableSourceSeq;
    if (!file || !canCropFile(file) || Number(file.size || 0) > MAX_DRAFT_EDITABLE_SOURCE_BYTES) {
      draftEditableSourceSnapshot = null;
      scheduleDraftPersist();
      return;
    }
    readFileAsDataUrl(file)
      .then((dataUrl) => {
        if (nextSeq !== draftEditableSourceSeq) return;
        if (!dataUrl) {
          draftEditableSourceSnapshot = null;
          scheduleDraftPersist();
          return;
        }
        draftEditableSourceSnapshot = {
          name: String(file.name || "tumbler-design.png"),
          type: String(file.type || "image/png"),
          lastModified: Number(file.lastModified || Date.now()),
          dataUrl
        };
        scheduleDraftPersist();
      })
      .catch(() => {
        if (nextSeq !== draftEditableSourceSeq) return;
        draftEditableSourceSnapshot = null;
        scheduleDraftPersist();
      });
  };

  const ensureDraftCropSourceFile = (() => {
    let inFlight = null;
    return async (snapshot) => {
      if (cropSourceState.currentFile && canCropFile(cropSourceState.currentFile)) {
        return cropSourceState.currentFile;
      }
      if (inFlight) return inFlight;
      inFlight = Promise.resolve()
        .then(() => {
          const source = snapshot && snapshot.editableSource ? snapshot.editableSource : null;
          if (!source || !source.dataUrl || !source.type) return null;
          return new File(
            [dataUrlToBlob(source.dataUrl)],
            String(source.name || "tumbler-design.png"),
            {
              type: String(source.type || "image/png"),
              lastModified: Number(source.lastModified || Date.now())
            }
          );
        })
        .then((file) => {
          if (file) return file;
          return readDraftEditableSource().then((record) => {
            if (!record || !record.buffer) return null;
            return new File(
              [record.buffer],
              String(record.name || "tumbler-design.png"),
              {
                type: String(record.type || "image/png"),
                lastModified: Number(record.lastModified || Date.now())
              }
            );
          });
        })
        .then((file) => {
          if (!file || !canCropFile(file)) return null;
          setOriginalEditorFile(file);
          syncCropActionButtons();
          return file;
        })
        .catch(() => null)
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    };
  })();

  const persistDraftSessionNow = () => {
    const key = getDraftSessionKey();
    try {
      const snapshot = buildDraftSessionSnapshot();
      if (!snapshot) {
        window.sessionStorage.removeItem(key);
        clearDraftEditableSource();
        draftEditableSourceSnapshot = null;
        return false;
      }
      window.sessionStorage.setItem(key, JSON.stringify(snapshot));
      return true;
    } catch (e) {
      return false;
    }
  };

  const scheduleDraftPersist = () => {
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
    clearDraftEditableSource();
    draftEditableSourceSnapshot = null;
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

  const waitForNextDesignUrlChange = (previousUrl, timeoutMs) =>
    new Promise((resolve) => {
      const startValue = String(previousUrl || "").trim();
      const readValue = () => (designUrlInput ? String(designUrlInput.value || "").trim() : "");
      const initial = readValue();
      if (initial && initial !== startValue) {
        resolve(initial);
        return;
      }

      const start = Date.now();
      const tick = () => {
        const next = readValue();
        if (next && next !== startValue) {
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

  const rasterizeSvgFileToPng = async (file) => {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const loaded = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
        img.src = sourceUrl;
      });
      const width = Math.max(1, Math.round(loaded.naturalWidth || loaded.width || 1200));
      const height = Math.max(1, Math.round(loaded.naturalHeight || loaded.height || 1200));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Missing SVG rasterization canvas context");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(loaded, 0, 0, width, height);
      const blob = await canvasToBlob(canvas);
      return new File([blob], `${getFileBaseName(file.name)}-working.png`, {
        type: "image/png",
        lastModified: Date.now()
      });
    } finally {
      try {
        URL.revokeObjectURL(sourceUrl);
      } catch (e) {}
    }
  };

  const prepareInitialEditorFile = async (file) => {
    const token = ++workingFilePrepareToken;
    setOwnerOriginalFile(file);
    setEditorCropMeta(null);
    if (!file) {
      setOriginalEditorFile(null);
      setOriginalSvgUrl("");
      return;
    }

    if (!isSvgFile(file)) {
      setOriginalEditorFile(file);
      setOriginalSvgUrl("");
      return;
    }

    try {
      const rasterizedFile = await rasterizeSvgFileToPng(file);
      if (token !== workingFilePrepareToken) return;
      setOriginalEditorFile(rasterizedFile);
    } catch (err) {
      if (token !== workingFilePrepareToken) return;
      console.error("Tumbler SVG rasterization failed", err);
      setOriginalEditorFile(null);
    }
  };

  const getProofNotice = () => {
    const productForm = getProductForm();
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

  const ensureCropUi = () => {
    let cropRoot = root.querySelector("[data-cf-tumbler-crop-inline]");
    if (cropRoot) return cropRoot;

    cropRoot = document.createElement("div");
    cropRoot.setAttribute("data-cf-tumbler-crop-inline", "1");
    cropRoot.hidden = true;
    cropRoot.style.display = "none";
    cropRoot.style.position = "fixed";
    cropRoot.style.inset = "0";
    cropRoot.style.zIndex = "9999";
    cropRoot.style.boxSizing = "border-box";
    cropRoot.style.pointerEvents = "none";
    cropRoot.innerHTML = `
      <div class="cf-tumbler-crop-dialog" data-cf-tumbler-crop-dialog="1" role="dialog" aria-modal="true" aria-label="Crop uploaded image"></div>
      <div class="cf-tumbler-crop-panel" data-cf-tumbler-crop-panel="1">
        <div class="cf-tumbler-crop-stage" data-cf-tumbler-crop-stage="1">
          <canvas class="cf-tumbler-crop-stage__img" data-cf-tumbler-crop-canvas="1" hidden aria-hidden="true"></canvas>
          <div class="cf-tumbler-crop-box" data-cf-tumbler-crop-box="1" hidden>
            <div class="cf-tumbler-crop-box__drag" data-cf-tumbler-crop-drag="1" aria-hidden="true"></div>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="n" aria-label="Resize crop area from top"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="s" aria-label="Resize crop area from bottom"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="e" aria-label="Resize crop area from right"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="w" aria-label="Resize crop area from left"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="nw" aria-label="Resize crop area from top left"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="ne" aria-label="Resize crop area from top right"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="sw" aria-label="Resize crop area from bottom left"></button>
            <button type="button" class="cf-tumbler-crop-box__handle" data-cf-crop-handle="se" aria-label="Resize crop area from bottom right"></button>
          </div>
          <div class="cf-tumbler-crop-stage__placeholder" data-cf-tumbler-crop-placeholder="1">
            Crop preview will appear here.
          </div>
        </div>
      </div>
    `;
    root.appendChild(cropRoot);
    cropRoot.style.display = "none";

    const backdrop = cropRoot.querySelector("[data-cf-tumbler-crop-dialog='1']");
    const cropPanel = cropRoot.querySelector("[data-cf-tumbler-crop-panel='1']");
    const cropStage = cropRoot.querySelector("[data-cf-tumbler-crop-stage='1']");
    const cropCanvas = cropRoot.querySelector("[data-cf-tumbler-crop-canvas='1']");
    const cropBox = cropRoot.querySelector("[data-cf-tumbler-crop-box='1']");
    const cropDrag = cropRoot.querySelector("[data-cf-tumbler-crop-drag='1']");
    const cropHandles = Array.from(cropRoot.querySelectorAll("[data-cf-crop-handle]"));
    const placeholder = cropRoot.querySelector("[data-cf-tumbler-crop-placeholder='1']");

    if (backdrop) {
      backdrop.style.display = "none";
    }
    if (cropPanel) {
      cropPanel.style.position = "fixed";
      cropPanel.style.background = "transparent";
      cropPanel.style.borderRadius = "0";
      cropPanel.style.boxShadow = "none";
      cropPanel.style.overflow = "hidden";
      cropPanel.style.pointerEvents = "auto";
    }

    if (cropStage) {
      cropStage.style.position = "absolute";
      cropStage.style.inset = "0";
      cropStage.style.overflow = "hidden";
      cropStage.style.touchAction = "none";
      cropStage.style.background = "transparent";
    }
    if (cropCanvas) {
      cropCanvas.style.position = "absolute";
      cropCanvas.style.display = "none";
      cropCanvas.style.pointerEvents = "none";
      cropCanvas.style.left = "0";
      cropCanvas.style.top = "0";
    }
    if (cropBox) {
      cropBox.style.position = "absolute";
      cropBox.style.touchAction = "none";
      cropBox.style.boxSizing = "border-box";
      cropBox.style.pointerEvents = "auto";
    }
    if (cropDrag) {
      cropDrag.style.position = "absolute";
      cropDrag.style.inset = "0";
      cropDrag.style.cursor = "move";
      cropDrag.style.touchAction = "none";
    }
    cropHandles.forEach((handleEl) => {
      handleEl.style.position = "absolute";
      handleEl.style.touchAction = "none";
    });
    const handleMap = {
      nw: { top: "-11px", left: "-11px", cursor: "nwse-resize" },
      ne: { top: "-11px", right: "-11px", cursor: "nesw-resize" },
      sw: { bottom: "-11px", left: "-11px", cursor: "nesw-resize" },
      se: { bottom: "-11px", right: "-11px", cursor: "nwse-resize" },
      n: { top: "-11px", left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
      s: { bottom: "-11px", left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
      e: { right: "-11px", top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
      w: { left: "-11px", top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" }
    };
    cropHandles.forEach((handleEl) => {
      const cfg = handleMap[handleEl.getAttribute("data-cf-crop-handle")] || {};
      Object.keys(cfg).forEach((key) => {
        handleEl.style[key] = cfg[key];
      });
    });
    if (placeholder) {
      placeholder.style.position = "absolute";
      placeholder.style.inset = "0";
      placeholder.style.display = "grid";
      placeholder.style.placeItems = "center";
      placeholder.style.padding = "20px";
      placeholder.style.textAlign = "center";
      placeholder.style.color = "rgba(15,23,42,0.56)";
      placeholder.style.fontSize = "1.3rem";
      placeholder.style.background = "rgba(255,255,255,0.78)";
    }

    if (cropBox) {
      let activeTouchId = null;
      let activePointerId = null;

      const startInteraction = (clientX, clientY, handle, pointerId) => {
        if (!cropState.isOpen) return;
        cropState.pointerMode = handle ? "resize" : "drag-crop";
        cropState.pointerId = pointerId != null ? pointerId : null;
        cropState.pointerStart = {
          x: clientX,
          y: clientY,
          handle: handle || "",
          cropRect: { ...cropState.cropRect }
        };
      };

      const updateInteraction = (clientX, clientY) => {
        if (!cropState.pointerMode || !cropState.pointerStart) return;
        const image = cropState.image;
        const cropRect = cropState.cropRect;
        if (!image.w || !image.h || !cropRect.w || !cropRect.h) return;

        const dx = clientX - cropState.pointerStart.x;
        const dy = clientY - cropState.pointerStart.y;
        const startRect = cropState.pointerStart.cropRect;
        let nextRect = { ...startRect };

        if (cropState.pointerMode === "drag-crop") {
          nextRect.x = startRect.x + dx;
          nextRect.y = startRect.y + dy;
        } else {
          const handle = cropState.pointerStart.handle || "";
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

          nextLeft = clamp(nextLeft, image.x, startRight - CROP_MIN_SIZE);
          nextRight = clamp(nextRight, nextLeft + CROP_MIN_SIZE, image.x + image.w);
          nextTop = clamp(nextTop, image.y, startBottom - CROP_MIN_SIZE);
          nextBottom = clamp(nextBottom, nextTop + CROP_MIN_SIZE, image.y + image.h);

          nextRect = {
            x: nextLeft,
            y: nextTop,
            w: nextRight - nextLeft,
            h: nextBottom - nextTop
          };
        }

        cropState.cropRect = clampCropRectToImage(nextRect);
        syncCropBoxUi();
      };

      const endInteraction = () => {
        cropState.pointerMode = null;
        cropState.pointerId = null;
        cropState.pointerStart = null;
      };

      const detachWindowPointerListeners = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove);
        window.removeEventListener("pointerup", handleWindowPointerEnd);
        window.removeEventListener("pointercancel", handleWindowPointerEnd);
      };

      const detachWindowTouchListeners = () => {
        window.removeEventListener("touchmove", handleWindowTouchMove);
        window.removeEventListener("touchend", handleWindowTouchEnd);
        window.removeEventListener("touchcancel", handleWindowTouchEnd);
      };

      const handleWindowPointerMove = (e) => {
        if (!cropState.isOpen || activePointerId == null) return;
        if (e.pointerId !== activePointerId) return;
        updateInteraction(e.clientX, e.clientY);
        e.preventDefault();
      };

      const handleWindowPointerEnd = (e) => {
        if (activePointerId == null) return;
        if (e.pointerId !== activePointerId) return;
        activePointerId = null;
        endInteraction();
        detachWindowPointerListeners();
      };

      const findTouchById = (touchList, identifier) => {
        if (!touchList || identifier == null) return null;
        for (let i = 0; i < touchList.length; i += 1) {
          if (touchList[i] && touchList[i].identifier === identifier) return touchList[i];
        }
        return null;
      };

      const handleWindowTouchMove = (e) => {
        if (!cropState.isOpen || activeTouchId == null) return;
        const touch = findTouchById(e.touches, activeTouchId);
        if (!touch) return;
        updateInteraction(touch.clientX, touch.clientY);
        e.preventDefault();
      };

      const handleWindowTouchEnd = (e) => {
        if (activeTouchId == null) return;
        const activeTouch = findTouchById(e.touches, activeTouchId);
        if (activeTouch) return;
        activeTouchId = null;
        endInteraction();
        detachWindowTouchListeners();
      };

      const zoomCropImage = (delta) => {
        const image = cropState.image;
        const cropRect = cropState.cropRect;
        if (!image.w || !image.h || !cropRect.w || !cropRect.h) return;

        const step = delta > 0 ? 0.92 : 1.08;
        const centerX = cropRect.x + cropRect.w / 2;
        const centerY = cropRect.y + cropRect.h / 2;
        let nextW = Math.round(cropRect.w * step);
        let nextH = Math.round(cropRect.h * step);

        nextW = clamp(nextW, CROP_MIN_SIZE, image.w);
        nextH = clamp(nextH, CROP_MIN_SIZE, image.h);

        cropState.cropRect = clampCropRectToImage({
          x: Math.round(centerX - nextW / 2),
          y: Math.round(centerY - nextH / 2),
          w: nextW,
          h: nextH
        });
        syncCropBoxUi();
      };

      const beginPointerCrop = (e, handle) => {
        if (!cropState.isOpen || cropApplyInFlight) return;
        activePointerId = e.pointerId;
        startInteraction(e.clientX, e.clientY, handle || "", e.pointerId);
        detachWindowPointerListeners();
        window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
        window.addEventListener("pointerup", handleWindowPointerEnd, { passive: false });
        window.addEventListener("pointercancel", handleWindowPointerEnd, { passive: false });
        if (cropBox.setPointerCapture) {
          try { cropBox.setPointerCapture(e.pointerId); } catch (err) {}
        }
        e.preventDefault();
        e.stopPropagation();
      };

      const beginTouchCrop = (e, handle) => {
        if (!cropState.isOpen || cropApplyInFlight) return;
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        activeTouchId = touch.identifier;
        startInteraction(touch.clientX, touch.clientY, handle || "", touch.identifier);
        detachWindowTouchListeners();
        window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
        window.addEventListener("touchend", handleWindowTouchEnd, { passive: false });
        window.addEventListener("touchcancel", handleWindowTouchEnd, { passive: false });
        e.preventDefault();
        e.stopPropagation();
      };

      if (cropBox) {
        const beginBoxDrag = (e) => {
          if (e.target && e.target.closest && e.target.closest("[data-cf-crop-handle]")) return;
          beginPointerCrop(e, "");
        };
        const beginBoxTouchDrag = (e) => {
          if (e.target && e.target.closest && e.target.closest("[data-cf-crop-handle]")) return;
          beginTouchCrop(e, "");
        };
        cropBox.addEventListener("pointerdown", beginBoxDrag);
        cropBox.addEventListener("touchstart", beginBoxTouchDrag, { passive: false });
      }
      if (cropDrag) {
        cropDrag.addEventListener("pointerdown", (e) => beginPointerCrop(e, ""));
        cropDrag.addEventListener("touchstart", (e) => beginTouchCrop(e, ""), { passive: false });
      }
      cropHandles.forEach((handleEl) => {
        const handle = handleEl.getAttribute("data-cf-crop-handle") || "";
        handleEl.addEventListener("pointerdown", (e) => beginPointerCrop(e, handle));
        handleEl.addEventListener("touchstart", (e) => beginTouchCrop(e, handle), { passive: false });
      });

    }

    if (backdrop) {
      backdrop.addEventListener("click", () => {
        if (cropApplyInFlight) return;
        closeCropModal();
      });
    }

    if (cropStage) {
      cropStage.addEventListener(
        "wheel",
        (e) => {
          if (!cropState.isOpen) return;
          e.preventDefault();
          zoomCropImage(Math.sign(e.deltaY));
        },
        { passive: false }
      );
    }

    return cropRoot;
  };

  const getCropUiElements = () => {
    const rootEl = root.querySelector("[data-cf-tumbler-crop-inline='1']");
    return {
      root: rootEl,
      panel: rootEl ? rootEl.querySelector("[data-cf-tumbler-crop-panel='1']") : null,
      stage: rootEl ? rootEl.querySelector("[data-cf-tumbler-crop-stage='1']") : null,
      canvas: rootEl ? rootEl.querySelector("[data-cf-tumbler-crop-canvas='1']") : null,
      box: rootEl ? rootEl.querySelector("[data-cf-tumbler-crop-box='1']") : null,
      placeholder: rootEl ? rootEl.querySelector("[data-cf-tumbler-crop-placeholder='1']") : null
    };
  };

  const syncCropOverlayPanelPosition = () => {
    const { panel } = getCropUiElements();
    if (!panel) return;
    const rect = stage.getBoundingClientRect();
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.top = `${Math.round(rect.top)}px`;
    panel.style.width = `${Math.round(rect.width)}px`;
    panel.style.height = `${Math.round(rect.height)}px`;
  };

  const getCurrentEditorCropImageRect = (cropStageRect) => {
    if (!cropStageRect || !cropState.naturalWidth || !cropState.naturalHeight) return null;

    const stageBounds = stage.getBoundingClientRect();
    if (!(stageBounds.width > 1) || !(stageBounds.height > 1)) return null;

    let visibleBounds = null;
    if (!designWrap.hidden) {
      const wrapBounds = designWrap.getBoundingClientRect();
      if (wrapBounds.width > 1 && wrapBounds.height > 1) {
        visibleBounds = {
          x: wrapBounds.left - stageBounds.left,
          y: wrapBounds.top - stageBounds.top,
          w: wrapBounds.width,
          h: wrapBounds.height
        };
      }
    }

    if (!visibleBounds && state.placement) {
      visibleBounds = {
        x: state.placement.x * cropStageRect.width,
        y: state.placement.y * cropStageRect.height,
        w: state.placement.w * cropStageRect.width,
        h: state.placement.h * cropStageRect.height
      };
    }

    if (!visibleBounds || !(visibleBounds.w > 1) || !(visibleBounds.h > 1)) return null;

    const containScale = Math.min(
      visibleBounds.w / cropState.naturalWidth,
      visibleBounds.h / cropState.naturalHeight
    );
    const scale = Math.max(0.01, containScale);
    const imageW = Math.max(1, Math.round(cropState.naturalWidth * scale));
    const imageH = Math.max(1, Math.round(cropState.naturalHeight * scale));
    const imageX = Math.round(visibleBounds.x + (visibleBounds.w - imageW) / 2);
    const imageY = Math.round(visibleBounds.y + (visibleBounds.h - imageH) / 2);

    return {
      x: imageX,
      y: imageY,
      w: imageW,
      h: imageH,
      scale
    };
  };

  const clampCropRectToImage = (rect) => {
    const image = cropState.image;
    if (!image.w || !image.h) return { x: 0, y: 0, w: 0, h: 0 };

    let nextW = clamp(rect.w, CROP_MIN_SIZE, image.w);
    let nextH = clamp(rect.h, CROP_MIN_SIZE, image.h);
    let nextX = clamp(rect.x, image.x, image.x + image.w - nextW);
    let nextY = clamp(rect.y, image.y, image.y + image.h - nextH);

    nextW = Math.min(nextW, image.x + image.w - nextX);
    nextH = Math.min(nextH, image.y + image.h - nextY);

    return {
      x: Math.round(nextX),
      y: Math.round(nextY),
      w: Math.round(nextW),
      h: Math.round(nextH)
    };
  };

  const initCropRect = () => {
    syncCropOverlayPanelPosition();
    const { stage: cropStage } = getCropUiElements();
    if (!cropStage) return;
    const cropStageRect = cropStage.getBoundingClientRect();
    if (!cropStageRect.width || !cropStageRect.height || !cropState.naturalWidth || !cropState.naturalHeight) return;

    const currentVisibleRect = getCurrentEditorCropImageRect(cropStageRect);
    const containScale = Math.min(
      cropStageRect.width / cropState.naturalWidth,
      cropStageRect.height / cropState.naturalHeight
    );
    const safeScale = currentVisibleRect ? currentVisibleRect.scale : Math.max(0.01, containScale);
    const imageW = currentVisibleRect ? currentVisibleRect.w : Math.max(1, Math.round(cropState.naturalWidth * safeScale));
    const imageH = currentVisibleRect ? currentVisibleRect.h : Math.max(1, Math.round(cropState.naturalHeight * safeScale));
    const imageX = currentVisibleRect ? currentVisibleRect.x : Math.round((cropStageRect.width - imageW) / 2);
    const imageY = currentVisibleRect ? currentVisibleRect.y : Math.round((cropStageRect.height - imageH) / 2);
    const existingCrop = cropSourceState.crop;

    let cropW = Math.max(CROP_MIN_SIZE, Math.round(imageW * 0.72));
    let cropH = Math.max(CROP_MIN_SIZE, Math.round(imageH * 0.72));
    let cropX = Math.round(imageX + (imageW - cropW) / 2);
    let cropY = Math.round(imageY + (imageH - cropH) / 2);
    const isExistingCropForCurrentImage =
      !!(
        existingCrop &&
        existingCrop.w > 0 &&
        existingCrop.h > 0 &&
        existingCrop.naturalWidth === Math.round(cropState.naturalWidth || 0) &&
        existingCrop.naturalHeight === Math.round(cropState.naturalHeight || 0)
      );

    if (isExistingCropForCurrentImage) {
      cropX = Math.round(imageX + existingCrop.x * safeScale);
      cropY = Math.round(imageY + existingCrop.y * safeScale);
      cropW = Math.max(CROP_MIN_SIZE, Math.round(existingCrop.w * safeScale));
      cropH = Math.max(CROP_MIN_SIZE, Math.round(existingCrop.h * safeScale));
    }

    cropState.stage = { x: 0, y: 0, w: cropStageRect.width, h: cropStageRect.height };
    cropState.image = {
      x: imageX,
      y: imageY,
      w: imageW,
      h: imageH,
      scale: safeScale
    };
    cropState.cropRect = clampCropRectToImage({
      x: cropX,
      y: cropY,
      w: cropW,
      h: cropH
    });
  };

  const renderCropStageCanvas = () => {
    const { canvas } = getCropUiElements();
    const sourceImage = cropState.loadedImage;
    if (!canvas || !sourceImage || !cropState.image.w || !cropState.image.h) return;

    const dpr = window.devicePixelRatio || 1;
    const drawW = Math.max(1, Math.round(cropState.image.w));
    const drawH = Math.max(1, Math.round(cropState.image.h));
    const canvasW = Math.max(1, Math.round(drawW * dpr));
    const canvasH = Math.max(1, Math.round(drawH * dpr));
    if (canvas.width !== canvasW) canvas.width = canvasW;
    if (canvas.height !== canvasH) canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawW, drawH);
    ctx.drawImage(sourceImage, 0, 0, drawW, drawH);
    canvas.hidden = false;
    canvas.style.display = "block";
    canvas.style.left = `${cropState.image.x}px`;
    canvas.style.top = `${cropState.image.y}px`;
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${drawH}px`;
  };

  const syncCropBoxUi = () => {
    const { box: cropBox, canvas } = getCropUiElements();
    if (!cropBox || !canvas || !cropState.cropRect.w || !cropState.image.w) return;

    cropState.cropRect = clampCropRectToImage(cropState.cropRect);
    renderCropStageCanvas();
    cropBox.hidden = false;
    cropBox.style.display = "block";
    cropBox.style.left = `${cropState.cropRect.x}px`;
    cropBox.style.top = `${cropState.cropRect.y}px`;
    cropBox.style.width = `${cropState.cropRect.w}px`;
    cropBox.style.height = `${cropState.cropRect.h}px`;
    cropBox.classList.toggle("is-compact", cropState.cropRect.w <= 84 || cropState.cropRect.h <= 84);
  };

  const closeCropModal = () => {
    const { root: cropRoot, panel, canvas, box: cropBox, placeholder } = getCropUiElements();
    cropApplyInFlight = false;
    setCropEditorIsolation(false);
    resetMainEditorInteraction();
    if (canvas) {
      canvas.hidden = true;
      canvas.style.display = "none";
      canvas.style.left = "";
      canvas.style.top = "";
      canvas.style.width = "";
      canvas.style.height = "";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (cropBox) {
      cropBox.hidden = true;
      cropBox.style.display = "none";
      cropBox.style.left = "";
      cropBox.style.top = "";
      cropBox.style.width = "";
      cropBox.style.height = "";
    }
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.style.display = "grid";
      placeholder.textContent = "Crop preview will appear here.";
    }
    if (cropRoot) {
      cropRoot.hidden = true;
      cropRoot.style.display = "none";
    }
    if (panel) {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.width = "";
      panel.style.height = "";
    }
    root.classList.remove("bd-crop-open");
    resetCropState();
    syncCropActionButtons();
    updateStatusAndMeta();
  };

  const openCropModal = (file) => {
    if (!file || !canCropFile(file)) return;
    const cropRoot = ensureCropUi();
    const { canvas, placeholder, box: cropBox } = getCropUiElements();
    cropApplyInFlight = false;
    resetCropState();
    resetMainEditorInteraction();
    cropState.isOpen = true;
    cropState.file = file;
    cropState.objectUrl = URL.createObjectURL(file);
    root.classList.add("bd-crop-open");
    setCropEditorIsolation(true);
    if (cropRoot) {
      cropRoot.hidden = false;
      cropRoot.style.display = "block";
    }
    syncCropOverlayPanelPosition();
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.style.display = "grid";
      placeholder.textContent = "Loading crop preview...";
    }
    if (cropBox) {
      cropBox.hidden = true;
      cropBox.style.display = "none";
    }
    if (canvas) {
      canvas.hidden = true;
      canvas.style.display = "none";
      canvas.style.left = "";
      canvas.style.top = "";
      canvas.style.width = "";
      canvas.style.height = "";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (statusEl) {
      statusEl.textContent = "Adjust the crop, then apply it.";
    }
    syncCropActionButtons();
    const probeImage = new Image();
    probeImage.onload = () => {
      if (!cropState.isOpen || cropState.objectUrl !== probeImage.src) return;
      cropState.loadedImage = probeImage;
      cropState.naturalWidth = probeImage.naturalWidth || 0;
      cropState.naturalHeight = probeImage.naturalHeight || 0;
      initCropRect();
      syncCropBoxUi();
      if (placeholder) placeholder.style.display = "none";
    };
    probeImage.onerror = () => {
      cropApplyInFlight = false;
      if (statusEl) statusEl.textContent = "We couldn't load that image for cropping. Please try again.";
      closeCropModal();
    };
    probeImage.src = cropState.objectUrl;
  };

  const getCropExportSpec = () => {
    const file = cropState.file;
    const cropRect = cropState.cropRect;
    const image = cropState.image;
    if (!file || !cropRect.w || !cropRect.h || !image.w || !image.h) return null;

    const scaleX = cropState.naturalWidth / image.w;
    const scaleY = cropState.naturalHeight / image.h;
    const srcX = Math.max(0, Math.round((cropRect.x - image.x) * scaleX));
    const srcY = Math.max(0, Math.round((cropRect.y - image.y) * scaleY));
    const srcW = Math.min(cropState.naturalWidth - srcX, Math.max(1, Math.round(cropRect.w * scaleX)));
    const srcH = Math.min(cropState.naturalHeight - srcY, Math.max(1, Math.round(cropRect.h * scaleY)));

    return {
      srcX,
      srcY,
      srcW,
      srcH,
      cropMeta: {
        x: srcX,
        y: srcY,
        w: srcW,
        h: srcH,
        naturalWidth: Math.round(cropState.naturalWidth || 0),
        naturalHeight: Math.round(cropState.naturalHeight || 0)
      }
    };
  };

  const exportCroppedFile = async () => {
    const file = cropState.file;
    const spec = getCropExportSpec();
    const sourceImage = cropState.loadedImage;
    if (!file || !sourceImage || !spec) throw new Error("Missing crop export state");

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = spec.srcW;
    cropCanvas.height = spec.srcH;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) throw new Error("Missing crop canvas context");
    ctx.drawImage(sourceImage, spec.srcX, spec.srcY, spec.srcW, spec.srcH, 0, 0, spec.srcW, spec.srcH);

    const blob = await canvasToBlob(cropCanvas);
    const baseName = String(file.name || "design").replace(/\.[^.]+$/, "");
    return {
      file: new File([blob], `${baseName}-cropped.png`, {
        type: "image/png",
        lastModified: Date.now()
      }),
      cropMeta: spec.cropMeta
    };
  };

  const pushFileIntoRealInput = (file, options = {}) => {
    if (!uploadInput || !file) return;
    const bypassProductState = Object.prototype.hasOwnProperty.call(options, "bypassProductState")
      ? !!options.bypassProductState
      : true;
    const preserveMasterOriginal = Object.prototype.hasOwnProperty.call(options, "preserveMasterOriginal")
      ? !!options.preserveMasterOriginal
      : true;
    const dt = new DataTransfer();
    dt.items.add(file);
    uploadInput.files = dt.files;
    uploadInput.__bdCropBypassCount = bypassProductState ? 1 : 0;
    uploadInput.__bdPreserveMasterOriginal = preserveMasterOriginal ? 1 : 0;
    uploadInput.dispatchEvent(new Event("change", { bubbles: true }));
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

  const getPlacementMaxWidth = () => {
    const configured = Number(config && config.editor && config.editor.maxWidth);
    return configured > 0 ? configured : Number.POSITIVE_INFINITY;
  };

  const getPlacementMaxHeight = () => {
    const configured = Number(config && config.editor && config.editor.maxHeight);
    return configured > 0 ? configured : Number.POSITIVE_INFINITY;
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
    const insetX = 0;
    const insetTop = 0;
    const insetBottom = 0;
    const availableWidth = Math.max(1, rect.width - insetX * 2);
    const availableHeight = Math.max(1, rect.height - insetTop - insetBottom);
    const scale = Math.min(availableWidth / groupWidth, availableHeight / groupHeight);
    const offsetX = insetX + (availableWidth - groupWidth * scale) / 2 - groupLeft * scale;
    const offsetY = insetTop + (availableHeight - groupHeight * scale) / 2 - groupTop * scale;

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

  const getNormalizedEditorBounds = () => {
    const rect = stageRect();
    if (!rect.width || !rect.height) return null;
    const zones = buildTopOverlayZones(rect);
    if (!zones.length) return null;
    const leftPx = Math.min.apply(null, zones.map((zone) => zone.leftPx));
    const topPx = Math.min.apply(null, zones.map((zone) => zone.topPx));
    const rightPx = Math.max.apply(null, zones.map((zone) => zone.leftPx + zone.widthPx));
    const bottomPx = Math.max.apply(null, zones.map((zone) => zone.topPx + zone.heightPx));
    const widthPx = Math.max(1, rightPx - leftPx);
    const heightPx = Math.max(1, bottomPx - topPx);
    return {
      x: leftPx / rect.width,
      y: topPx / rect.height,
      w: widthPx / rect.width,
      h: heightPx / rect.height
    };
  };

  const buildOverlayClipPath = (zones) => {
    if (!zones || !zones.length) return "";
    return zones
      .map((zone) => {
        const left = zone.leftPx;
        const right = zone.leftPx + zone.widthPx;
        const top = zone.topPx;
        const bottom = zone.topPx + zone.heightPx;
        const curveY = bottom - zone.curvePx;
        const centerX = zone.centerPx;
        return `M ${left} ${top} L ${right} ${top} L ${right} ${curveY} Q ${centerX} ${bottom} ${left} ${curveY} Z`;
      })
      .join(" ");
  };

  const applyStageSpec = () => {
    const overlayZones = buildTopOverlayZones(stageRect());
    const clipPath = buildOverlayClipPath(overlayZones);
    if (designViewport) {
      designViewport.style.clipPath = clipPath ? `path('${clipPath}')` : "";
      designViewport.style.webkitClipPath = clipPath ? `path('${clipPath}')` : "";
    }
    guideEls.forEach((guide, index) => {
      const key = guide.getAttribute("data-cf-guide");
      const zone = overlayZones.find((item) => item.key === key);
      if (!zone) {
        guide.hidden = true;
        return;
      }
      guide.hidden = false;
      guide.style.left = `${zone.leftPx}px`;
      guide.style.width = `${zone.widthPx}px`;
      guide.style.top = `${zone.topPx}px`;
      guide.style.height = `${zone.heightPx}px`;
      guide.style.border = "none";
      guide.style.background = "transparent";
      guide.style.setProperty("--cf-guide-color", String(zone.color || "rgba(71, 85, 105, 0.8)"));
      guide.style.setProperty("--cf-guide-fill", setRgbaAlpha(zone.color, 0.12));
      guide.style.setProperty("--cf-guide-border", setRgbaAlpha(zone.color, 0.82));
      guide.style.setProperty("--cf-guide-glow", setRgbaAlpha(zone.color, 0.14));
      guide.style.setProperty("--cf-guide-label-bg", setRgbaAlpha(zone.color, 0.14));
      guide.style.setProperty("--cf-guide-label-border", setRgbaAlpha(zone.color, 0.28));
      guide.style.setProperty("--cf-guide-curve", `${Math.max(18, Math.round(zone.curvePx || 0))}px`);
      guide.classList.toggle("is-guide-edge-left", index === 0);
      guide.classList.toggle("is-guide-edge-right", index === overlayZones.length - 1);
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

  const buildDefaultPlacement = (aspect) => {
    let width = 0.82;
    let height = getNormalizedHeightForWidth(width, aspect);
    if (height > 0.82) {
      height = 0.82;
      width = getNormalizedWidthForHeight(height, aspect);
    }
    if (width > 1) {
      width = 1;
      height = getNormalizedHeightForWidth(width, aspect);
    }
    if (height > 1) {
      height = 1;
      width = getNormalizedWidthForHeight(height, aspect);
    }
    return {
      x: (1 - width) / 2,
      y: (1 - height) / 2,
      w: width,
      h: height
    };
  };

  const ensurePlacement = () => {
    if (state.placement || !state.aspect) return;
    state.initialPlacement = buildDefaultPlacement(state.aspect);
    state.placement = { ...state.initialPlacement };
  };

  const normalizePlacement = () => {
    if (!state.placement || !state.aspect) return;
    const editorBounds = getNormalizedEditorBounds();
    const maxWidth = getPlacementMaxWidth();
    const maxHeight = getPlacementMaxHeight();
    state.placement.w = clamp(state.placement.w, 0.05, maxWidth);
    state.placement.h = getNormalizedHeightForWidth(state.placement.w, state.aspect);
    if (state.placement.h > maxHeight) {
      state.placement.h = maxHeight;
      state.placement.w = getNormalizedWidthForHeight(state.placement.h, state.aspect);
    }
    if (editorBounds) {
      const minX = Math.min(editorBounds.x, editorBounds.x + editorBounds.w - state.placement.w);
      const maxX = Math.max(editorBounds.x, editorBounds.x + editorBounds.w - state.placement.w);
      state.placement.x = clamp(state.placement.x, minX, maxX);
      const minY = state.placement.h > 1 ? -(state.placement.h - 1) : 0;
      const maxY = state.placement.h > 1 ? 0 : 1 - state.placement.h;
      state.placement.y = clamp(state.placement.y, minY, maxY);
      return;
    }
    state.placement.x = clamp(state.placement.x, 0, Math.max(0, 1 - state.placement.w));
    state.placement.y = clamp(
      state.placement.y,
      state.placement.h > 1 ? -(state.placement.h - 1) : 0,
      state.placement.h > 1 ? 0 : 1 - state.placement.h
    );
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
    designViewport.hidden = !state.src || !state.placement;
    if (resizeHandle) resizeHandle.hidden = !state.src || !state.placement;
    resetBtn.hidden = !state.src;
    if (!state.src || !state.placement) return;
    designEditImg.style.opacity = "1";
    designWrap.style.left = "0px";
    designWrap.style.top = "0px";
    designWrap.style.width = `${Math.round(state.placement.w * rect.width)}px`;
    designWrap.style.height = `${Math.round(state.placement.h * rect.height)}px`;
    const translateX = Math.round(state.placement.x * rect.width);
    const translateY = Math.round(state.placement.y * rect.height);
    const widthPx = Math.round(state.placement.w * rect.width);
    const heightPx = Math.round(state.placement.h * rect.height);
    designWrap.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    if (resizeHandle) {
      resizeHandle.style.transform = `translate3d(${translateX + widthPx - 11}px, ${translateY + heightPx - 11}px, 0)`;
    }
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
    const productForm = getProductForm();
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
    const productForm = getProductForm();
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
    const productForm = getProductForm();
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
      filename: `tumbler-proof-${Date.now()}.png`,
      folder
    }).then((result) => String((result && (result.secureUrl || result.url)) || "").trim());
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
    if (isCropPending()) return;
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
    if (isCropPending()) {
      statusEl.textContent = "Adjust the crop, then apply it.";
      metaEl.textContent = metaSource && metaSource.textContent
        ? metaSource.textContent
        : (state.width && state.height ? `Upload: ${state.width} x ${state.height}px - Aspect ratio ${state.aspect.toFixed(2)}` : "");
      syncThumbnailLockState();
      return;
    }
    if (!state.src) {
      const hiddenStatus = statusSource ? String(statusSource.textContent || "").trim() : "";
      statusEl.textContent = hiddenStatus;
      metaEl.textContent = metaSource && metaSource.textContent ? metaSource.textContent : "";
      syncThumbnailLockState();
      return;
    }

    const originalWidth = state.width;
    const originalHeight = state.height;
    const aspect = state.aspect || 1;
    const hiddenStatus = statusSource ? String(statusSource.textContent || "").trim() : "";
    const proofInput = ensureProofInput();
    const proofReady = !!(proofInput && proofInput.value.trim());
    const proofNotice = getProofNotice();
    statusEl.textContent = isLargeUploadMessage(hiddenStatus)
      ? hiddenStatus
      : proofReady
        ? "If the upload and preview look correct, add to cart."
        : proofNotice || "If the upload and preview look correct, add to cart.";
    metaEl.textContent = metaSource && metaSource.textContent
      ? metaSource.textContent
      : `Upload: ${originalWidth} x ${originalHeight}px - Aspect ratio ${aspect.toFixed(2)}`;
    syncThumbnailLockState();
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
    scheduleDraftPersist();
  };

  const scheduleRender = () => {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      renderAllNow();
    }, 30);
  };

  const resetPlacement = () => {
    if (!state.initialPlacement && state.aspect) {
      state.initialPlacement = buildDefaultPlacement(state.aspect);
    }
    if (!state.initialPlacement) return;
    state.placement = { ...state.initialPlacement };
    scheduleRender();
  };

  const syncFromUploader = (options) => {
    const useDraftSnapshot = !!(options && options.useDraftSnapshot);
    const snapshot = useDraftSnapshot ? readDraftSessionSnapshot() : null;
    const durableSrc = getDurableDesignUrl(snapshot && snapshot.designUrl);
    const transientPreviewSrc = String(
      (previewImg && (previewImg.currentSrc || previewImg.getAttribute("src") || previewImg.src)) ||
      ""
    ).trim();
    const uploadedSrc = String(durableSrc || transientPreviewSrc || "").trim();
    const workingSrc = shouldPreferWorkingRenderSrc()
      ? String(cropSourceState.currentObjectUrl || "").trim()
      : "";
    const src = String(workingSrc || uploadedSrc).trim();
    if (!src) {
      state.src = "";
      state.placement = null;
      state.initialPlacement = null;
      proofLastKey = "";
      proofLastUrl = "";
      setProofUrl("");
      cropSourceState.ownerOriginalUrl = "";
      setOriginalSvgUrl("");
      designEditImg.removeAttribute("src");
      clearDraftSessionSnapshot();
      syncCropActionButtons();
      scheduleRender();
      return;
    }

    const shouldKeepDesignerOpen =
      !!(
        (snapshot && snapshot.isOpen) ||
        root.classList.contains("is-design-open") ||
        (body && !body.hidden)
      );
    if (shouldKeepDesignerOpen) {
      setBodyOpen();
    }
    if (designUrlInput && isBlobDesignSrc(designUrlInput.value)) {
      designUrlInput.value = durableSrc || "";
    }
    if (cropSourceState.ownerOriginalFile && isSvgFile(cropSourceState.ownerOriginalFile)) {
      if (!cropSourceState.ownerOriginalUrl && durableSrc) {
        cropSourceState.ownerOriginalUrl = durableSrc;
      }
      setOriginalSvgUrl(cropSourceState.ownerOriginalUrl);
    } else {
      cropSourceState.ownerOriginalUrl = "";
      setOriginalSvgUrl("");
    }
    if (state.src === src && state.placement) {
      rehydrateProofStateFromInputs();
      if (!cropSourceState.currentFile) {
        window.setTimeout(() => {
          ensureDraftCropSourceFile(snapshot).then((restored) => {
            if (!restored && isRemoteDesignSrc(durableSrc)) {
              ensureRemoteCropSourceFile(durableSrc, { promoteOriginal: !cropSourceState.originalFile });
            }
          });
        }, 0);
      }
      syncCropActionButtons();
      scheduleRender();
      return;
    }

    if (designUrlInput && !String(designUrlInput.value || "").trim() && durableSrc) {
      designUrlInput.value = durableSrc;
    }

    state.src = src;
    loadDesignEditImage(src, () => {
      state.width = designEditImg.naturalWidth || 0;
      state.height = designEditImg.naturalHeight || 0;
      state.aspect = state.height ? state.width / state.height : 1;
      if (snapshot && snapshot.designUrl === src && snapshot.placement) {
        state.initialPlacement = snapshot.initialPlacement ? { ...snapshot.initialPlacement } : null;
        state.placement = { ...snapshot.placement };
      } else {
        state.placement = null;
        state.initialPlacement = null;
      }
      rehydrateProofStateFromInputs();
      if (!cropSourceState.currentFile) {
        window.setTimeout(() => {
          ensureDraftCropSourceFile(snapshot).then((restored) => {
            if (!restored && isRemoteDesignSrc(durableSrc)) {
              ensureRemoteCropSourceFile(durableSrc, { promoteOriginal: !cropSourceState.originalFile });
            }
          });
        }, 0);
      }
      syncCropActionButtons();
      scheduleRender();
    });
  };

  const beginInteraction = (mode, e) => {
    if (!state.src || !state.placement || pointerMode || isCropPending()) return;
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
      nextW = clamp(nextW, 0.05, getPlacementMaxWidth());
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
      setBodyOpen();
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
      if (isCropPending()) return;
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

  if (cropBtn) {
    cropBtn.addEventListener("click", async () => {
      let file = cropSourceState.currentFile;
      if (!file || !canCropFile(file)) {
        const durableSrc = getDurableDesignUrl(state.src);
        file = await ensureDraftCropSourceFile(null);
        if (!file) {
          file = await ensureRemoteCropSourceFile(durableSrc, { promoteOriginal: !cropSourceState.originalFile });
        }
      }
      if (!file || !canCropFile(file)) {
        if (statusEl) statusEl.textContent = "We couldn't reopen that image for cropping. Please upload it again to crop it.";
        return;
      }
      openCropModal(file);
    });
  }

  if (cropCancelBtn) {
    cropCancelBtn.addEventListener("click", () => {
      closeCropModal();
    });
  }

  if (cropOriginalBtn) {
    cropOriginalBtn.addEventListener("click", () => {
      const file = cropSourceState.originalFile;
      if (!file) return;
      setEditorCropMeta(null);
      setCurrentEditorFile(file);
      closeCropModal();
      pushFileIntoRealInput(file);
    });
  }

  if (loadOriginalBtn) {
    loadOriginalBtn.addEventListener("click", async () => {
      if (cropApplyInFlight) return;
      const file = await readMasterOriginalFile();
      if (!file) {
        if (statusEl) {
          statusEl.textContent = "Original image is not available on this device anymore. Please upload it again to restore it.";
        }
        return;
      }
      setEditorCropMeta(null);
      pushFileIntoRealInput(file, {
        bypassProductState: false,
        preserveMasterOriginal: true
      });
    });
  }

  if (cropApplyBtn) {
    cropApplyBtn.addEventListener("click", async () => {
      const file = cropState.file;
      if (!file || !canCropFile(file) || cropApplyInFlight) return;
      cropApplyInFlight = true;
      if (statusEl) statusEl.textContent = "Applying crop...";
      syncCropActionButtons();
      try {
        const cropResult = await exportCroppedFile();
        if (cropResult && cropResult.file) {
          const previousUrl = designUrlInput ? String(designUrlInput.value || "").trim() : "";
          setEditorCropMeta(cropResult.cropMeta || null);
          setCurrentEditorFile(cropResult.file);
          pushFileIntoRealInput(cropResult.file);
          await waitForNextDesignUrlChange(previousUrl, 4000);
          syncFromUploader();
        }
        closeCropModal();
      } catch (err) {
        cropApplyInFlight = false;
        syncCropActionButtons();
        console.error("Tumbler crop export failed", err);
        if (statusEl) statusEl.textContent = "We couldn't apply that crop. Please try again.";
      }
    });
  }

  uploadInput.addEventListener("change", () => {
    if ((uploadInput.__bdCropBypassCount || 0) > 0) {
      uploadInput.__bdCropBypassCount -= 1;
      const bypassFile = uploadInput.files && uploadInput.files[0] ? uploadInput.files[0] : null;
      if (bypassFile) setCurrentEditorFile(bypassFile);
      syncCropActionButtons();
      window.setTimeout(syncFromUploader, 0);
    } else {
      const file = uploadInput.files && uploadInput.files[0] ? uploadInput.files[0] : null;
      Promise.resolve(prepareInitialEditorFile(file))
        .then(() => {
          syncCropActionButtons();
          window.setTimeout(syncFromUploader, 0);
        })
        .catch(() => {
          syncCropActionButtons();
          window.setTimeout(syncFromUploader, 0);
        });
    }
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
    if (cropState.isOpen) {
      syncCropOverlayPanelPosition();
      initCropRect();
      syncCropBoxUi();
    }
    scheduleRender();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!cropState.isOpen) return;
      syncCropOverlayPanelPosition();
    },
    { passive: true }
  );

  window.addEventListener("pageshow", (event) => {
    closeTransientCartUi();
    mountSharedUploadNotice();
    applyStageSpec();
    syncThumbnailLockState();
    if (!shouldAttemptDraftRestore({ persisted: !!(event && event.persisted) })) return;
    window.setTimeout(() => syncFromUploader({ useDraftSnapshot: true }), 0);
    window.setTimeout(() => syncFromUploader({ useDraftSnapshot: true }), 120);
    window.setTimeout(() => syncFromUploader({ useDraftSnapshot: true }), 260);
  });

  window.addEventListener("pagehide", () => {
    persistDraftSessionNow();
  });

  const submitScope = productInfo || document;
  if (submitScope) {
    submitScope.addEventListener(
      "submit",
      async (e) => {
        const activeForm = getProductForm();
        if (!activeForm) return;
        if (!(e.target instanceof HTMLFormElement) || e.target !== activeForm) return;
        if (allowNextSubmit) {
          allowNextSubmit = false;
          return;
        }
        if (!state.src) return;
        if (isCropPending()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (statusEl) {
            statusEl.textContent = "Apply or cancel crop before adding to cart.";
          }
          return;
        }

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

          e.preventDefault();
          e.stopImmediatePropagation();

          if (proofInFlightPromise) {
            if (statusEl) {
              statusEl.textContent = "Finishing your tumbler preview before adding to cart...";
            }
          } else if (statusEl) {
            statusEl.textContent = "Preparing your tumbler proof image before adding to cart...";
          }

          const syncedUrl = proofInFlightPromise
            ? await waitForCurrentProof(MOBILE_PROOF_WAIT_MS)
            : await syncProofNow({ force: true });

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
    syncCropActionButtons();
    syncThumbnailLockState();
    scheduleRender();
    if (shouldAttemptDraftRestore()) {
      syncFromUploader({ useDraftSnapshot: true });
    }
  });
})();
