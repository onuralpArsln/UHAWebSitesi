/**
 * Test Helpers - Utilities for creating test databases and fixtures
 */
const Database = require('better-sqlite3');

/**
 * Create an in-memory test database with schema
 */
function createTestDatabase() {
    const db = new Database(':memory:');

    // Create articles table
    db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      header TEXT,
      summaryHead TEXT,
      summary TEXT,
      category TEXT,
      tags TEXT,
      body TEXT,
      videoUrl TEXT,
      images TEXT,
      writer TEXT,
      creationDate TEXT,
      source TEXT,
      outlinks TEXT,
      targettedViews TEXT,
      updatedAt TEXT,
      relatedArticles TEXT,
      status TEXT DEFAULT 'visible',
      pressAnnouncementId TEXT,
      created_by TEXT,
      title TEXT,
      content TEXT,
      author TEXT,
      publishedAt TEXT,
      keywords TEXT
    )
  `);

    // Create categories table
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      slug TEXT,
      articleCount INTEGER DEFAULT 0
    )
  `);

    // Create homepage_layout table
    db.exec(`
    CREATE TABLE IF NOT EXISTS homepage_layout (
      id TEXT PRIMARY KEY,
      layout TEXT NOT NULL,
      updatedAt TEXT
    )
  `);

    return db;
}

/**
 * Create a test article with default values and optional overrides
 */
function createTestArticle(overrides = {}) {
    const now = new Date().toISOString();

    const defaults = {
        id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        header: 'Test Article Header',
        summaryHead: 'Test Summary Head',
        summary: 'This is a test article summary',
        category: 'Test Category',
        tags: ['test', 'article'],
        body: '<p>Test article body content</p>',
        videoUrl: '',
        images: [{ url: 'https://example.com/test.jpg', highRes: 'https://example.com/test-hd.jpg' }],
        writer: 'Test Author',
        creationDate: now,
        source: 'Test Source',
        outlinks: [],
        targettedViews: ['carousel'],
        updatedAt: now,
        relatedArticles: [],
        status: 'visible',
        pressAnnouncementId: '',
        created_by: 'test-user'
    };

    return { ...defaults, ...overrides };
}

/**
 * Insert an article into test database
 */
function insertArticle(db, article) {
    const stmt = db.prepare(`
    INSERT INTO articles (
      id, header, summaryHead, summary, category, tags, body, videoUrl, images,
      writer, creationDate, source, outlinks, targettedViews, updatedAt,
      relatedArticles, status, pressAnnouncementId, created_by,
      title, content, author, publishedAt, keywords
    ) VALUES (
      @id, @header, @summaryHead, @summary, @category, @tags, @body, @videoUrl, @images,
      @writer, @creationDate, @source, @outlinks, @targettedViews, @updatedAt,
      @relatedArticles, @status, @pressAnnouncementId, @created_by,
      @title, @content, @author, @publishedAt, @keywords
    )
  `);

    stmt.run({
        ...article,
        tags: JSON.stringify(article.tags || []),
        images: JSON.stringify(article.images || []),
        outlinks: JSON.stringify(article.outlinks || []),
        targettedViews: JSON.stringify(article.targettedViews || []),
        relatedArticles: JSON.stringify(article.relatedArticles || []),
        // Legacy fields
        title: article.header,
        content: article.body,
        author: article.writer,
        publishedAt: article.creationDate,
        keywords: JSON.stringify(article.tags || [])
    });

    return article;
}

/**
 * Create homepage layout configuration
 */
function createHomepageLayout(widgets = []) {
    return {
        id: 'homepage',
        layout: widgets,
        updatedAt: new Date().toISOString()
    };
}

/**
 * Insert homepage layout into test database
 */
function insertHomepageLayout(db, layout) {
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO homepage_layout (id, layout, updatedAt)
    VALUES (?, ?, ?)
  `);

    stmt.run(layout.id, JSON.stringify(layout.layout), layout.updatedAt);
}

/**
 * Create a test category
 */
function createTestCategory(overrides = {}) {
    const defaults = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Test Category',
        description: 'Test category description',
        slug: 'test-category',
        articleCount: 0
    };

    return { ...defaults, ...overrides };
}

/**
 * Insert category into test database
 */
function insertCategory(db, category) {
    const stmt = db.prepare(`
    INSERT INTO categories (id, name, description, slug, articleCount)
    VALUES (?, ?, ?, ?, ?)
  `);

    stmt.run(category.id, category.name, category.description, category.slug, category.articleCount);
    return category;
}

/**
 * Clean up test database
 */
function cleanupTestDatabase(db) {
    if (db && db.open) {
        db.close();
    }
}

module.exports = {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createHomepageLayout,
    insertHomepageLayout,
    createTestCategory,
    insertCategory,
    cleanupTestDatabase
};
