#!/usr/bin/env node
/**
 * Generate poster images for articles that have a local video but no images.
 * Saves posters under /public/uploads/media/rss/video-thumbnails and updates
 * the article's images/headlineImage fields.
 */

const fs = require('fs');
const path = require('path');
const DataService = require('../server/services/data-service');
const { createPosterFromVideo } = require('../server/services/video-poster');

const MEDIA_ROOT = path.join(__dirname, '../public');
const VIDEO_THUMB_DIR = path.join(MEDIA_ROOT, 'uploads/media/rss/video-thumbnails');
const VIDEO_THUMB_WEB_PATH = '/uploads/media/rss/video-thumbnails';

function isLocalPath(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

async function backfill() {
  const dataService = new DataService();
  const limit = 500;
  let page = 1;

  const stats = {
    total: 0,
    updated: 0,
    skipped: 0
  };

  try {
    while (true) {
      const { articles, pagination } = dataService.getArticles({ page, limit });
      if (!articles.length) break;

      for (const article of articles) {
        stats.total += 1;

        const hasImage = Array.isArray(article.images) && article.images.length > 0;
        if (!isLocalPath(article.videoUrl) || hasImage) {
          stats.skipped += 1;
          continue;
        }

        const videoDiskPath = path.join(MEDIA_ROOT, article.videoUrl);
        if (!fs.existsSync(videoDiskPath)) {
          stats.skipped += 1;
          continue;
        }

        const filenameBase = path.parse(videoDiskPath).name;
        const { image } = await createPosterFromVideo({
          videoDiskPath,
          filenameBase,
          outputDir: VIDEO_THUMB_DIR,
          webBasePath: VIDEO_THUMB_WEB_PATH
        });

        if (!image) {
          stats.skipped += 1;
          continue;
        }

        dataService.updateArticle(article.id, {
          images: [image],
          headlineImage: image
        });
        stats.updated += 1;
      }

      if (!pagination || page >= pagination.totalPages) break;
      page += 1;
    }
  } finally {
    dataService.close();
  }

  console.log(`Processed ${stats.total} articles. Updated ${stats.updated}, skipped ${stats.skipped}.`);
}

backfill().catch((error) => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});

