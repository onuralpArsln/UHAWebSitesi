const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'news.db');
const db = new Database(dbPath);

let output = '';

output += '--- Homepage Layout ---\n';
const homepageLayoutRow = db.prepare('SELECT * FROM homepage_layout WHERE id = ?').get('homepage');
if (homepageLayoutRow) {
    const layout = JSON.parse(homepageLayoutRow.layout);
    const carouselWidget = layout.find(w => w.type === 'carousel');
    output += 'Carousel Widget Config: ' + JSON.stringify(carouselWidget, null, 2) + '\n';
} else {
    output += 'No homepage layout found.\n';
}

output += '\n--- Carousel Layout (Manual) ---\n';
const carouselLayoutRow = db.prepare('SELECT * FROM carousel_layout WHERE id = ?').get('main-carousel');
if (carouselLayoutRow) {
    const articles = JSON.parse(carouselLayoutRow.articles);
    output += 'Manual Carousel Articles: ' + JSON.stringify(articles, null, 2) + '\n';
} else {
    output += 'No carousel layout found.\n';
}

output += '\n--- Articles with targettedViews containing "carousel" ---\n';
const articles = db.prepare("SELECT id, title, targettedViews FROM articles WHERE targettedViews LIKE '%carousel%'").all();
output += 'Articles: ' + JSON.stringify(articles, null, 2) + '\n';

fs.writeFileSync('verify_output.txt', output, 'utf8');
console.log('Output written to verify_output.txt');
