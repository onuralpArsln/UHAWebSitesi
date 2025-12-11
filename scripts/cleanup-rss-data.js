#!/usr/bin/env node
/**
 * Cleanup script for RSS-imported articles:
 * - Deduplicate by pressAnnouncementId (RSS newsId or link hash)
 * - Optionally convert remote DHA image URLs to locally downloaded files
 *
 * Flags:
 *   --dry-run       : Log actions without modifying data
 *   --skip-images   : Skip remote image downloads/fixes
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const stream = require('stream');
const { promisify } = require('util');
const crypto = require('crypto');

const DataService = require('../server/services/data-service');
const urlSlugService = require('../server/services/url-slug');

const pipeline = promisify(stream.pipeline);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_IMAGES = args.includes('--skip-images');

const RSS_MEDIA_DIR = path.join(__dirname, '../public/uploads/media/rss');
const REQUEST_HEADERS = {
  'User-Agent': 'UHA-RSS-Cleanup/1.0 (+uha)',
  Accept: 'image/*,*/*;q=0.8'
};
const MAX_REDIRECTS = 3;

function log(msg) {
  console.log(msg);
}

function ensureMediaDir() {
  if (!fs.existsSync(RSS_MEDIA_DIR)) {
    fs.mkdirSync(RSS_MEDIA_DIR, { recursive: true });
  }
}

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeImageEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { url: entry, lowRes: entry, highRes: entry };
  }
  if (typeof entry === 'object') {
    return {
      url: entry.url || entry.highRes || entry.lowRes,
      lowRes: entry.lowRes || entry.url,
      highRes: entry.highRes || entry.url,
      alt: entry.alt || entry.title || '',
      title: entry.title || entry.alt || '',
      width: entry.width,
      height: entry.height
    };
  }
  return null;
}

function extFromUrl(url) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname || '');
    if (ext && ext.length <= 5) return ext;
  } catch (error) {
    // ignore
  }
  return '.jpg';
}

function fetchWithRedirects(url, depth = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: REQUEST_HEADERS }, (res) => {
      const { statusCode, headers } = res;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        if (depth >= MAX_REDIRECTS) {
          res.resume();
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        const nextUrl = new URL(headers.location, url).toString();
        res.resume();
        resolve(fetchWithRedirects(nextUrl, depth + 1));
        return;
      }

      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`Unexpected status ${statusCode} for ${url}`));
        return;
      }

      resolve(res);
    }).on('error', reject);
  });
}

async function downloadImage(url, destPath) {
  const response = await fetchWithRedirects(url);
  await pipeline(response, fs.createWriteStream(destPath));
}

async function localizeImagesForArticle(article) {
  const images = Array.isArray(article.images) ? article.images : [];
  const normalized = images.map(normalizeImageEntry).filter(Boolean);
  if (!normalized.length) return { updated: false, images: [], headlineImage: null };

  ensureMediaDir();

  const updatedImages = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const img = normalized[i];
    const source = img.highRes || img.url || img.lowRes;
    if (!isRemoteUrl(source)) {
      updatedImages.push(img);
      continue;
    }

    const filename = `${article.id}-${i}${extFromUrl(source)}`;
    const diskPath = path.join(RSS_MEDIA_DIR, filename);
    const webPath = `/uploads/media/rss/${filename}`;
    try {
      if (!fs.existsSync(diskPath)) {
        await downloadImage(source, diskPath);
      }
      updatedImages.push({
        ...img,
        url: webPath,
        lowRes: webPath,
        highRes: webPath
      });
      log(`  ↳ Downloaded image -> ${webPath}`);
    } catch (error) {
      log(`  ⚠️  Failed to download ${source}: ${error.message}`);
    }
  }

  const filtered = updatedImages.filter(Boolean);
  const headlineImage = filtered[0] || null;
  return { updated: true, images: filtered, headlineImage };
}

function compareCreationDate(a, b) {
  const da = new Date(a.creationDate || a.publishedAt || 0).getTime();
  const db = new Date(b.creationDate || b.publishedAt || 0).getTime();
  return da - db;
}

function uniqueKeyForArticle(article) {
  if (article.pressAnnouncementId) return `press:${article.pressAnnouncementId}`;
  const hash = crypto.createHash('sha1');
  hash.update(`${article.header || ''}::${article.creationDate || ''}`);
  return `fallback:${hash.digest('hex')}`;
}

async function run() {
  const dataService = new DataService();
  log(`Starting cleanup (dryRun=${DRY_RUN}, skipImages=${SKIP_IMAGES})`);

  // Gather all articles
  const allArticles = [];
  const limit = 500;
  let page = 1;
  while (true) {
    const { articles, pagination } = dataService.getArticles({
      page,
      limit,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });
    allArticles.push(...articles);
    if (page >= pagination.totalPages) break;
    page += 1;
  }
  log(`Loaded ${allArticles.length} articles`);

  // Deduplicate by pressAnnouncementId
  const groups = new Map();
  for (const article of allArticles) {
    const key = uniqueKeyForArticle(article);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(article);
  }

  let dupDeleted = 0;
  for (const [, group] of groups.entries()) {
    if (group.length <= 1) continue;
    const sorted = group.slice().sort(compareCreationDate);
    const keeper = sorted[0];
    const toDelete = sorted.slice(1);
    for (const victim of toDelete) {
      log(`Duplicate: keeping ${keeper.id}, removing ${victim.id} (${victim.header})`);
      if (!DRY_RUN) {
        try {
          const slug = urlSlugService.getSlugById(victim.id);
          if (slug) {
            await urlSlugService.deleteSlug(victim.id);
          }
          dataService.deleteArticle(victim.id);
          dupDeleted += 1;
        } catch (error) {
          log(`  ⚠️  Failed to delete ${victim.id}: ${error.message}`);
        }
      }
    }
  }

  // Fix remote images
  let imagesFixed = 0;
  if (!SKIP_IMAGES) {
    for (const article of allArticles) {
      const hasRemote = Array.isArray(article.images)
        ? article.images.some((img) => {
            const normalized = normalizeImageEntry(img);
            const source = normalized?.highRes || normalized?.url || normalized?.lowRes;
            return isRemoteUrl(source);
          })
        : false;

      if (!hasRemote) continue;

      log(`Fixing images for article ${article.id} (${article.header})`);
      try {
        const { updated, images, headlineImage } = await localizeImagesForArticle(article);
        if (updated && !DRY_RUN) {
          dataService.updateArticle(article.id, {
            images,
            headlineImage
          });
          imagesFixed += 1;
        }
      } catch (error) {
        log(`  ⚠️  Failed to fix images for ${article.id}: ${error.message}`);
      }
    }
  }

  log('------');
  log(`Duplicates removed: ${dupDeleted}`);
  if (!SKIP_IMAGES) {
    log(`Articles with images fixed: ${imagesFixed}`);
  }

  dataService.close();
}

run().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exitCode = 1;
});

