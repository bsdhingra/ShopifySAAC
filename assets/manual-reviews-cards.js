(function () {
  function repairMojibake(value) {
    var input = String(value || '');
    if (!/[\u00C2\u00C3\u00E2\u00F0]/.test(input)) return input;

    function suspiciousScore(text) {
      var matches = text.match(/[\u00C2\u00C3\u00E2\u00F0]/g);
      return matches ? matches.length : 0;
    }

    var current = input;
    for (var pass = 0; pass < 3; pass += 1) {
      try {
        var bytes = new Uint8Array(current.length);
        for (var index = 0; index < current.length; index += 1) {
          bytes[index] = current.charCodeAt(index) & 255;
        }
        var decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (suspiciousScore(decoded) < suspiciousScore(current)) {
          current = decoded;
          continue;
        }
      } catch (error) {
      }
      break;
    }
    return current;
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var value = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i += 1) {
      var char = text[i];
      var next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          value += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          value += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(value);
        value = '';
      } else if (char === '\n') {
        row.push(value.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    if (value.length || row.length) {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
    }

    return rows.filter(function (item) {
      return item.length && item.some(function (cell) {
        return String(cell || '').trim() !== '';
      });
    });
  }

  function stars(rating) {
    var safe = Math.max(0, Math.min(5, Number(rating) || 0));
    var starSvg =
      '<svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">' +
        '<path d="M12 2.75 14.91 8.65 21.42 9.59 16.71 14.18 17.82 20.66 12 17.6 6.18 20.66 7.29 14.18 2.58 9.59 9.09 8.65 12 2.75Z" fill="currentColor"/>' +
      '</svg>';
    var markup = '';

    for (var index = 0; index < safe; index += 1) {
      markup += '<span class="bd-manual-reviews-card__star-icon">' + starSvg + '</span>';
    }

    return markup;
  }

  function facebookIconMarkup(iconMarkup, className) {
    var icon = String(iconMarkup || '').trim();
    if (!icon) return '';

    return (
      '<span class="' + escapeHtml(className || '') + '" aria-hidden="true">' +
        icon +
      '</span>'
    );
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatReviewDate(value) {
    var input = String(value || '').trim();
    if (!input || input === '########') return '';

    var isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var usMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/);
    var monthIndex;
    var day;

    if (isoMatch) {
      monthIndex = Number(isoMatch[2]) - 1;
      day = Number(isoMatch[3]);
    } else if (usMatch) {
      monthIndex = Number(usMatch[1]) - 1;
      day = Number(usMatch[2]);
    } else {
      return input;
    }

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthIndex < 0 || monthIndex > 11 || !day) return input;
    return months[monthIndex] + ' ' + day;
  }

  function reviewDateTimestamp(value) {
    var input = String(value || '').trim();
    if (!input || input === '########') return 0;

    var isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }

    var usMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (usMatch) {
      var year = usMatch[3] ? Number(usMatch[3]) : 2000;
      if (year < 100) year += 2000;
      return Date.UTC(year, Number(usMatch[1]) - 1, Number(usMatch[2]));
    }

    var parsed = Date.parse(input);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function normalizeReview(row) {
    return {
      id: row.id || '',
      reviewerName: repairMojibake(row.reviewer_name || row.reviewerName || ''),
      reviewerAvatarUrl: row.reviewer_avatar_url || row.reviewerAvatarUrl || '',
      reviewText: repairMojibake(row.review_text || row.reviewText || ''),
      rating: Number(row.rating) || 0,
      reviewDate: row.review_date || row.reviewDate || '',
      reviewUrl: row.review_url || row.reviewUrl || ''
    };
  }

  function sortLatestFirst(reviews) {
    return reviews.slice().sort(function (a, b) {
      var delta = reviewDateTimestamp(b.reviewDate) - reviewDateTimestamp(a.reviewDate);
      if (delta !== 0) return delta;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function averageRating(reviews) {
    var withRatings = reviews.filter(function (review) {
      return review.rating > 0;
    });

    if (!withRatings.length) return null;

    var total = withRatings.reduce(function (sum, review) {
      return sum + review.rating;
    }, 0);

    return (total / withRatings.length).toFixed(1);
  }

  function formatAverageRating(value) {
    if (value === null || value === undefined || value === '') return '';
    var numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    if (Math.abs(numeric - Math.round(numeric)) < 0.001) {
      return String(Math.round(numeric));
    }
    return numeric.toFixed(1);
  }

  function buildMetricMarkup(valueText) {
    var metricValue = String(valueText || '').trim();
    if (metricValue) {
      return (
        '<span class="bd-manual-reviews-cards__metric-rating">' +
          '<span class="bd-manual-reviews-cards__metric-stars" aria-hidden="true">' + stars(5) + '</span>' +
          '<span class="bd-manual-reviews-cards__metric-value">Rated ' + escapeHtml(metricValue) + '</span>' +
        '</span>'
      );
    }
    return '';
  }

  function buildCard(review, settings) {
    var topParts = [];
    var trustMetaHtml = '';
    var ratingMetaParts = [];
    var linkHtml = '';
    var formattedReviewDate = formatReviewDate(review.reviewDate);
    var reviewText = repairMojibake(review.reviewText || '');
    var facebookIcon = facebookIconMarkup(settings.facebookIconMarkup, 'bd-manual-reviews-card__trust-icon');

    if (settings.showAvatar === 'true') {
      if (review.reviewerAvatarUrl) {
        topParts.push(
          '<span class="bd-manual-reviews-card__avatar-wrap">' +
            '<img class="bd-manual-reviews-card__avatar" src="' +
              escapeHtml(review.reviewerAvatarUrl) +
              '" alt="' +
              escapeHtml(review.reviewerName) +
              '" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\';">' +
            '<span class="bd-manual-reviews-card__avatar-placeholder bd-manual-reviews-card__avatar-placeholder--image" style="display:none;">' +
              escapeHtml(initials(review.reviewerName || 'F')) +
            '</span>' +
          '</span>'
        );
      } else {
        topParts.push(
          '<span class="bd-manual-reviews-card__avatar-placeholder">' +
            escapeHtml(initials(review.reviewerName || 'F')) +
          '</span>'
        );
      }
    }

    trustMetaHtml = (
      '<span class="bd-manual-reviews-card__trust-meta">' +
        facebookIcon +
        '<span class="bd-manual-reviews-card__trust-label">Verified Facebook Review</span>' +
      '</span>'
    );

    if (settings.showRating === 'true' && review.rating > 0) {
      ratingMetaParts.push('<span class="bd-manual-reviews-card__stars">' + stars(review.rating) + '</span>');
    }

    if (settings.showReviewDate === 'true' && formattedReviewDate) {
      ratingMetaParts.push('<span>' + escapeHtml(formattedReviewDate) + '</span>');
    }

    if (settings.showReviewLink === 'true' && review.reviewUrl) {
      linkHtml =
        '<a class="bd-manual-reviews-card__link" href="' +
        escapeHtml(review.reviewUrl) +
        '" target="_blank" rel="noopener">' +
          '<span class="bd-manual-reviews-card__link-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" role="presentation" focusable="false">' +
              '<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.023 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.03 1.792-4.706 4.533-4.706 1.313 0 2.686.236 2.686.236v2.973H15.83c-1.49 0-1.955.93-1.955 1.887v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.096 24 18.1 24 12.073Z" fill="currentColor"/>' +
            '</svg>' +
          '</span>' +
          '<span class="bd-manual-reviews-card__link-label">' +
            escapeHtml(settings.reviewLinkLabel || 'View review') +
          '</span>' +
        '</a>';
    }

    return (
      '<article class="bd-manual-reviews-card">' +
        '<div class="bd-manual-reviews-card__top">' +
          topParts.join('') +
          '<div class="bd-manual-reviews-card__identity">' +
            '<p class="bd-manual-reviews-card__name">' + escapeHtml(review.reviewerName || 'Facebook customer') + '</p>' +
            '<div class="bd-manual-reviews-card__trust-row">' + trustMetaHtml + '</div>' +
            '<div class="bd-manual-reviews-card__rating-row">' + ratingMetaParts.join('') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bd-manual-reviews-card__body-wrap">' +
          '<p class="bd-manual-reviews-card__body">' + escapeHtml(reviewText) + '</p>' +
        '</div>' +
        linkHtml +
      '</article>'
    );
  }

  function setupReadMore(track) {
    track.querySelectorAll('.bd-manual-reviews-card').forEach(function (card) {
      var wrap = card.querySelector('.bd-manual-reviews-card__body-wrap');
      var body = card.querySelector('.bd-manual-reviews-card__body');
      if (!wrap || !body) return;

      var existing = wrap.querySelector('[data-bd-manual-reviews-more]');
      if (existing) existing.remove();
      body.classList.remove('is-expanded', 'is-collapsed');

      if (body.scrollHeight <= body.clientHeight + 2) return;

      body.classList.add('is-collapsed');

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'bd-manual-reviews-card__more';
      button.setAttribute('data-bd-manual-reviews-more', '');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Read more';
      wrap.appendChild(button);
    });
  }

  function setupRail(root, totalReviews, dotsHost, prev, next) {
    var track = root.querySelector('[data-bd-manual-reviews-track]');
    var viewport = root.querySelector('[data-bd-manual-reviews-viewport]');
    if (!track || !viewport) return;

    var desktopVisible = parseInt(root.getAttribute('data-desktop-visible-cards') || '4', 10);
    var mobileDotsEnabled = root.getAttribute('data-show-nav-dots-mobile') === 'true';
    var desktopArrowsEnabled = root.getAttribute('data-show-nav-arrows-desktop') === 'true';
    var loopEnabled = root.getAttribute('data-enable-endless-loop') === 'true';
    var autoRotateEnabled = root.getAttribute('data-enable-auto-rotate') === 'true';
    var autoRotateInterval = Math.max(3000, (parseInt(root.getAttribute('data-auto-rotate-interval') || '4', 10) || 4) * 1000);
    var settleTimer = null;
    var autoRotateTimer = null;
    var loopActive = false;
    var currentIndex = 0;

    function isMobile() {
      return window.matchMedia('(max-width: 749px)').matches;
    }

    function cardsPerView() {
      return isMobile() ? 1 : desktopVisible;
    }

    function maxLinearIndex() {
      return Math.max(0, totalReviews - cardsPerView());
    }

    function maxLoopIndex() {
      return Math.max(0, totalReviews - 1);
    }

    function maxIndex() {
      return loopActive ? maxLoopIndex() : maxLinearIndex();
    }

    function pageCount() {
      return Math.max(1, maxIndex() + 1);
    }

    function clearLoopMarkup() {
      Array.prototype.slice.call(track.querySelectorAll('[data-clone]')).forEach(function (node) {
        node.remove();
      });
    }

    function getRealCards() {
      return Array.prototype.slice.call(track.querySelectorAll('.bd-manual-reviews-card:not([data-clone])'));
    }

    function markRealCards() {
      getRealCards().forEach(function (card, index) {
        card.setAttribute('data-review-index', String(index));
      });
    }

    function buildLoopMarkup() {
      clearLoopMarkup();
      loopActive = loopEnabled && totalReviews > cardsPerView();
      if (!loopActive) return;

      var cards = getRealCards();
      if (!cards.length) return;

      var prepend = document.createDocumentFragment();
      var append = document.createDocumentFragment();

      cards.forEach(function (card, index) {
        var before = card.cloneNode(true);
        before.setAttribute('data-clone', 'before');
        before.setAttribute('data-review-index', String(index));
        prepend.appendChild(before);

        var after = card.cloneNode(true);
        after.setAttribute('data-clone', 'after');
        after.setAttribute('data-review-index', String(index));
        append.appendChild(after);
      });

      track.insertBefore(prepend, track.firstChild);
      track.appendChild(append);
    }

    function getFirstRealCard() {
      return track.querySelector('.bd-manual-reviews-card:not([data-clone])');
    }

    function cardOffsetForIndex(index, clonePosition) {
      var selector = '.bd-manual-reviews-card[data-review-index="' + index + '"]';
      if (clonePosition === 'before') {
        selector += '[data-clone="before"]';
      } else if (clonePosition === 'after') {
        selector += '[data-clone="after"]';
      } else {
        selector += ':not([data-clone])';
      }
      var target = track.querySelector(selector);
      return target ? target.offsetLeft : 0;
    }

    function nearestCard() {
      var children = Array.prototype.slice.call(track.children);
      var currentLeft = viewport.scrollLeft;
      var nearest = null;
      var smallest = Infinity;

      children.forEach(function (child) {
        var delta = Math.abs(currentLeft - child.offsetLeft);
        if (delta < smallest) {
          smallest = delta;
          nearest = child;
        }
      });

      return nearest;
    }

    function syncArrows() {
      var visible = desktopArrowsEnabled && !isMobile() && totalReviews > cardsPerView();
      root.querySelectorAll('.bd-manual-reviews-cards__nav').forEach(function (node) {
        node.classList.toggle('is-hidden', !visible);
      });
    }

    function renderDots() {
      if (!dotsHost) return;

      var count = pageCount();
      dotsHost.innerHTML = '';

      if (!mobileDotsEnabled || count <= 1 || !isMobile()) {
        dotsHost.classList.add('is-hidden');
        return;
      }

      dotsHost.classList.remove('is-hidden');

      for (var i = 0; i < count; i += 1) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'bd-manual-reviews-cards__dot' + (i === currentIndex ? ' is-active' : '');
        button.setAttribute('aria-label', 'Go to review ' + (i + 1));
        button.addEventListener('click', (function (dotIndex) {
          return function () {
            currentIndex = dotIndex;
            syncPage();
          };
        })(i));
        dotsHost.appendChild(button);
      }
    }

    function jumpToIndex(index) {
      var targetLeft = cardOffsetForIndex(index);
      viewport.scrollTo({
        left: targetLeft,
        behavior: 'auto'
      });
    }

    function syncPage(direction) {
      var targetIndex = currentIndex;
      if (!loopActive) {
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex > maxLinearIndex()) targetIndex = maxLinearIndex();
      } else {
        if (targetIndex < 0) targetIndex = maxLoopIndex();
        if (targetIndex > maxLoopIndex()) targetIndex = 0;
      }
      var targetLeft = cardOffsetForIndex(targetIndex);

      if (loopActive && direction === 'next' && currentIndex === maxLoopIndex() && targetIndex === 0) {
        targetLeft = cardOffsetForIndex(0, 'after');
      } else if (loopActive && direction === 'prev' && currentIndex === 0 && targetIndex === maxLoopIndex()) {
        targetLeft = cardOffsetForIndex(maxLoopIndex(), 'before');
      }

      viewport.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });

      currentIndex = targetIndex;
      renderDots();
      syncArrows();
    }

    function stopAutoRotate() {
      if (autoRotateTimer) {
        window.clearInterval(autoRotateTimer);
        autoRotateTimer = null;
      }
    }

    function startAutoRotate() {
      stopAutoRotate();
      if (!autoRotateEnabled || totalReviews <= 1) return;

      autoRotateTimer = window.setInterval(function () {
        if (document.hidden) return;
        currentIndex = loopActive
          ? ((currentIndex + 1) % totalReviews)
          : (currentIndex >= maxLinearIndex() ? 0 : currentIndex + 1);
        syncPage('next');
      }, autoRotateInterval);
    }

    function normalizeLoopPosition() {
      if (!loopActive) return;

      var nearest = nearestCard();
      if (!nearest) return;

      var rawIndex = Number(nearest.getAttribute('data-review-index') || 0);
      currentIndex = Math.max(0, Math.min(maxLoopIndex(), rawIndex));

      if (nearest.hasAttribute('data-clone')) {
        jumpToIndex(currentIndex);
      }

      renderDots();
      syncArrows();
    }

    function handleScroll() {
      var nearest = nearestCard();
      if (!nearest) return;

      var rawIndex = Number(nearest.getAttribute('data-review-index') || 0);
      currentIndex = Math.max(0, Math.min(maxIndex(), rawIndex));
      renderDots();
      syncArrows();

      if (settleTimer) {
        window.clearTimeout(settleTimer);
      }

      settleTimer = window.setTimeout(function () {
        normalizeLoopPosition();
      }, 90);
    }

    markRealCards();
    buildLoopMarkup();
    setupReadMore(track);

    var firstReal = getFirstRealCard();
    if (firstReal) {
      viewport.scrollLeft = firstReal.offsetLeft;
    }

    if (prev) {
      prev.onclick = function () {
        currentIndex = loopActive
          ? ((currentIndex - 1 + totalReviews) % totalReviews)
          : Math.max(0, currentIndex - 1);
        syncPage('prev');
      };
    }

    if (next) {
      next.onclick = function () {
        currentIndex = loopActive
          ? ((currentIndex + 1) % totalReviews)
          : Math.min(maxLinearIndex(), currentIndex + 1);
        syncPage('next');
      };
    }

    viewport.onscroll = handleScroll;

    root.addEventListener('mouseenter', stopAutoRotate);
    root.addEventListener('mouseleave', startAutoRotate);
    root.addEventListener('focusin', stopAutoRotate);
    root.addEventListener('focusout', startAutoRotate);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopAutoRotate();
      } else {
        startAutoRotate();
      }
    });

    syncArrows();
    renderDots();
    startAutoRotate();

    window.addEventListener('resize', function () {
      stopAutoRotate();
      currentIndex = Math.max(0, Math.min(currentIndex, loopActive ? maxLoopIndex() : maxLinearIndex()));
      clearLoopMarkup();
      markRealCards();
      buildLoopMarkup();
      currentIndex = Math.max(0, Math.min(currentIndex, loopActive ? maxLoopIndex() : maxLinearIndex()));
      setupReadMore(track);
      jumpToIndex(loopActive ? (currentIndex % totalReviews) : currentIndex);
      syncArrows();
      renderDots();
      startAutoRotate();
    });
  }

  function mountSection(root) {
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    var feedUrl = root.getAttribute('data-feed-url');
    var localUrl = root.getAttribute('data-local-url');
    var maxReviews = parseInt(root.getAttribute('data-max-reviews') || '20', 10);
    var track = root.querySelector('[data-bd-manual-reviews-track]');
    var status = root.querySelector('[data-bd-manual-reviews-status]');
    var ratingSummary = root.querySelector('[data-bd-manual-reviews-rating-summary]');
    var headingCount = root.querySelector('[data-bd-manual-reviews-heading-count]');
    var sourceLabel = root.querySelector('[data-bd-manual-reviews-source-label]');
    var dotsHost = root.querySelector('[data-bd-manual-reviews-dots]');
    var prev = root.querySelector('[data-bd-manual-reviews-prev]');
    var next = root.querySelector('[data-bd-manual-reviews-next]');
    var settings = {
      showAvatar: root.getAttribute('data-show-avatar'),
      showRating: root.getAttribute('data-show-rating'),
      showReviewDate: root.getAttribute('data-show-review-date'),
      showReviewLink: root.getAttribute('data-show-review-link'),
      reviewLinkLabel: root.getAttribute('data-review-link-label'),
      facebookIconMarkup: root.getAttribute('data-facebook-icon')
    };

    if (!track) return;

    if (!feedUrl && !localUrl) {
      if (status) status.textContent = 'Add a review data source to load reviews.';
      return;
    }

    root.addEventListener('click', function (event) {
      var toggle = event.target.closest('[data-bd-manual-reviews-more]');
      if (!toggle) return;

      var body = toggle.parentElement && toggle.parentElement.querySelector('.bd-manual-reviews-card__body');
      var card = toggle.closest('.bd-manual-reviews-card');
      if (!body) return;

      var isExpanded = body.classList.toggle('is-expanded');
      body.classList.toggle('is-collapsed', !isExpanded);
      if (card) {
        card.classList.toggle('is-expanded', isExpanded);
      }
      toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggle.textContent = isExpanded ? 'Read less' : 'Read more';
    });

    function loadSource(url) {
      return fetch(url).then(function (response) {
        if (!response.ok) throw new Error('Review source request failed');
        return response.text();
      });
    }

    function parseSource(text) {
      var trimmed = String(text || '').trim();
      if (!trimmed) throw new Error('No review data found');

      if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        var parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return sortLatestFirst(parsed.map(normalizeReview)).slice(0, maxReviews);
        }
        if (parsed && Array.isArray(parsed.reviews)) {
          return sortLatestFirst(parsed.reviews.map(normalizeReview)).slice(0, maxReviews);
        }
        throw new Error('Unsupported JSON review shape');
      }

      var rows = parseCsv(trimmed);
      if (!rows.length) throw new Error('No review data found');

      var headers = rows[0];
      var records = rows.slice(1).map(function (row) {
        var record = {};
        headers.forEach(function (header, index) {
          record[header] = row[index] || '';
        });
        return record;
      }).filter(function (record) {
        return String(record.is_visible || '').toLowerCase() === 'true' &&
          String(record.review_text || '').trim() !== '';
      });

      return sortLatestFirst(records.map(normalizeReview)).slice(0, maxReviews);
    }

    function renderReviews(reviews) {
      if (!reviews.length) throw new Error('No visible reviews found');

      track.innerHTML = reviews.map(function (review) {
        return buildCard(review, settings);
      }).join('');

      setupReadMore(track);

      if (status) {
        status.textContent = '';
        status.classList.add('is-hidden');
      }

      var avg = averageRating(reviews);
      var summaryText = avg ? formatAverageRating(avg) + '/5' : '';
      if (sourceLabel) {
        if (root.getAttribute('data-show-source-label') === 'true') {
          sourceLabel.classList.remove('is-hidden');
        } else {
          sourceLabel.classList.add('is-hidden');
        }
      }
      var metricMarkup = buildMetricMarkup(summaryText);
      var placement = root.getAttribute('data-top-metric-placement') || 'right';
      var isMobile = window.matchMedia('(max-width: 749px)').matches;
      var showHeadingMetric = isMobile || placement === 'inline';

      if (ratingSummary) {
        if (root.getAttribute('data-show-rating-summary') === 'true' && !showHeadingMetric) {
          ratingSummary.innerHTML = metricMarkup;
          ratingSummary.classList.remove('is-hidden');
        } else {
          ratingSummary.classList.add('is-hidden');
        }
      }

      if (headingCount) {
        if (showHeadingMetric) {
          headingCount.innerHTML = metricMarkup;
          headingCount.classList.remove('is-hidden');
        } else {
          headingCount.innerHTML = '';
          headingCount.classList.add('is-hidden');
        }
      }

      setupRail(root, reviews.length, dotsHost, prev, next);
    }

    var requestedUrl = feedUrl || localUrl;

    loadSource(requestedUrl)
      .then(parseSource)
      .then(renderReviews)
      .catch(function () {
        if (feedUrl && localUrl && requestedUrl !== localUrl) {
          return loadSource(localUrl).then(parseSource).then(renderReviews);
        }
        throw new Error('Review source request failed');
      })
      .catch(function (error) {
        if (status) status.textContent = 'Unable to load reviews right now.';
        if (window.console && console.warn) {
          console.warn('Manual reviews feed error:', error);
        }
      });
  }

  function init() {
    document.querySelectorAll('[data-bd-manual-reviews]').forEach(mountSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
