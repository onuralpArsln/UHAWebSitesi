#!/usr/bin/env node
/**
 * Remove DHA-hosted media URLs from articles while keeping only safe local assets.
 * Run once after ingestion changes or as needed.
 */

const DataService = require('../server/services/data-service');

const isLocal = (url) => typeof url === 'string' && url.startsWith('/uploads/');
const isRemoteHttp = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);
const isPlaceholderPath = (url) => typeof url === 'string' && url.includes('/uploads/media/placeHolder.png');

function normalizeImages(images, article) {
  const safe = (images || [])
    .filter((img) => {
      const candidate = img?.lowRes || img?.url || img?.highRes;
      return isLocal(candidate) && !isPlaceholderPath(candidate);
    })
    .map((img) => ({
      ...img,
      lowRes: img.lowRes || img.url,
      highRes: img.highRes || img.lowRes || img.url
    }));

  return safe;
}

async function main() {
  const dataService = new DataService();
  try {
    const rows = dataService.db.prepare('SELECT id FROM articles').all();
    let scanned = 0;
    let updated = 0;

    for (const row of rows) {
      const article = dataService.getArticleById(row.id);
      if (!article) continue;
      scanned += 1;

      const cleanedImages = normalizeImages(article.images, article);
      const cleanedVideoUrl = isLocal(article.videoUrl) ? article.videoUrl : '';
      const cleanedHeadline = cleanedImages[0] || null;

      const changed =
        JSON.stringify(cleanedImages) !== JSON.stringify(article.images || []) ||
        cleanedVideoUrl !== (article.videoUrl || '');

      if (changed) {
        dataService.updateArticle(article.id, {
          ...article,
          images: cleanedImages,
          headlineImage: cleanedHeadline,
          videoUrl: cleanedVideoUrl
        });
        updated += 1;
      }
    }

    console.log(`Scanned: ${scanned}, Updated: ${updated}`);
  } catch (error) {
    console.error('strip-dha-media failed:', error);
    process.exitCode = 1;
  }
}

main();



