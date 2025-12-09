#!/usr/bin/env node
/**
 * Standalone worker that fetches the DHA RSS feed and inserts new articles
 * using the existing DataService. No changes to server code are required.
 */

const https = require('https');
const { promisify } = require('util');
const xml2js = require('xml2js');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const stream = require('stream');
const sharp = require('sharp');

const DataService = require('../server/services/data-service');
const urlSlugService = require('../server/services/url-slug');

/**
 * Edit SETTINGS below to control how the RSS worker behaves.
 * These values are intentionally hardcoded for easier customization.
 */
const SETTINGS = {
  writerName: 'UHA İzmir',
  maxImages: 2,
  maxVideos: 1,
  fallbackCategory: 'Gündem',
  bannedTopics: [],
  defaultLimit: 20,
  defaultFeedUrl: 'https://dhaabone.dha.com.tr/rss/1719/k9quL7DqdugGLn4kKrTMzmHbRWQN5JQZ4wfCwMuJiOE64o3-B7R_qu33sYG8kMYZHDqtewhItlDOPuc=',
  defaultLogFile: null,
  defaultDryRun: false,
  maxVideoBytes: 50 * 1024 * 1024 // 50 MB
};

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
const parseXml = promisify(parser.parseString);
const pipeline = promisify(stream.pipeline);

const args = processArgs(process.argv.slice(2));
const dataService = new DataService();
const RSS_MEDIA_DIR = path.join(__dirname, '../public/uploads/media/rss');
const RSS_MEDIA_WEB_PATH = '/uploads/media/rss';
const RSS_VIDEO_DIR = path.join(RSS_MEDIA_DIR, 'videos');
const RSS_VIDEO_WEB_PATH = `${RSS_MEDIA_WEB_PATH}/videos`;
const MAX_VIDEO_BYTES = SETTINGS.maxVideoBytes;

function processArgs(argv) {
  const options = {
    limit: SETTINGS.defaultLimit,
    dryRun: SETTINGS.defaultDryRun,
    logFile: SETTINGS.defaultLogFile,
    feedUrl: SETTINGS.defaultFeedUrl
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit' && argv[i + 1]) {
      options.limit = parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--log' && argv[i + 1]) {
      options.logFile = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--feed' && argv[i + 1]) {
      options.feedUrl = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Unexpected status code ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function summarizeHead(descriptionText) {
  const sentence = descriptionText.split(/(?<=\.)\s/)[0];
  return sentence || descriptionText.slice(0, 140);
}

function summarizeBody(descriptionText) {
  const max = 300;
  if (descriptionText.length <= max) return descriptionText;
  return `${descriptionText.slice(0, max - 1)}…`;
}

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

function extractMedia(item) {
  const mediaEntries = ensureArray(item.mediaList?.media).map((media) => ({
    type: media.type || 'UNKNOWN',
    link: media.link
  })).filter((media) => !!media.link);

  const images = mediaEntries
    .filter((m) => m.type === 'IMAGE')
    .slice(0, SETTINGS.maxImages);
  const videos = mediaEntries
    .filter((m) => m.type === 'VIDEO')
    .slice(0, SETTINGS.maxVideos);

  return {
    images,
    videos
  };
}

function ensureMediaDirectory() {
  if (!fs.existsSync(RSS_MEDIA_DIR)) {
    fs.mkdirSync(RSS_MEDIA_DIR, { recursive: true });
  }
}

function ensureVideoDirectory() {
  if (!fs.existsSync(RSS_VIDEO_DIR)) {
    fs.mkdirSync(RSS_VIDEO_DIR, { recursive: true });
  }
}

function buildImageFilename(item, index, imageUrl) {
  let ext = '.jpg';
  try {
    const urlObj = new URL(imageUrl);
    const pathname = urlObj.pathname || '';
    const candidate = path.extname(pathname);
    if (candidate) {
      ext = candidate.split('?')[0] || ext;
    }
  } catch (error) {
    // ignore, keep default
  }

  const safeExt = ext && ext.length <= 5 ? ext : '.jpg';
  const base = (item.newsId || `rss-${Date.now()}`).toString().replace(/[^a-zA-Z0-9-_]/g, '');
  return `${base}-${index}${safeExt}`;
}

async function downloadImageAsset(imageUrl, diskPath) {
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Image download failed (${res.statusCode}) for ${imageUrl}`));
        res.resume();
        return;
      }

      pipeline(res, fs.createWriteStream(diskPath))
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}

async function processImageEntry(item, imageUrl, index, downloadAssets) {
  const commonMeta = {
    alt: stripHtml(item.title || ''),
    title: stripHtml(item.title || '')
  };

  if (!downloadAssets) {
    return {
      url: imageUrl,
      lowRes: imageUrl,
      highRes: imageUrl,
      ...commonMeta
    };
  }

  ensureMediaDirectory();
  const filename = buildImageFilename(item, index, imageUrl);
  const diskPath = path.join(RSS_MEDIA_DIR, filename);

  try {
    if (!fs.existsSync(diskPath)) {
      await downloadImageAsset(imageUrl, diskPath);
    }

    let metadata = {};
    try {
      metadata = await sharp(diskPath).metadata();
    } catch (error) {
      metadata = {};
    }

    const relativePath = `${RSS_MEDIA_WEB_PATH}/${filename}`;
    return {
      url: relativePath,
      lowRes: relativePath,
      highRes: relativePath,
      width: metadata.width || 800,
      height: metadata.height || 600,
      ...commonMeta
    };
  } catch (error) {
    log(`  ⚠️  Image download failed: ${error.message}`);
    return null;
  }
}

async function prepareImages(item, mediaImages, downloadAssets) {
  if (!mediaImages.length) {
    return [];
  }

  const processed = await Promise.all(
    mediaImages.map((img, index) => processImageEntry(item, img.link, index, downloadAssets))
  );

  return processed.filter(Boolean);
}

function buildVideoFilename(item, index, videoUrl) {
  let ext = '.mp4';
  try {
    const urlObj = new URL(videoUrl);
    const pathname = urlObj.pathname || '';
    const candidate = path.extname(pathname);
    if (candidate) {
      ext = candidate.split('?')[0] || ext;
    }
  } catch (error) {
    // ignore
  }

  const safeExt = ext && ext.length <= 5 ? ext : '.mp4';
  const base = (item.newsId || `rss-${Date.now()}`).toString().replace(/[^a-zA-Z0-9-_]/g, '');
  return `${base}-${index}${safeExt}`;
}

async function downloadVideoAsset(videoUrl, diskPath) {
  return new Promise((resolve, reject) => {
    https.get(videoUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Video download failed (${res.statusCode}) for ${videoUrl}`));
        res.resume();
        return;
      }

      const contentLength = parseInt(res.headers['content-length'] || '0', 10);
      if (contentLength && contentLength > MAX_VIDEO_BYTES) {
        reject(new Error(`Video too large (${contentLength} bytes)`));
        res.resume();
        return;
      }

      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (downloaded > MAX_VIDEO_BYTES) {
          res.destroy(new Error(`Video exceeded size limit (${MAX_VIDEO_BYTES} bytes)`));
        }
      });

      pipeline(res, fs.createWriteStream(diskPath))
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}

async function processVideoEntry(item, videoEntry, downloadAssets) {
  if (!videoEntry || !videoEntry.link) {
    return '';
  }

  if (!downloadAssets) {
    return videoEntry.link;
  }

  ensureVideoDirectory();
  const filename = buildVideoFilename(item, 0, videoEntry.link);
  const diskPath = path.join(RSS_VIDEO_DIR, filename);

  try {
    if (!fs.existsSync(diskPath)) {
      await downloadVideoAsset(videoEntry.link, diskPath);
    }
    return `${RSS_VIDEO_WEB_PATH}/${filename}`;
  } catch (error) {
    log(`  ⚠️  Video download failed: ${error.message}`);
    return videoEntry.link;
  }
}

function toIsoDate(pubDate) {
  if (!pubDate) return new Date().toISOString();
  const normalized = pubDate.replace(' ', 'T');
  const date = new Date(`${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

async function buildArticlePayload(item, downloadAssets) {
  const descriptionHtml = item.description || '';
  const descriptionText = stripHtml(descriptionHtml);
  const media = extractMedia(item);

  let images = await prepareImages(item, media.images, downloadAssets);
  if (!images.length) {
    images = media.images.map((img) => ({
      url: img.link,
      lowRes: img.link,
      highRes: img.link,
      alt: stripHtml(item.title || ''),
      title: stripHtml(item.title || '')
    }));
  }

  const tags = [];
  if (item.category) tags.push(item.category);
  if (item.location) tags.push(item.location);
  if (item.district) tags.push(item.district);
  const videoUrl = await processVideoEntry(item, media.videos[0], downloadAssets);

  return {
    header: stripHtml(item.title || 'DHA Haberi'),
    summaryHead: summarizeHead(descriptionText),
    summary: summarizeBody(descriptionText),
    category: item.category || 'Genel',
    tags,
    body: descriptionHtml,
    images,
    headlineImage: images[0] || null,
    videoUrl,
    writer: item.author?.trim() || SETTINGS.writerName,
    creationDate: toIsoDate(item.pubDate),
    source: 'DHA RSS',
    outlinks: item.link ? [item.link] : [],
    targettedViews: item.category === 'Flaş Haber' ? ['flash-news'] : [],
    relatedArticles: [],
    status: 'visible',
    pressAnnouncementId: '',
    created_by: 'rss-worker'
  };
}

function buildArticleKey(payload) {
  const hash = crypto.createHash('sha1');
  hash.update(`${payload.header}::${payload.creationDate}`);
  return hash.digest('hex');
}

function findExistingArticle(payload) {
  const searchResults = dataService.getArticles({
    search: payload.header,
    limit: 5
  });

  const match = searchResults.articles.find((article) => {
    if (!article || !article.creationDate) return false;
    return (
      article.creationDate === payload.creationDate ||
      article.header === payload.header
    );
  });

  return match || null;
}

function log(message) {
  console.log(message);
  if (args.logFile) {
    fs.appendFileSync(args.logFile, `[${new Date().toISOString()}] ${message}\n`, 'utf-8');
  }
}

async function run() {
  log(`🔄 Starting DHA RSS worker (dryRun=${args.dryRun}, limit=${args.limit || '∞'})`);

  try {
    const xml = await fetchFeed(args.feedUrl);
    const parsed = await parseXml(xml);
    const rawItems = parsed?.rss?.channel?.item;
    if (!rawItems) {
      throw new Error('No RSS items found');
    }

    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    const limitedItems = Number.isFinite(args.limit) ? items.slice(0, args.limit) : items;

    let inserted = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const item of limitedItems) {
      let payload = await buildArticlePayload(item, false);
      const key = buildArticleKey(payload);
      log(`• Processing ${payload.header} (${item.newsId || 'no-id'}) [${key.slice(0, 8)}]`);

      const existing = findExistingArticle(payload);
      if (existing) {
        duplicates += 1;
        const existingHeader = existing.header || existing.title || payload.header;
        await urlSlugService.getSlugForArticle(existing.id, existingHeader);
        log(`  ↳ Skipped (duplicate of ${existing.id}), slug ensured`);
        continue;
      }

      if (args.dryRun) {
        skipped += 1;
        log('  ↳ Dry run: payload prepared but not inserted.');
        continue;
      }

      payload = await buildArticlePayload(item, true);
      const created = dataService.createArticle(payload);
      await urlSlugService.getSlugForArticle(created.id, created.header || payload.header);
      inserted += 1;
      log('  ↳ Inserted ✅');
    }

    log('------');
    log(`Inserted: ${inserted}`);
    log(`Dry-run skipped: ${skipped}`);
    log(`Duplicates skipped: ${duplicates}`);
  } catch (error) {
    console.error('❌ Worker failed:', error.message);
    process.exitCode = 1;
  } finally {
    dataService.close();
  }
}

run();

