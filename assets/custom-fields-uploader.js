(function () {
  const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];
  const SVG_ONLY_ALLOWED = ["image/svg+xml"];
  const MAX_MB = 10;
  const LARGE_UPLOAD_NOTICE_TEXT = "Your image is over 10MB. You can still preview your design-after ordering, email the original file to info@sarvsartsandcrafts.com and we'll handle the proof and printing.";

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function qsa(root, sel) {
    return Array.from(root.querySelectorAll(sel));
  }

  function setSlotFieldValues(root, attr, idx, value) {
    qsa(root, `[${attr}="${idx}"]`).forEach((el) => {
      el.value = value;
    });
  }

  function getSlotPrimaryField(root, attr, idx) {
    return root.querySelector(`[${attr}="${idx}"]`);
  }

  function getMasterOriginalUrl(root, idx) {
    return String(root.querySelector(`[data-master-url="${idx}"]`)?.value || "").trim();
  }

  const MASTER_ORIGINAL_DB = "bd-customizer-master-originals";
  const MASTER_ORIGINAL_STORE = "files";

  const openMasterOriginalDb = (() => {
    let dbPromise = null;
    return () => {
      if (dbPromise) return dbPromise;
      if (!window.indexedDB) return Promise.resolve(null);
      dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(MASTER_ORIGINAL_DB, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MASTER_ORIGINAL_STORE)) {
              db.createObjectStore(MASTER_ORIGINAL_STORE, { keyPath: "key" });
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

  async function withMasterOriginalStore(mode, runner) {
    const db = await openMasterOriginalDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(MASTER_ORIGINAL_STORE, mode);
        const store = tx.objectStore(MASTER_ORIGINAL_STORE);
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
  }

  function getMasterOriginalStorageScope(root) {
    const explicitScope = String(root?.dataset?.masterOriginalScope || "").trim();
    if (explicitScope) return explicitScope;
    const sectionScope = String(root?.closest?.(".shopify-section")?.id || "").trim();
    if (sectionScope) return `${window.location.pathname}:${sectionScope}`;
    return window.location.pathname;
  }

  function getMasterOriginalStorageKey(root, idx) {
    const slot = String(idx || "").trim() || "1";
    return `master-original:${getMasterOriginalStorageScope(root)}:${slot}`;
  }

  function getWorkingUploadStorageKey(root, idx) {
    const slot = String(idx || "").trim() || "1";
    return `working-upload:${getMasterOriginalStorageScope(root)}:${slot}`;
  }

  async function persistMasterOriginalUpload(root, idx, file, options = {}) {
    const key = getMasterOriginalStorageKey(root, idx);
    const overwrite = !!(options && options.overwrite);
    if (!key) return false;
    if (!file || !(file instanceof Blob)) {
      return withMasterOriginalStore("readwrite", (store, finish) => {
        const req = store.delete(key);
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
      }).then((result) => result === true);
    }
    if (!overwrite) {
      const existing = await withMasterOriginalStore("readonly", (store, finish) => {
        const req = store.get(key);
        req.onsuccess = () => finish(req.result || null);
        req.onerror = () => finish(null);
      });
      if (existing && existing.buffer) return true;
    }
    try {
      const buffer = await file.arrayBuffer();
      return withMasterOriginalStore("readwrite", (store, finish) => {
        const req = store.put({
          key,
          savedAt: Date.now(),
          name: String(file.name || `upload-${idx}.bin`),
          type: String(file.type || "application/octet-stream"),
          lastModified: Number(file.lastModified || Date.now()),
          buffer
        });
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
      }).then((result) => result === true);
    } catch (e) {
      return false;
    }
  }

  async function persistWorkingUpload(root, idx, file) {
    const key = getWorkingUploadStorageKey(root, idx);
    if (!key) return false;
    if (!file || !(file instanceof Blob)) {
      return withMasterOriginalStore("readwrite", (store, finish) => {
        const req = store.delete(key);
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
      }).then((result) => result === true);
    }
    try {
      const buffer = await file.arrayBuffer();
      return withMasterOriginalStore("readwrite", (store, finish) => {
        const req = store.put({
          key,
          savedAt: Date.now(),
          name: String(file.name || `upload-${idx}.bin`),
          type: String(file.type || "application/octet-stream"),
          lastModified: Number(file.lastModified || Date.now()),
          buffer
        });
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
      }).then((result) => result === true);
    } catch (e) {
      return false;
    }
  }

  function readMasterOriginalUpload(root, idx) {
    const key = getMasterOriginalStorageKey(root, idx);
    if (!key) return Promise.resolve(null);
    return withMasterOriginalStore("readonly", (store, finish) => {
      const req = store.get(key);
      req.onsuccess = () => finish(req.result || null);
      req.onerror = () => finish(null);
    }).then((record) => {
      if (!record || !record.buffer) return null;
      try {
        return new File(
          [record.buffer],
          String(record.name || `upload-${idx}.bin`),
          {
            type: String(record.type || "application/octet-stream"),
            lastModified: Number(record.lastModified || Date.now())
          }
        );
      } catch (e) {
        return null;
      }
    });
  }

  function readWorkingUpload(root, idx) {
    const key = getWorkingUploadStorageKey(root, idx);
    if (!key) return Promise.resolve(null);
    return withMasterOriginalStore("readonly", (store, finish) => {
      const req = store.get(key);
      req.onsuccess = () => finish(req.result || null);
      req.onerror = () => finish(null);
    }).then((record) => {
      if (!record || !record.buffer) return null;
      try {
        return new File(
          [record.buffer],
          String(record.name || `upload-${idx}.bin`),
          {
            type: String(record.type || "application/octet-stream"),
            lastModified: Number(record.lastModified || Date.now())
          }
        );
      } catch (e) {
        return null;
      }
    });
  }

  function setStatus(root, idx, msg, type) {
    const el = root.querySelector(`[data-status="${idx}"]`);
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.type = type || "";
  }

  function setGlobal(root, msg, type) {
    const el = qs(root, "[data-global-status]");
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.type = type || "";
  }

  function setProgress(root, idx, pct) {
    const wrap = root.querySelector(`[data-progress="${idx}"]`);
    const bar = wrap ? wrap.querySelector(".cf-uploader__bar") : null;
    if (!wrap || !bar) return;
    wrap.hidden = false;
    bar.style.width = `${pct}%`;
    if (pct >= 100) {
      setTimeout(() => {
        wrap.hidden = true;
        bar.style.width = "0%";
      }, 600);
    }
  }

  function getForm(root) {
    return root.closest('form[action^="/cart/add"]') || root.closest("form");
  }

  function ensureUploadNoticeInput(form) {
    if (!form) return null;
    let input = form.querySelector('#cf_upload_notice, #bd_upload_notice, [name="properties[_Upload Notice]"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_Upload Notice]";
      input.id = "cf_upload_notice";
      form.appendChild(input);
    }
    return input;
  }

  function setUploadNotice(form, message) {
    const input = ensureUploadNoticeInput(form);
    if (!input) return;
    input.value = String(message || "").trim();
  }

  function ensureSideUploadInput(form, side, kind) {
    if (!form) return null;
    const safeSide = side === "back" ? "back" : "front";
    const safeKind = kind === "notice" ? "notice" : "state";
    const id = `cf_upload_${safeKind}_${safeSide}`;
    const propertyName =
      safeKind === "notice"
        ? `properties[_${safeSide === "front" ? "Front" : "Back"} Upload Notice]`
        : `properties[_${safeSide === "front" ? "Front" : "Back"} Upload State]`;
    let input = form.querySelector(`#${id}, [name="${propertyName}"]`);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = propertyName;
      input.id = id;
      form.appendChild(input);
    }
    return input;
  }

  function setUploadAttemptedFlag(root, idx, value) {
    root.dataset[`uploadAttempted${idx}`] = value ? "true" : "";
  }

  function hasUploadAttemptedFlag(root, idx) {
    return root.dataset[`uploadAttempted${idx}`] === "true";
  }

  function getSideForIndex(idx) {
    return String(idx) === "2" ? "back" : "front";
  }

  function nextUploadSeq(root, idx) {
    if (!root) return 0;
    root.__cfUploadSeq = root.__cfUploadSeq || {};
    const key = String(idx);
    const next = Number(root.__cfUploadSeq[key] || 0) + 1;
    root.__cfUploadSeq[key] = next;
    return next;
  }

  function isLatestUploadSeq(root, idx, seq) {
    if (!root || !root.__cfUploadSeq) return true;
    return Number(root.__cfUploadSeq[String(idx)] || 0) === Number(seq || 0);
  }

  function getUploadGuards(root) {
    if (!root) return {};
    root.__cfUploadGuards = root.__cfUploadGuards || {};
    return root.__cfUploadGuards;
  }

  function getUploadGuard(root, idx) {
    const guards = getUploadGuards(root);
    const key = String(idx);
    if (!guards[key]) {
      guards[key] = {
        inFlight: false,
        signature: "",
        startedAt: 0
      };
    }
    return guards[key];
  }

  function getFileSignature(file) {
    if (!file) return "";
    return [
      String(file.name || "").trim(),
      Number(file.size || 0),
      Number(file.lastModified || 0)
    ].join("::");
  }

  function dispatchUploadSlotUpdated(idx, payload = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent("bd:upload-slot-updated", {
          detail: {
            slot: String(idx || "").trim(),
            url: String(payload.url || "").trim(),
            filename: String(payload.filename || "").trim()
          }
        })
      );
    } catch (e) {}
  }

  function shouldSkipDuplicateUpload(root, idx, fileSignature) {
    if (!fileSignature) return false;
    const guard = getUploadGuard(root, idx);
    if (!guard.signature || guard.signature !== fileSignature) return false;

    const elapsed = Date.now() - Number(guard.startedAt || 0);
    if (guard.inFlight) return true;
    return elapsed >= 0 && elapsed < 400;
  }

  function lockUploadGuard(root, idx, fileSignature) {
    const guard = getUploadGuard(root, idx);
    guard.inFlight = true;
    guard.signature = fileSignature || "";
    guard.startedAt = Date.now();
    return guard;
  }

  function unlockUploadGuard(root, idx, fileSignature) {
    const guard = getUploadGuard(root, idx);
    if (fileSignature && guard.signature && guard.signature !== fileSignature) return;
    guard.inFlight = false;
  }

  function getSideUploadState(root, idx) {
    const attempted = hasUploadAttemptedFlag(root, idx);
    const url = String(root.querySelector(`[data-url="${idx}"]`)?.value || "").trim();
    const largeMissing = hasLargeUploadFlag(root, idx) && !url;
    if (url) return "uploaded";
    if (largeMissing) return "fallback";
    if (attempted) return "attempted";
    return "none";
  }

  function getSideUploadNotice(root, idx) {
    const url = String(root.querySelector(`[data-url="${idx}"]`)?.value || "").trim();
    if (hasLargeUploadFlag(root, idx) && !url) {
      return "Your image is over 10MB. You can still preview your design—after ordering, email the original file to info@sarvsartsandcrafts.com and we’ll handle the proof and printing.";
    }
    return "";
  }

  function syncSideUploadStateInputs(root, form) {
    if (!root || !form) return;
    ["1", "2"].forEach((idx) => {
      const side = getSideForIndex(idx);
      const stateInput = ensureSideUploadInput(form, side, "state");
      const noticeInput = ensureSideUploadInput(form, side, "notice");
      if (stateInput) stateInput.value = getSideUploadState(root, idx);
      if (noticeInput) noticeInput.value = getSideUploadNotice(root, idx);
    });
  }

  function setLargeUploadFlag(root, idx, value) {
    root.dataset[`uploadLarge${idx}`] = value ? "true" : "";
  }

  function hasLargeUploadFlag(root, idx) {
    return root.dataset[`uploadLarge${idx}`] === "true";
  }

  const DEFAULT_R2_UPLOAD_ENDPOINT = "https://saac-r2-upload.bs-dhingra.workers.dev";
  const DEFAULT_R2_PUBLIC_BASE_URL = "https://cdn.sarvsartsandcrafts.com";

  const DEFAULT_UPLOAD_PROVIDER_CONFIG = {
    activeProvider: "r2",
    originalUploadProvider: "r2",
    providers: {
      cloudinary: {
        enabled: true,
        cloudName: "dddoiamwn",
        uploadPreset: "guoeywbk",
        uploadFolder: "Customer Uploads",
        proofFolder: "proofs"
      },
      uploadcare: {
        enabled: true,
        publicKey: "5875ca176774d35226ea",
        store: "auto",
        cdnBase: "https://1wa89vtiok.ucarecd.net",
        uploadFolder: "Customer Uploads",
        proofFolder: "proofs"
      },
      r2: {
        enabled: true,
        endpoint: DEFAULT_R2_UPLOAD_ENDPOINT,
        publicBaseUrl: DEFAULT_R2_PUBLIC_BASE_URL
      }
    }
  };

  function mergeUploadProviderConfig(base, override) {
    const next = {
      activeProvider: base.activeProvider,
      originalUploadProvider: base.originalUploadProvider,
      providers: {
        cloudinary: { ...base.providers.cloudinary },
        uploadcare: { ...base.providers.uploadcare },
        r2: { ...base.providers.r2 }
      }
    };
    if (!override || typeof override !== "object") return next;
    if (typeof override.activeProvider === "string" && override.activeProvider.trim()) {
      next.activeProvider = override.activeProvider.trim();
    }
    if (override.originalUploadProvider === null || typeof override.originalUploadProvider === "string") {
      const provider = String(override.originalUploadProvider || "").trim();
      next.originalUploadProvider = provider || null;
    }
    if (override.providers && typeof override.providers === "object") {
      if (override.providers.cloudinary && typeof override.providers.cloudinary === "object") {
        Object.assign(next.providers.cloudinary, override.providers.cloudinary);
      }
      if (override.providers.uploadcare && typeof override.providers.uploadcare === "object") {
        Object.assign(next.providers.uploadcare, override.providers.uploadcare);
      }
      if (override.providers.r2 && typeof override.providers.r2 === "object") {
        Object.assign(next.providers.r2, override.providers.r2);
      }
    }
    return next;
  }

  function ensureUploadProviderConfig() {
    const existing = window.BD_UPLOAD_PROVIDER_CONFIG && typeof window.BD_UPLOAD_PROVIDER_CONFIG === "object"
      ? window.BD_UPLOAD_PROVIDER_CONFIG
      : {};
    const merged = mergeUploadProviderConfig(DEFAULT_UPLOAD_PROVIDER_CONFIG, existing);
    window.BD_UPLOAD_PROVIDER_CONFIG = merged;
    return merged;
  }

  function patchUploadProviderConfig(partial) {
    const merged = mergeUploadProviderConfig(ensureUploadProviderConfig(), partial);
    window.BD_UPLOAD_PROVIDER_CONFIG = merged;
    return merged;
  }

  function applyUploaderRootConfig(root) {
    if (!root) return ensureUploadProviderConfig();
    const cloud = String(root.dataset.cloud || "").trim();
    const preset = String(root.dataset.preset || "").trim();
    const folder = String(root.dataset.folder || "").trim();
    const uploadcareCdnBase = String(root.dataset.uploadcareCdnBase || "").trim();
    const patch = { providers: { cloudinary: {}, uploadcare: {} } };
    if (cloud) patch.providers.cloudinary.cloudName = cloud;
    if (preset) patch.providers.cloudinary.uploadPreset = preset;
    if (folder) patch.providers.cloudinary.uploadFolder = folder;
    if (uploadcareCdnBase) patch.providers.uploadcare.cdnBase = uploadcareCdnBase;
    return patchUploadProviderConfig(patch);
  }

  function uploadFormData({ url, formData, onProgress }) {
    const fd = formData instanceof FormData ? formData : new FormData();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress?.(pct);
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        }
      };

      xhr.send(fd);
    });
  }

  function normalizeCloudinaryUploadResponse(raw, fileOrBlob, fallbackFilename) {
    const filename = String(
      fallbackFilename ||
      (fileOrBlob && fileOrBlob.name) ||
      raw.original_filename ||
      raw.public_id ||
      ""
    ).trim();
    const id = String(raw.public_id || raw.asset_id || "").trim();
    const secureUrl = String(raw.secure_url || raw.url || "").trim();
    return {
      provider: "cloudinary",
      url: secureUrl,
      secureUrl,
      id,
      publicId: id,
      filename,
      width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : null,
      height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : null,
      raw
    };
  }

  function uploadAssetViaCloudinary(fileOrBlob, options, providerConfig) {
    const cloud = String(providerConfig.cloudName || "").trim();
    const preset = String(providerConfig.uploadPreset || "").trim();
    if (!cloud || !preset) {
      return Promise.reject(new Error("Cloudinary upload is not configured."));
    }

    const kind = options.kind === "proof" ? "proof" : "original";
    const folder = String(
      options.folder ||
      (kind === "proof" ? providerConfig.proofFolder : providerConfig.uploadFolder) ||
      ""
    ).trim();
    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`;
    const formData = new FormData();
    formData.append("file", fileOrBlob);
    formData.append("upload_preset", preset);
    if (folder) formData.append("folder", folder);

    return uploadFormData({
      url: uploadUrl,
      formData,
      onProgress: options.onProgress
    }).then((raw) => normalizeCloudinaryUploadResponse(raw, fileOrBlob, options.filename));
  }

  function extractUploadcareUuid(response) {
    if (!response || typeof response !== "object") return "";
    if (typeof response.file === "string" && response.file.trim()) return response.file.trim();
    if (typeof response.uuid === "string" && response.uuid.trim()) return response.uuid.trim();
    const firstStringValue = Object.values(response).find(
      (value) => typeof value === "string" && value.trim().length > 10
    );
    return typeof firstStringValue === "string" ? firstStringValue.trim() : "";
  }

  function normalizeUploadcareCdnBase(cdnBase) {
    const base = String(cdnBase || "").trim();
    if (!base) return "";
    const withProtocol = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    return withProtocol.replace(/\/+$/, "");
  }

  function buildUploadcareDeliveryUrl(uuid, filename, providerConfig) {
    const normalizedBase = normalizeUploadcareCdnBase(providerConfig && providerConfig.cdnBase);
    if (!uuid || !normalizedBase) return "";
    const safeFilename = String(filename || "").trim();
    if (!safeFilename) return `${normalizedBase}/${uuid}/`;
    return `${normalizedBase}/${uuid}/${encodeURIComponent(safeFilename)}`;
  }

  function normalizeUploadcareUploadResponse(raw, fileOrBlob, fallbackFilename, providerConfig) {
    const uuid = extractUploadcareUuid(raw);
    const filename = String(fallbackFilename || (fileOrBlob && fileOrBlob.name) || "").trim();
    const secureUrl = buildUploadcareDeliveryUrl(uuid, filename, providerConfig);
    return {
      provider: "uploadcare",
      url: secureUrl,
      secureUrl,
      id: uuid,
      publicId: uuid,
      filename,
      width: null,
      height: null,
      raw
    };
  }

  async function fetchUploadcareFileInfo(uuid, publicKey) {
    const safeUuid = String(uuid || "").trim();
    const safePublicKey = String(publicKey || "").trim();
    if (!safeUuid || !safePublicKey) return null;
    const infoUrl = `https://upload.uploadcare.com/info/?pub_key=${encodeURIComponent(safePublicKey)}&file_id=${encodeURIComponent(safeUuid)}`;
    const res = await fetch(infoUrl, { method: "GET" });
    if (!res.ok) {
      return {
        ok: false,
        status: Number(res.status || 0)
      };
    }
    const json = await res.json();
    return {
      ok: true,
      status: Number(res.status || 0),
      uuid: String(json.uuid || json.file_id || safeUuid).trim(),
      filename: String(json.original_filename || json.filename || "").trim(),
      mimeType: String(json.mime_type || "").trim(),
      isImage: !!json.is_image,
      isStored: !!json.is_stored,
      isReady: !!json.is_ready
    };
  }

  async function captureUploadcareDebug(result, options, uploadFile, providerConfig, storeMode) {
    if (!window.__BD_UPLOADCARE_DEBUG__) return;
    const debugState = {
      ts: Date.now(),
      kind: options.kind === "proof" ? "proof" : "original",
      request: {
        fieldName: "file",
        publicKeyPresent: !!String(providerConfig.publicKey || "").trim(),
        store: String(storeMode || providerConfig.store || "auto").trim() || "auto",
        cdnBase: normalizeUploadcareCdnBase(providerConfig.cdnBase || ""),
        filename: String((uploadFile && uploadFile.name) || options.filename || "").trim(),
        mimeType: String((uploadFile && uploadFile.type) || "").trim()
      },
      response: result.raw || null,
      normalized: {
        provider: result.provider,
        url: result.url,
        secureUrl: result.secureUrl,
        id: result.id,
        publicId: result.publicId,
        filename: result.filename
      },
      fileInfo: null,
      probe: null
    };

    try {
      debugState.fileInfo = await fetchUploadcareFileInfo(result.id, providerConfig.publicKey);
    } catch (err) {
      debugState.fileInfo = {
        ok: false,
        status: 0,
        error: String((err && err.message) || err || "").trim()
      };
    }

    try {
      const probeRes = await fetch(result.secureUrl || result.url || "", {
        method: "HEAD"
      });
      debugState.probe = {
        method: "HEAD",
        ok: !!probeRes.ok,
        status: Number(probeRes.status || 0),
        contentType: String(probeRes.headers.get("content-type") || "").trim()
      };
    } catch (err) {
      debugState.probe = {
        method: "HEAD",
        ok: false,
        status: 0,
        error: String((err && err.message) || err || "").trim()
      };
    }

    window.__BD_UPLOADCARE_DEBUG_LAST__ = debugState;
  }

  function uploadAssetViaUploadcare(fileOrBlob, options, providerConfig) {
    const publicKey = String(providerConfig.publicKey || "").trim();
    if (!publicKey) {
      return Promise.reject(new Error("Uploadcare public key is missing."));
    }
    const kind = options.kind === "proof" ? "proof" : "original";
    const store = kind === "proof"
      ? "1"
      : (String(providerConfig.store || "auto").trim() || "auto");
    const filename = String(options.filename || (fileOrBlob && fileOrBlob.name) || "upload").trim() || "upload";
    const uploadFile =
      typeof File === "function" &&
      fileOrBlob instanceof Blob &&
      !(fileOrBlob instanceof File)
        ? new File([fileOrBlob], filename, {
            type: String(fileOrBlob.type || "application/octet-stream").trim() || "application/octet-stream"
          })
        : fileOrBlob;
    const formData = new FormData();
    formData.append("UPLOADCARE_PUB_KEY", publicKey);
    formData.append("UPLOADCARE_STORE", store);
    formData.append("file", uploadFile, filename);

    return uploadFormData({
      url: "https://upload.uploadcare.com/base/",
      formData,
      onProgress: options.onProgress
    }).then(async (raw) => {
      const result = normalizeUploadcareUploadResponse(raw, uploadFile, filename, providerConfig);
      await captureUploadcareDebug(result, options, uploadFile, providerConfig, store);
      return result;
    });
  }

  function normalizeR2PublicBaseUrl(baseUrl) {
    const base = String(baseUrl || "").trim();
    if (!base) return "";
    const withProtocol = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    return withProtocol.replace(/\/+$/, "");
  }

  function normalizeR2DeliveryKey(key) {
    const safeKey = String(key || "").trim().replace(/^\/+/, "");
    if (!safeKey) return "";
    if (safeKey.startsWith("uploads/")) return safeKey;
    return `uploads/${safeKey}`;
  }

  function buildR2DeliveryUrl(key, providerConfig) {
    const normalizedBase = normalizeR2PublicBaseUrl(
      (providerConfig && providerConfig.publicBaseUrl) ||
      (providerConfig && providerConfig.endpoint) ||
      ""
    );
    const safeKey = normalizeR2DeliveryKey(key);
    if (!normalizedBase || !safeKey) return "";
    return `${normalizedBase}/${safeKey}`;
  }

  function normalizeR2UploadResponse(raw, fileOrBlob, fallbackFilename, providerConfig) {
    const key = String(raw && (raw.key || raw.id || raw.public_id) || "").trim();
    const fileUrl = String(raw && (raw.fileUrl || raw.secure_url || raw.url) || "").trim();
    const filename = String(
      fallbackFilename ||
      (raw && (raw.filename || raw.originalFilename || raw.original_filename)) ||
      (fileOrBlob && fileOrBlob.name) ||
      ""
    ).trim();
    const workerUrl = buildR2DeliveryUrl(key, providerConfig);
    const secureUrl = workerUrl || fileUrl;
    return {
      provider: "r2",
      url: secureUrl,
      secureUrl,
      id: key,
      publicId: key,
      filename,
      width: null,
      height: null,
      raw
    };
  }

  function uploadAssetViaR2(fileOrBlob, options, providerConfig) {
    const endpoint = String(providerConfig.endpoint || "").trim();
    if (!endpoint) {
      return Promise.reject(new Error("R2 upload endpoint is not configured."));
    }
    const filename = String(options.filename || (fileOrBlob && fileOrBlob.name) || "upload").trim() || "upload";
    const uploadFile =
      typeof File === "function" &&
      fileOrBlob instanceof Blob &&
      !(fileOrBlob instanceof File)
        ? new File([fileOrBlob], filename, {
            type: String(fileOrBlob.type || "application/octet-stream").trim() || "application/octet-stream"
          })
        : fileOrBlob;
    const formData = new FormData();
    formData.append("file", uploadFile, filename);

    return uploadFormData({
      url: endpoint,
      formData,
      onProgress: options.onProgress
    }).then((raw) => normalizeR2UploadResponse(raw, uploadFile, filename, providerConfig));
  }

  function normalizeProviderName(providerName, fallback = "cloudinary") {
    const normalized = String(providerName || "").trim().toLowerCase();
    if (normalized === "uploadcare" || normalized === "cloudinary" || normalized === "r2") {
      return normalized;
    }
    return fallback;
  }

  function getOriginalUploadProviderName(config) {
    const originalUploadProvider = String(config.originalUploadProvider || "").trim();
    if (originalUploadProvider) {
      return normalizeProviderName(originalUploadProvider, "cloudinary");
    }
    return normalizeProviderName(config.activeProvider, "cloudinary");
  }

  function getProofUploadProviderName(config) {
    return normalizeProviderName(config.activeProvider, "cloudinary");
  }

  function getProviderConfig(config, providerName) {
    const normalizedProvider = normalizeProviderName(providerName, "cloudinary");
    const providerConfig = config.providers && config.providers[normalizedProvider];
    if (!providerConfig) {
      throw new Error(`Upload provider "${normalizedProvider}" is not configured.`);
    }
    if (!providerConfig.enabled) {
      throw new Error(`Upload provider "${normalizedProvider}" is disabled.`);
    }
    return {
      providerName: normalizedProvider,
      providerConfig
    };
  }

  function uploadAssetViaProvider(fileOrBlob, options, providerName, config) {
    const resolved = getProviderConfig(config, providerName);
    if (resolved.providerName === "uploadcare") {
      return uploadAssetViaUploadcare(fileOrBlob, options, resolved.providerConfig);
    }
    if (resolved.providerName === "r2") {
      return uploadAssetViaR2(fileOrBlob, options, resolved.providerConfig);
    }
    return uploadAssetViaCloudinary(fileOrBlob, options, resolved.providerConfig);
  }

  function recordUploadTrace(entry) {
    const traceEntry = {
      ts: Date.now(),
      ...entry
    };
    const trace = Array.isArray(window.__BD_UPLOAD_TRACE__) ? window.__BD_UPLOAD_TRACE__ : [];
    trace.push(traceEntry);
    window.__BD_UPLOAD_TRACE__ = trace.slice(-25);
    window.__BD_UPLOAD_TRACE_LAST__ = traceEntry;
    if (window.__BD_UPLOAD_PROVIDER_TRACE__) {
      const method = traceEntry.fallbackUsed ? "warn" : "info";
      console[method]("[bdUploadAsset]", traceEntry);
    }
  }

  window.bdGetUploadProviderConfig = ensureUploadProviderConfig;
  window.bdPatchUploadProviderConfig = patchUploadProviderConfig;
  window.bdPersistMasterOriginalUpload = persistMasterOriginalUpload;
  window.bdReadMasterOriginalUpload = readMasterOriginalUpload;
  window.bdPersistWorkingUpload = persistWorkingUpload;
  window.bdReadWorkingUpload = readWorkingUpload;
  window.bdUploadAsset = function (fileOrBlob, options = {}) {
    const config = ensureUploadProviderConfig();
    const kind = options.kind === "proof" ? "proof" : "original";
    const primaryProvider = kind === "original"
      ? getOriginalUploadProviderName(config)
      : getProofUploadProviderName(config);

    const attemptPrimary = () => uploadAssetViaProvider(fileOrBlob, options, primaryProvider, config);
    if (primaryProvider !== "r2") {
      return attemptPrimary().then((result) => {
        recordUploadTrace({
          kind,
          provider: result && result.provider ? result.provider : primaryProvider,
          primaryProvider,
          fallbackUsed: false,
          filename: String(options.filename || (fileOrBlob && fileOrBlob.name) || "").trim()
        });
        return result;
      });
    }

    return attemptPrimary()
      .then((result) => {
        recordUploadTrace({
          kind,
          provider: result && result.provider ? result.provider : primaryProvider,
          primaryProvider,
          fallbackUsed: false,
          filename: String(options.filename || (fileOrBlob && fileOrBlob.name) || "").trim()
        });
        return result;
      })
      .catch((primaryError) =>
        uploadAssetViaProvider(fileOrBlob, options, "cloudinary", config).then((result) => {
          recordUploadTrace({
            kind,
            provider: result && result.provider ? result.provider : "cloudinary",
            primaryProvider,
            fallbackUsed: true,
            fallbackProvider: "cloudinary",
            primaryError: String((primaryError && primaryError.message) || primaryError || "").trim(),
            filename: String(options.filename || (fileOrBlob && fileOrBlob.name) || "").trim()
          });
          return result;
        })
      );
  };

  function init(root) {
    if (!root || root.__cfUploaderInitialized) return;
    root.__cfUploaderInitialized = true;
    applyUploaderRootConfig(root);
    const cloud = root.dataset.cloud || "";
    const preset = root.dataset.preset || "";
    const folder = root.dataset.folder || "";
    const enforcement = (root.dataset.enforcement || "soft").toLowerCase();
    const previewMode = (root.dataset.preview || "on").toLowerCase();

    const hasU1 = root.dataset.hasU1 === "true";
    const hasU2 = root.dataset.hasU2 === "true";
    const hasText = root.dataset.hasText === "true";

    const textRequired = root.dataset.textRequired === "true";
    const u1Required = root.dataset.u1Required === "true";
    const u2Required = root.dataset.u2Required === "true";

    const minWidth = parseInt(root.dataset.minWidth || "2000", 10);
    const qualityMode = (root.dataset.qualityMode || "warn").toLowerCase();
    const uploadMode = (root.dataset.uploadMode || "default").toLowerCase();
    const allowedTypes = uploadMode === "svg-only" ? SVG_ONLY_ALLOWED : ALLOWED;
    const invalidTypeMessage = uploadMode === "svg-only"
      ? "Please upload an SVG file."
      : "Please upload PNG, JPG, or SVG.";

    const form = getForm(root);
    const shouldBlock = enforcement === "strict";

    function validateBeforeSubmit() {
      if (!shouldBlock) return { ok: true };

      if (hasText && textRequired) {
        const textarea = root.querySelector('textarea[name="properties[Customization text]"]');
        if (textarea && !textarea.value.trim()) {
          return { ok: false, msg: "Please fill the customization text." };
        }
      }

      if (hasU1 && u1Required) {
        const url1 = root.querySelector('[data-url="1"]')?.value || "";
        if (!url1) return { ok: false, msg: "Please upload the required image (Upload 1)." };
      }

      if (hasU2 && u2Required) {
        const url2 = root.querySelector('[data-url="2"]')?.value || "";
        if (!url2) return { ok: false, msg: "Please upload the required image (Upload 2)." };
      }

      return { ok: true };
    }

    async function handleFile(idx, file, options = {}) {
      if (!file) return;
      const preserveMasterOriginal = !!(options && options.preserveMasterOriginal);
      const fileSignature = getFileSignature(file);
      if (shouldSkipDuplicateUpload(root, idx, fileSignature)) {
        return;
      }
      lockUploadGuard(root, idx, fileSignature);
      const uploadSeq = nextUploadSeq(root, idx);
      setUploadAttemptedFlag(root, idx, true);
      syncSideUploadStateInputs(root, form);

      const urlEl = getSlotPrimaryField(root, "data-url", idx);
      setSlotFieldValues(root, "data-url", idx, "");
      setSlotFieldValues(root, "data-publicid", idx, "");
      setSlotFieldValues(root, "data-width", idx, "");
      setSlotFieldValues(root, "data-height", idx, "");
      setSlotFieldValues(root, "data-filename", idx, file?.name || "");
      dispatchUploadSlotUpdated(idx, { url: "", filename: file?.name || "" });

      const previewWrap = root.querySelector(`[data-preview-wrap="${idx}"]`);
      const previewImg = root.querySelector(`[data-preview-img="${idx}"]`);
      const meta = root.querySelector(`[data-meta="${idx}"]`);

      if (previewWrap) previewWrap.hidden = true;
      setStatus(root, idx, "", "");
      setLargeUploadFlag(root, idx, false);

      if (!allowedTypes.includes(file.type)) {
        setStatus(root, idx, invalidTypeMessage, "error");
        setUploadNotice(form, upload1Missing || upload2Missing ? LARGE_UPLOAD_NOTICE_TEXT : "");
        syncSideUploadStateInputs(root, form);
        unlockUploadGuard(root, idx, fileSignature);
        return;
      }

      const mb = file.size / (1024 * 1024);
      const exceedsSizeLimit = mb > MAX_MB;
      const fileSizeText = mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1024))}KB`;
      const largeFileMsg = "Your image is over 10MB. You can still preview your design—after ordering, email the original file to info@sarvsartsandcrafts.com and we’ll handle the proof and printing.";
      setLargeUploadFlag(root, idx, exceedsSizeLimit);

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = async () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;

        setSlotFieldValues(root, "data-width", idx, String(w));
        setSlotFieldValues(root, "data-height", idx, String(h));

        if (previewMode === "on" && previewWrap && previewImg) {
          previewImg.src = objectUrl;
          previewWrap.hidden = false;
          if (meta) meta.textContent = `${file.name} - ${w}x${h}px - ${fileSizeText}`;
        } else {
          setStatus(
            root,
            idx,
            `${file.name} selected (${w}x${h}px, ${fileSizeText}). Uploading...`,
            "ok"
          );
        }

        let lowResWarn = false;
        let lowResMsg = "";
        let lowResBlockMsg = "";
        const isSvg = file.type === "image/svg+xml";
        const longSide = Math.max(w || 0, h || 0);

        if (qualityMode !== "never" && !isSvg && longSide > 0 && longSide < minWidth) {
          lowResWarn = true;
          lowResMsg = `Uploaded (${w}×${h}). Low resolution — ${minWidth}px+ on the longest side recommended.`;
          lowResBlockMsg = `Image is ${w}x${h}px. Recommended: ${minWidth}px+ on the longest side for best print.`;

          if (qualityMode === "block" && shouldBlock) {
            setStatus(root, idx, `${lowResBlockMsg} Please upload a higher-resolution image.`, "error");
            syncSideUploadStateInputs(root, form);
            unlockUploadGuard(root, idx, fileSignature);
            return;
          }

          const combinedWarnMsg = `${lowResMsg} ${largeFileMsg}`;
          setStatus(root, idx, exceedsSizeLimit ? combinedWarnMsg : lowResMsg, "warn");
        } else {
          setStatus(root, idx, exceedsSizeLimit ? largeFileMsg : "Uploading...", exceedsSizeLimit ? "warn" : "ok");
        }

        try {
          const res = await window.bdUploadAsset(file, {
            kind: "original",
            filename: file.name,
            folder,
            onProgress: (pct) => {
              if (!isLatestUploadSeq(root, idx, uploadSeq)) return;
              setProgress(root, idx, pct);
            }
          });

          if (!isLatestUploadSeq(root, idx, uploadSeq)) return;

          const secureUrl = res.secureUrl || res.url || "";
          const shouldUpdateMasterOriginal = !preserveMasterOriginal || !getMasterOriginalUrl(root, idx);
          setSlotFieldValues(root, "data-url", idx, secureUrl);
          window.bdPersistWorkingUpload?.(root, idx, file);
          if (shouldUpdateMasterOriginal) {
            setSlotFieldValues(root, "data-master-url", idx, secureUrl);
            window.bdPersistMasterOriginalUpload?.(root, idx, file, { overwrite: true });
          }
          setSlotFieldValues(root, "data-publicid", idx, res.publicId || res.id || "");
          dispatchUploadSlotUpdated(idx, { url: secureUrl, filename: file?.name || "" });

          if (lowResWarn && exceedsSizeLimit) {
            setStatus(root, idx, `${lowResMsg} ${largeFileMsg}`, "warn");
          } else if (lowResWarn) {
            setStatus(root, idx, lowResMsg, "warn");
          } else if (exceedsSizeLimit) {
            setStatus(root, idx, largeFileMsg, "warn");
          } else {
            setStatus(root, idx, "Upload complete.", "ok");
          }

          if (meta && previewMode === "on") {
            meta.textContent =
              `${file.name} - ${w}x${h}px` +
              ` - ${fileSizeText}` +
              ` - Uploaded` +
              `${lowResWarn ? " - Low resolution" : ""}`;
          }
        } catch (err) {
          if (!isLatestUploadSeq(root, idx, uploadSeq)) return;
          console.error(err);
          setStatus(
            root,
            idx,
            exceedsSizeLimit
              ? "Your image is over 10MB. You can still preview your design—after ordering, email the original file to info@sarvsartsandcrafts.com and we’ll handle the proof and printing."
              : String((err && err.message) || "Upload failed. Please try again."),
            exceedsSizeLimit ? "warn" : "error"
          );
          setSlotFieldValues(root, "data-url", idx, "");
          setSlotFieldValues(root, "data-publicid", idx, "");
          dispatchUploadSlotUpdated(idx, { url: "", filename: file?.name || "" });
        } finally {
          unlockUploadGuard(root, idx, fileSignature);
          if (isLatestUploadSeq(root, idx, uploadSeq)) {
            syncSideUploadStateInputs(root, form);
          }
        }
      };

      img.onerror = () => {
        setStatus(root, idx, "Could not read this image. Try another file.", "error");
        URL.revokeObjectURL(objectUrl);
        syncSideUploadStateInputs(root, form);
        unlockUploadGuard(root, idx, fileSignature);
      };

      img.src = objectUrl;
    }

    qsa(root, "[data-upload-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = input.getAttribute("data-upload-input");
        const file = input.files && input.files[0];
        const preserveMasterOriginal =
          Number(input.__bdPreserveMasterOriginal || 0) > 0 ||
          Number(input.__bdCropBypassCount || 0) > 0;
        handleFile(idx, file, { preserveMasterOriginal });
        input.__bdPreserveMasterOriginal = 0;
        window.setTimeout(() => {
          try {
            input.value = "";
          } catch (e) {}
        }, 0);
      });
    });

    if (form) {
      syncSideUploadStateInputs(root, form);
      form.addEventListener("submit", (e) => {
        const upload1Missing = hasLargeUploadFlag(root, 1);
        const upload2Missing = hasLargeUploadFlag(root, 2);
        setUploadNotice(form, upload1Missing || upload2Missing ? "Your image is over 10MB. You can still preview your design—after ordering, email the original file to info@sarvsartsandcrafts.com and we’ll handle the proof and printing." : "");
        syncSideUploadStateInputs(root, form);

        const res = validateBeforeSubmit();
        if (!res.ok) {
          e.preventDefault();
          setGlobal(root, res.msg, "error");
          root.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          setGlobal(root, "", "");
        }
      });
    }
  }

  function initAll(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    root.querySelectorAll("[data-cf-uploader]").forEach(init);
  }

  window.CF_CUSTOM_FIELDS_UPLOADER_INIT = initAll;

  document.addEventListener("DOMContentLoaded", () => {
    initAll(document);
  });

  document.addEventListener("shopify:section:load", (event) => {
    initAll(event.target || document);
  });

  ["variantChange", "variant:change", "product:variant-change", "product-info:loaded"].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      requestAnimationFrame(() => initAll(document));
    });
  });
})();
