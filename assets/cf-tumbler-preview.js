(function () {
  function init() {
    const previews = Array.from(document.querySelectorAll('[data-cf-tumbler]'));
    if (!previews.length) return;

    // Hide all preview blocks initially
    previews.forEach(p => p.hidden = true);

    // Use the first preview that lives inside your uploader
    for (const preview of previews) {
      const uploader = preview.closest('[data-cf-uploader]');
      if (!uploader) continue;

      const urlInput = uploader.querySelector('input[data-url="1"][name="properties[Design 1 URL]"]');
      const designImg = preview.querySelector('[data-cf-design]');
      if (!urlInput || !designImg) continue;

      const wrap = preview.querySelector('.cf-wrap');
      const wrapImg = preview.querySelector('.cf-wrap .cf-tumbler-design');

      let last = '';

      const applyWrap = () => {
        if (!wrap || !wrapImg) return;

        const src = (wrapImg.getAttribute('src') || '').trim();
        if (!src) return;

        wrap.style.setProperty('--design-url', `url("${src}")`);
        wrap.setAttribute('data-has-design', '1');
      };

      const tick = () => {
        const url = (urlInput.value || '').trim();
        if (!url || url === last) return;

        last = url;

        // Your existing image
        designImg.src = url;
        designImg.style.display = 'block';

        // The wrap image (usually same element, but keep safe)
        if (wrapImg) wrapImg.src = url;

        preview.hidden = false;

        // Apply wrap effect only after src exists
        applyWrap();

        // Remove duplicates if Dawn rendered the snippet more than once
        previews.forEach(p => { if (p !== preview) p.remove(); });
      };

      tick();
      setInterval(tick, 300);
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
