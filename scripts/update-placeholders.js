const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/news.db');
const db = new Database(dbPath);

console.log('🔄 Removing placeholder images from database...');

const articles = db.prepare('SELECT id, images FROM articles').all();
let updateCount = 0;

const updateStmt = db.prepare('UPDATE articles SET images = ? WHERE id = ?');

for (const article of articles) {
    let images = [];
    try {
        images = JSON.parse(article.images);
    } catch (e) {
        continue;
    }

    const newImages = (images || []).filter(img => {
        const candidate = (img && (img.url || img.lowRes || img.highRes)) || '';
        const isRemotePlaceholder = /via\.placeholder\.com/i.test(candidate);
        const isLocalPlaceholder = candidate.includes('/uploads/media/placeHolder.png');
        return candidate && !isRemotePlaceholder && !isLocalPlaceholder;
    });

    if (JSON.stringify(newImages) !== JSON.stringify(images || [])) {
        updateStmt.run(JSON.stringify(newImages), article.id);
        updateCount++;
    }
}

console.log(`✅ Updated ${updateCount} articles (placeholders removed).`);
