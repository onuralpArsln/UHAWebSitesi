const Database = require('better-sqlite3');
const DataService = require('../server/services/data-service');

const db = new Database(':memory:');
const ds = new DataService(db);

const insert = ds.db.prepare(
  'INSERT INTO articles (id, header, body, status, targettedViews, publishedAt, creationDate, images, headlineImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

for (let i = 1; i <= 30; i++) {
  const id = `a${i}`;
  const ts = new Date(Date.now() + i * 1000).toISOString();
  insert.run(
    id,
    `Title ${i}`,
    `<p>Body ${i}</p>`,
    'visible',
    JSON.stringify(['ana-manset']),
    ts,
    ts,
    JSON.stringify([{ url: `https://example.com/${id}.jpg`, alt: `img ${i}` }]),
    JSON.stringify({ url: `https://example.com/${id}.jpg`, alt: `img ${i}` })
  );

  const r = ds.addArticleToHeadlineList('ana-manset', id, 25);
  if (i === 26) {
    console.log('At 26, dropped:', r.droppedIds);
  }
}

const list = ds.getHeadlineList('ana-manset');
console.log('List size:', list.articles.length);
console.log('First:', list.articles[0]?.articleId, 'Last:', list.articles[list.articles.length - 1]?.articleId);

const ordered = ds.getHeadlineListArticles('ana-manset');
console.log('Ordered size:', ordered.length);
console.log('Ordered first/last:', ordered[0]?.id, ordered[ordered.length - 1]?.id);

const expectedFirst = 'a30';
const expectedLast = 'a6';
const ok = (list.articles.length === 25) && (list.articles[0].articleId === expectedFirst) && (list.articles[24].articleId === expectedLast);
console.log('Queue expectation OK:', ok);
