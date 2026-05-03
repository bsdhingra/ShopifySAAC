const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_FEED_URL =
  'https://docs.google.com/spreadsheets/d/1g67C9dVglF8od6OJM7cgREJxyzCmPai1-AMJT9YBAqM/export?format=csv&gid=0';

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'assets', 'manual-reviews-data.json');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          fetchText(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Request failed with status ${response.statusCode}`));
          return;
        }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

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

  return rows.filter((currentRow) => currentRow.length && currentRow.some((cell) => String(cell || '').trim() !== ''));
}

function normalizeReview(record) {
  return {
    id: record.id || '',
    source: record.source || 'facebook',
    reviewerName: record.reviewer_name || '',
    reviewerAvatarUrl: record.reviewer_avatar_url || '',
    reviewText: record.review_text || '',
    rating: Number(record.rating) || 0,
    reviewDate: record.review_date || '',
    reviewUrl: record.review_url || '',
    isFeatured: String(record.is_featured || '').toLowerCase() === 'true',
    sourcePlatform: record.source_platform || 'facebook-page-review'
  };
}

async function main() {
  const feedUrl = process.argv[2] || process.env.MANUAL_REVIEWS_FEED_URL || DEFAULT_FEED_URL;
  const csvText = await fetchText(feedUrl);
  const rows = parseCsv(csvText);

  if (!rows.length) {
    throw new Error('CSV feed returned no rows');
  }

  const headers = rows[0].map((header) => String(header || '').trim());
  const dataRows = rows.slice(1);

  const reviews = dataRows
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] || '';
      });
      return record;
    })
    .filter((record) => String(record.is_visible || '').toLowerCase() === 'true')
    .filter((record) => String(record.review_text || '').trim() !== '')
    .sort((a, b) => {
      const aSort = Number(a.sort_order);
      const bSort = Number(b.sort_order);
      return (Number.isNaN(aSort) ? 999999 : aSort) - (Number.isNaN(bSort) ? 999999 : bSort);
    })
    .map(normalizeReview);

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: reviews.length,
    reviews
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Synced ${reviews.length} reviews to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(`Manual reviews sync failed: ${error.message}`);
  process.exit(1);
});
