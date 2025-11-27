const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/news.db');
const db = new Database(dbPath);

console.log('🔄 Updating article images in database...');

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

    let modified = false;
    const newImages = images.map(img => {
        if (img.url && img.url.includes('via.placeholder.com')) {
            modified = true;
            return { ...img, url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' };
        }
        return img;
    });

    if (modified) {
        updateStmt.run(JSON.stringify(newImages), article.id);
        updateCount++;
    }
}

console.log(`✅ Updated ${updateCount} articles.`);
