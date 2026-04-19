(function () {
  const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const MAX_MB = 10;

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function qsa(root, sel) {
    return Array.from(root.querySelectorAll(sel));
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

  function uploadToCloudinary({ cloud, preset, folder, file, onProgress }) {
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
    if (folder) fd.append("folder", folder);

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

  function init(root) {
    if (!root || root.__cfUploaderInitialized) return;
    root.__cfUploaderInitialized = true;
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

    async function handleFile(idx, file) {
      if (!file) return;
      setUploadAttemptedFlag(root, idx, true);
      syncSideUploadStateInputs(root, form);

      const urlEl = root.querySelector(`[data-url="${idx}"]`);
      const pidEl = root.querySelector(`[data-publicid="${idx}"]`);
      const wEl = root.querySelector(`[data-width="${idx}"]`);
      const hEl = root.querySelector(`[data-height="${idx}"]`);
      const fnEl = root.querySelector(`[data-filename="${idx}"]`);

      if (urlEl) urlEl.value = "";
      if (pidEl) pidEl.value = "";
      if (wEl) wEl.value = "";
      if (hEl) hEl.value = "";
      if (fnEl) fnEl.value = file?.name || "";

      const previewWrap = root.querySelector(`[data-preview-wrap="${idx}"]`);
      const previewImg = root.querySelector(`[data-preview-img="${idx}"]`);
      const meta = root.querySelector(`[data-meta="${idx}"]`);

      if (previewWrap) previewWrap.hidden = true;
      setStatus(root, idx, "", "");
      setLargeUploadFlag(root, idx, false);

      if (!ALLOWED.includes(file.type)) {
        setStatus(root, idx, "Please upload PNG, JPG, SVG, or WEBP.", "error");
        syncSideUploadStateInputs(root, form);
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

        if (wEl) wEl.value = String(w);
        if (hEl) hEl.value = String(h);

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
            return;
          }

          setStatus(root, idx, lowResMsg, "warn");
        } else {
          setStatus(root, idx, exceedsSizeLimit ? largeFileMsg : "Uploading...", exceedsSizeLimit ? "warn" : "ok");
        }

        if (!cloud || !preset) {
          setStatus(root, idx, "Cloudinary not configured in theme settings.", "error");
          syncSideUploadStateInputs(root, form);
          return;
        }

        try {
          const res = await uploadToCloudinary({
            cloud,
            preset,
            folder,
            file,
            onProgress: (pct) => setProgress(root, idx, pct)
          });

          const secureUrl = res.secure_url || res.url || "";
          if (urlEl) urlEl.value = secureUrl;
          if (pidEl) pidEl.value = res.public_id || "";

          if (lowResWarn) {
            setStatus(root, idx, lowResMsg, "warn");
          } else if (exceedsSizeLimit) {
            setStatus(root, idx, largeFileMsg, "warn");
          } else {
            setStatus(root, idx, "Upload complete.", "ok");
          }
          setLargeUploadFlag(root, idx, false);

          if (meta && previewMode === "on") {
            meta.textContent =
              `${file.name} - ${w}x${h}px` +
              ` - ${fileSizeText}` +
              ` - Uploaded` +
              `${lowResWarn ? " - Low resolution" : ""}`;
          }
        } catch (err) {
          console.error(err);
          setStatus(
            root,
            idx,
            exceedsSizeLimit
              ? "Your image is over 10MB. You can still preview your design—after ordering, email the original file to info@sarvsartsandcrafts.com and we’ll handle the proof and printing."
              : "Upload failed. Please try again.",
            exceedsSizeLimit ? "warn" : "error"
          );
          if (urlEl) urlEl.value = "";
          if (pidEl) pidEl.value = "";
        } finally {
          syncSideUploadStateInputs(root, form);
        }
      };

      img.onerror = () => {
        setStatus(root, idx, "Could not read this image. Try another file.", "error");
        URL.revokeObjectURL(objectUrl);
        syncSideUploadStateInputs(root, form);
      };

      img.src = objectUrl;
    }

    qsa(root, "[data-upload-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = input.getAttribute("data-upload-input");
        const file = input.files && input.files[0];
        handleFile(idx, file);
      });
    });

    if (form) {
      syncSideUploadStateInputs(root, form);
      form.addEventListener("submit", (e) => {
        const upload1Missing = hasLargeUploadFlag(root, 1) && !String(root.querySelector('[data-url="1"]')?.value || "").trim();
        const upload2Missing = hasLargeUploadFlag(root, 2) && !String(root.querySelector('[data-url="2"]')?.value || "").trim();
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
