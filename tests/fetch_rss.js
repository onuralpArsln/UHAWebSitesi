const https = require('https');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const xml2js = require('xml2js');

const rssUrl = 'https://dhaabone.dha.com.tr/rss/1719/k9quL7DqdugGLn4kKrTMzmHbRWQN5JQZ4wfCwMuJiOE64o3-B7R_qu33sYG8kMYZHDqtewhItlDOPuc=';
const outputXmlPath = path.join(__dirname, 'dha_rss.xml');
const outputSummaryPath = path.join(__dirname, 'rss_dump.json');

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
const parseXml = promisify(parser.parseString);

const fetchFeed = () => new Promise((resolve, reject) => {
  https.get(rssUrl, (res) => {
    if (res.statusCode !== 200) {
      reject(new Error(`Unexpected status code ${res.statusCode}`));
      return;
    }
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  }).on('error', reject);
});

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const summarizeItem = (item) => {
  const mediaList = ensureArray(item.mediaList?.media).map((media) => ({
    id: media.id || null,
    type: media.type || 'UNKNOWN',
    link: media.link
  }));

  const images = mediaList.filter((m) => m.type === 'IMAGE');
  const videos = mediaList.filter((m) => m.type === 'VIDEO');
  const descriptionText = stripHtml(item.description || '');

  return {
    newsId: item.newsId,
    title: stripHtml(item.title || ''),
    link: item.link,
    category: item.category || 'Unknown',
    author: item.author || '',
    location: item.location || '',
    district: item.district || '',
    pubDate: item.pubDate,
    descriptionLength: descriptionText.length,
    descriptionPreview: descriptionText.slice(0, 280),
    media: {
      total: mediaList.length,
      images: images.length,
      videos: videos.length,
      firstImage: images[0]?.link || null,
      firstVideo: videos[0]?.link || null
    }
  };
};

const summarizeFeed = (items = []) => {
  const perItem = items.map(summarizeItem);

  const categoryCounts = perItem.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const mediaTotals = perItem.reduce((acc, item) => {
    acc.images += item.media.images;
    acc.videos += item.media.videos;
    acc.total += item.media.total;
    return acc;
  }, { images: 0, videos: 0, total: 0 });

  return {
    fetchedAt: new Date().toISOString(),
    itemCount: perItem.length,
    categoryCounts,
    mediaTotals,
    topItems: perItem.slice(0, 5),
    items: perItem
  };
};

async function run() {
  console.log('⏳ Fetching RSS feed...');
  try {
    const xmlContent = await fetchFeed();
    fs.writeFileSync(outputXmlPath, xmlContent, 'utf-8');
    console.log(`✅ RSS XML saved to ${outputXmlPath}`);

    const parsed = await parseXml(xmlContent);
    const items = parsed?.rss?.channel?.item;
    if (!items || (Array.isArray(items) && items.length === 0)) {
      throw new Error('No <item> entries found in RSS');
    }

    const normalizedItems = Array.isArray(items) ? items : [items];
    const summary = summarizeFeed(normalizedItems);
    fs.writeFileSync(outputSummaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`🗂️ Summary saved to ${outputSummaryPath}`);
    console.log(`📊 Items: ${summary.itemCount} | Categories: ${Object.keys(summary.categoryCounts).length}`);
  } catch (error) {
    console.error('❌ Error fetching RSS:', error.message);
    process.exitCode = 1;
  }
}

run();