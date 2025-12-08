const https = require('https');
const xml2js = require('xml2js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const RSS_URL = 'https://dhaabone.dha.com.tr/rss/1719/k9quL7DqdugGLn4kKrTMzmHbRWQN5JQZ4wfCwMuJiOE64o3-B7R_qu33sYG8kMYZHDqtewhItlDOPuc=';

// Helper to fetch URL content
const fetchUrl = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
};

// Helper to get image metadata
const getImageMetadata = async (url) => {
    try {
        const buffer = await fetchUrl(url);
        const metadata = await sharp(buffer).metadata();
        return `${metadata.width}x${metadata.height}`;
    } catch (err) {
        return 'Error getting resolution: ' + err.message;
    }
};

async function run() {
    console.log('Fetching RSS Feed...');
    try {
        const xmlBuffer = await fetchUrl(RSS_URL);
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlBuffer.toString());

        const items = result.rss.channel.item;
        // Take top 5
        const newestItems = Array.isArray(items) ? items.slice(0, 5) : [items];

        const results = [];

        console.log('\n--- Newest 5 Articles Analysis ---\n');

        for (let i = 0; i < newestItems.length; i++) {
            const item = newestItems[i];
            const newsId = item.newsId;
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate;

            // Clean description to get rough text count
            const rawDesc = item.description || '';
            const textOnly = rawDesc.replace(/<[^>]*>/g, '').trim();
            const charCount = textOnly.length;

            // Media analysis
            let mediaList = [];
            if (item.mediaList && item.mediaList.media) {
                mediaList = Array.isArray(item.mediaList.media) ? item.mediaList.media : [item.mediaList.media];
            }

            const images = mediaList.filter(m => m.$.type === 'IMAGE');
            const videos = mediaList.filter(m => m.$.type === 'VIDEO');

            const articleData = {
                id: newsId,
                title: title,
                date: pubDate,
                textLength: charCount,
                imageCount: images.length,
                videoCount: videos.length,
                images: []
            };

            if (images.length > 0) {
                // Check resolution of the first image as a sample
                const firstImgUrl = images[0].$.link;
                process.stdout.write(`Checking resolution for #${i + 1}... `);
                const resolution = await getImageMetadata(firstImgUrl);
                console.log(resolution);

                articleData.images.push({
                    url: firstImgUrl,
                    resolution: resolution
                });

                // List others
                for (let j = 1; j < images.length; j++) {
                    articleData.images.push({
                        url: images[j].$.link,
                        resolution: 'Not Checked'
                    });
                }
            } else {
                console.log(`Article #${i + 1} has no images.`);
            }
            results.push(articleData);
        }

        fs.writeFileSync(path.join(__dirname, 'rss_dump.json'), JSON.stringify(results, null, 2), 'utf-8');
        console.log('Saved analysis to tests/rss_dump.json');

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
