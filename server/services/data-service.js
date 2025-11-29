/**
 * Data service with SQLite3 database
 * Provides persistent storage for articles and categories
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const {
  LOGO_HEIGHT_DEFAULT,
  LOGO_HEIGHT_MIN,
  LOGO_HEIGHT_MAX
} = require('../config/branding');

const MEDIA_UPLOAD_WEB_PATH = '/uploads/media';

const clampLogoHeight = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, LOGO_HEIGHT_MIN), LOGO_HEIGHT_MAX);
  }
  return LOGO_HEIGHT_DEFAULT;
};

class DataService {
  constructor(dbInstance = null) {
    if (dbInstance) {
      // Use provided database instance (for testing)
      this.db = dbInstance;
      // Initialize schema if needed
      this.initializeDatabase();
      // Ensure defaults exist
      this.ensureBrandingDefaults();
      this.ensureHomepageLayoutDefaults();
      this.ensureArticleLayoutDefaults();
      this.ensureCarouselDefaults();
      // Don't migrate mock data in test mode
    } else {
      // Safety check: Prevent using production database in test environment
      if (process.env.NODE_ENV === 'test') {
        throw new Error(
          'DataService: Cannot create DataService without database instance in test environment. ' +
          'Tests must provide a test database instance to prevent modifying production data.'
        );
      }

      // Normal initialization for production
      // Ensure data directory exists
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Ensure branding upload directory exists
      const brandingUploadDir = path.join(__dirname, '../../public/uploads/branding');
      if (!fs.existsSync(brandingUploadDir)) {
        fs.mkdirSync(brandingUploadDir, { recursive: true });
      }

      // Initialize database
      const dbPath = path.join(dataDir, 'news.db');
      this.db = new Database(dbPath);

      // Enable foreign keys and WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Initialize schema
      this.initializeDatabase();

      // Ensure branding defaults exist
      this.ensureBrandingDefaults();

      // Ensure homepage layout defaults exist
      this.ensureHomepageLayoutDefaults();

      // Ensure article layout defaults exist
      this.ensureArticleLayoutDefaults();
      // Ensure carousel defaults exist
      this.ensureCarouselDefaults();

      // Migrate mock data if database is empty
      this.migrateMockDataIfNeeded();
    }
  }

  /**
   * Initialize database schema
   */
  initializeDatabase() {
    // Create articles table with new schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        header TEXT NOT NULL,
        summaryHead TEXT,
        summary TEXT,
        category TEXT,
        tags TEXT,
        body TEXT NOT NULL,
        videoUrl TEXT,
        headlineImage TEXT,
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
        -- Legacy fields for backward compatibility
        title TEXT,
        content TEXT,
        author TEXT,
        publishedAt TEXT,
        keywords TEXT,
        created_by TEXT
      )
    `);

    // Create categories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        slug TEXT,
        articleCount INTEGER DEFAULT 0
      )
    `);

    // Migrate existing data if needed
    this.migrateSchemaIfNeeded();
    this.migrateUsersSchemaIfNeeded();

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
      CREATE INDEX IF NOT EXISTS idx_articles_creationDate ON articles(creationDate);
      CREATE INDEX IF NOT EXISTS idx_articles_targettedViews ON articles(targettedViews);
      CREATE INDEX IF NOT EXISTS idx_articles_created_by ON articles(created_by);
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
    `);

    // Create branding table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS branding (
        id TEXT PRIMARY KEY,
        siteName TEXT,
        primaryColor TEXT,
        secondaryColor TEXT,
        accentColor TEXT,
        logoTextColor TEXT,
        navTextColor TEXT,
        navBackgroundColor TEXT,
        headerLogo TEXT,
        footerLogo TEXT,
        favicon TEXT,
        headerLogoHeight INTEGER,
        updatedAt TEXT
      )
    `);
    this.ensureBrandingSchema();

    // Create homepage layout table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS homepage_layout (
        id TEXT PRIMARY KEY,
        layout TEXT NOT NULL,
        updatedAt TEXT
      )
    `);

    // Create article layout table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS article_layout (
        id TEXT PRIMARY KEY,
        layout TEXT NOT NULL,
        updatedAt TEXT
      )
    `);

    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'editor',
        permissions TEXT,
        allowed_tabs TEXT,
        visible_tabs TEXT,
        article_created_count INTEGER DEFAULT 0,
        recent_article_ids TEXT,
        recent_actions TEXT,
        last_action_at TEXT,
        status TEXT DEFAULT 'active',
        profile TEXT,
        created_at TEXT,
        last_login TEXT
      )
    `);
  }

  /**
   * Migrate existing schema to new structure
   */
  migrateSchemaIfNeeded() {
    try {
      // Check if new columns exist
      const tableInfo = this.db.prepare("PRAGMA table_info(articles)").all();
      const columnNames = tableInfo.map(col => col.name);

      const needsMigration = !columnNames.includes('header') || !columnNames.includes('summaryHead');

      if (needsMigration) {
        console.log('🔄 Migrating database schema to new structure...');

        // Add new columns if they don't exist
        const newColumns = [
          { name: 'header', type: 'TEXT', default: "COALESCE(title, '')" },
          { name: 'summaryHead', type: 'TEXT', default: "''" },
          { name: 'tags', type: 'TEXT', default: "COALESCE(keywords, '[]')" },
          { name: 'body', type: 'TEXT', default: "COALESCE(content, '')" },
          { name: 'writer', type: 'TEXT', default: "COALESCE(author, '')" },
          { name: 'creationDate', type: 'TEXT', default: "COALESCE(publishedAt, '')" },
          { name: 'source', type: 'TEXT', default: "''" },
          { name: 'outlinks', type: 'TEXT', default: "'[]'" },
          { name: 'targettedViews', type: 'TEXT', default: "'[]'" },
          { name: 'videoUrl', type: 'TEXT', default: "''" },
          { name: 'status', type: 'TEXT', default: "'visible'" },
          { name: 'pressAnnouncementId', type: 'TEXT', default: "''" },
          { name: 'created_by', type: 'TEXT', default: "COALESCE(created_by, '')" }
        ];

        for (const col of newColumns) {
          if (!columnNames.includes(col.name)) {
            try {
              this.db.exec(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type}`);
              // Migrate existing data
              if (col.default && col.default !== "''" && col.default !== "'[]'") {
                this.db.exec(`UPDATE articles SET ${col.name} = ${col.default} WHERE ${col.name} IS NULL OR ${col.name} = ''`);
              }
            } catch (err) {
              // Column might already exist, ignore
              console.log(`Column ${col.name} might already exist, skipping...`);
            }
          }
        }

        console.log('✅ Schema migration completed');
      }

      const ensureColumn = (name, type, defaultExpression = null) => {
        if (!columnNames.includes(name)) {
          try {
            this.db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${type}`);
            if (defaultExpression) {
              this.db.exec(`UPDATE articles SET ${name} = ${defaultExpression} WHERE ${name} IS NULL`);
            }
          } catch (err) {
            console.log(`Column ${name} might already exist, skipping...`);
          }
        }
      };

      ensureColumn('headlineImage', 'TEXT');
    } catch (error) {
      console.error('⚠️ Schema migration error (might be expected on first run):', error.message);
    }
  }

  /**
   * Migrate users schema if needed
   */
  migrateUsersSchemaIfNeeded() {
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
      const columnNames = tableInfo.map(col => col.name);

      if (!columnNames.includes('allowed_tabs')) {
        console.log('🔄 Migrating users table schema...');
        this.db.exec("ALTER TABLE users ADD COLUMN allowed_tabs TEXT");
        console.log('✅ Users schema migration completed');
      }
    } catch (error) {
      console.error('⚠️ Users schema migration error:', error.message);
    }
  }

  ensureBrandingSchema() {
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(branding)").all();
      const columnNames = tableInfo.map(col => col.name);

      if (!columnNames.includes('favicon')) {
        this.db.exec("ALTER TABLE branding ADD COLUMN favicon TEXT");
      }
      if (!columnNames.includes('headerLogoHeight')) {
        this.db.exec("ALTER TABLE branding ADD COLUMN headerLogoHeight INTEGER");
        this.db.exec(`UPDATE branding SET headerLogoHeight = ${LOGO_HEIGHT_DEFAULT} WHERE headerLogoHeight IS NULL`);
      }
    } catch (error) {
      console.error('⚠️ Branding schema migration error:', error.message);
    }
  }

  /**
   * Ensure branding defaults exist
   */
  ensureBrandingDefaults() {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM branding').get();
    if (!existing || existing.count === 0) {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO branding (id, siteName, primaryColor, secondaryColor, accentColor, logoTextColor, navTextColor, navBackgroundColor, headerLogo, footerLogo, favicon, headerLogoHeight, updatedAt)
        VALUES (@id, @siteName, @primaryColor, @secondaryColor, @accentColor, @logoTextColor, @navTextColor, @navBackgroundColor, @headerLogo, @footerLogo, @favicon, @headerLogoHeight, @updatedAt)
      `).run({
        id: 'branding',
        siteName: 'UHA News',
        primaryColor: '#1a365d',
        secondaryColor: '#2d3748',
        accentColor: '#3182ce',
        logoTextColor: '#3182ce',
        navTextColor: '#ffffff',
        navBackgroundColor: '#1a365d',
        headerLogo: '',
        footerLogo: '',
        favicon: '',
        headerLogoHeight: LOGO_HEIGHT_DEFAULT,
        updatedAt: now
      });
    }
  }

  /**
   * Retrieve branding information
   */
  getBranding() {
    const row = this.db.prepare('SELECT * FROM branding WHERE id = ?').get('branding');
    if (!row) {
      this.ensureBrandingDefaults();
      return this.getBranding();
    }

    return {
      siteName: row.siteName || 'UHA News',
      primaryColor: row.primaryColor || '#1a365d',
      secondaryColor: row.secondaryColor || '#2d3748',
      accentColor: row.accentColor || '#3182ce',
      logoTextColor: row.logoTextColor || '#3182ce',
      navTextColor: row.navTextColor || '#ffffff',
      navBackgroundColor: row.navBackgroundColor || '#1a365d',
      headerLogo: row.headerLogo || '',
      footerLogo: row.footerLogo || '',
      favicon: row.favicon || '',
      headerLogoHeight: clampLogoHeight(row.headerLogoHeight),
      updatedAt: row.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Update branding information
   */
  updateBranding(brandingData = {}) {
    const current = this.getBranding();
    const updated = {
      ...current,
      ...brandingData,
      headerLogoHeight: clampLogoHeight(
        brandingData.headerLogoHeight !== undefined
          ? brandingData.headerLogoHeight
          : current.headerLogoHeight
      ),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE branding
      SET siteName = @siteName,
          primaryColor = @primaryColor,
          secondaryColor = @secondaryColor,
          accentColor = @accentColor,
          logoTextColor = @logoTextColor,
          navTextColor = @navTextColor,
          navBackgroundColor = @navBackgroundColor,
          headerLogo = @headerLogo,
          footerLogo = @footerLogo,
          favicon = @favicon,
          headerLogoHeight = @headerLogoHeight,
          updatedAt = @updatedAt
      WHERE id = 'branding'
    `).run(updated);

    return this.getBranding();
  }

  /**
   * Ensure homepage layout defaults exist
   */
  ensureHomepageLayoutDefaults() {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM homepage_layout').get();
    if (!existing || existing.count === 0) {
      const now = new Date().toISOString();
      const defaultLayout = [
        { type: 'flash-news', config: { id: 'flash-news', speed: 30, pauseDelay: 3000, duplicateCount: 2, source: 'latest' } },
        { type: 'hero-title', config: { title: 'Son Dakika Haberleri' } },
        { type: 'carousel', config: { source: 'manual', id: 'home-hero', maxArticles: 5, autoPlay: true, autoPlayDelay: 5000 } },
        { type: 'featured-news-grid', config: { title: 'Öne Çıkan Haberler', source: 'featured' } },
        { type: 'category-feed', config: { category: 'Gündem', slug: 'gundem' } },
        { type: 'category-feed', config: { category: 'Ekonomi', slug: 'ekonomi' } },
        { type: 'category-feed', config: { category: 'Spor', slug: 'spor' } },
        { type: 'ad-placeholder', config: { slot: 'home-mid', label: 'Reklam Alanı', size: '728x90' } }
      ];

      this.db.prepare(`
        INSERT INTO homepage_layout (id, layout, updatedAt)
        VALUES (@id, @layout, @updatedAt)
      `).run({
        id: 'homepage',
        layout: JSON.stringify(defaultLayout),
        updatedAt: now
      });
    }
  }

  /**
   * Get homepage layout configuration
   */
  getHomepageLayout() {
    const row = this.db.prepare('SELECT * FROM homepage_layout WHERE id = ?').get('homepage');
    if (!row) {
      this.ensureHomepageLayoutDefaults();
      return this.getHomepageLayout();
    }

    return {
      layout: JSON.parse(row.layout),
      updatedAt: row.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Update homepage layout configuration
   */
  updateHomepageLayout(newLayout = []) {
    const updated = {
      layout: JSON.stringify(newLayout),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE homepage_layout
      SET layout = @layout,
          updatedAt = @updatedAt
      WHERE id = 'homepage'
    `).run(updated);

    return this.getHomepageLayout();
  }

  /**
   * Ensure article layout defaults exist
   */
  ensureArticleLayoutDefaults() {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM article_layout WHERE id = ?').get('article');
    if (!existing || existing.count === 0) {
      const now = new Date().toISOString();
      // Default layout matching the widget types we implemented
      const defaultLayout = [
        { type: 'article-hero-image', config: {} },
        { type: 'article-category', config: {} },
        { type: 'article-header', config: {} },
        { type: 'article-meta', config: {} },
        { type: 'article-image', config: { showCaption: true, skipFirst: true } },
        { type: 'article-content', config: {} },
        { type: 'article-tags', config: {} },
        { type: 'related-articles', config: { limit: 4, sameCategory: true } },
        { type: 'comment-section', config: {} }
      ];

      this.db.prepare(`
        INSERT INTO article_layout (id, layout, updatedAt)
        VALUES (@id, @layout, @updatedAt)
      `).run({
        id: 'article',
        layout: JSON.stringify(defaultLayout),
        updatedAt: now
      });
    }
  }

  ensureCarouselDefaults() {
    // Create table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS carousel_layout (
        id TEXT PRIMARY KEY,
        articles TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    const existing = this.db.prepare('SELECT COUNT(*) as count FROM carousel_layout').get();
    if (!existing || existing.count === 0) {
      const now = new Date().toISOString();
      // Initialize with empty array
      this.db.prepare(`
        INSERT INTO carousel_layout (id, articles, updatedAt)
        VALUES (@id, @articles, @updatedAt)
      `).run({
        id: 'main-carousel',
        articles: JSON.stringify([]),
        updatedAt: now
      });
    }
  }
  /**
   * Get article layout configuration
   */
  getArticleLayout() {
    const row = this.db.prepare('SELECT * FROM article_layout WHERE id = ?').get('article');
    if (!row) {
      this.ensureArticleLayoutDefaults();
      return this.getArticleLayout();
    }

    return {
      layout: JSON.parse(row.layout),
      updatedAt: row.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Update article layout configuration
   */
  updateArticleLayout(newLayout = []) {
    const updated = {
      layout: JSON.stringify(newLayout),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE article_layout
      SET layout = @layout,
          updatedAt = @updatedAt
      WHERE id = 'article'
    `).run(updated);

    return this.getArticleLayout();
  }

  /**
   * Get carousel layout configuration
   */
  getCarouselLayout() {
    const row = this.db.prepare('SELECT * FROM carousel_layout WHERE id = ?').get('main-carousel');
    if (!row) {
      this.ensureCarouselDefaults();
      return this.getCarouselLayout();
    }

    return {
      articles: JSON.parse(row.articles),
      updatedAt: row.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Update carousel layout configuration
   */
  updateCarouselLayout(newArticles = []) {
    const updated = {
      articles: JSON.stringify(newArticles),
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE carousel_layout
      SET articles = @articles,
          updatedAt = @updatedAt
      WHERE id = 'main-carousel'
    `).run(updated);

    return this.getCarouselLayout();
  }

  removeArticleFromCarouselLayout(articleId) {
    if (!articleId) {
      return this.getCarouselLayout();
    }

    const layout = this.getCarouselLayout();
    const existingArticles = Array.isArray(layout.articles) ? layout.articles : [];
    const filtered = existingArticles.filter((item) => item.articleId !== articleId);

    if (filtered.length === existingArticles.length) {
      return layout;
    }

    const reindexed = filtered.map((item, index) => ({
      ...item,
      order: index
    }));

    return this.updateCarouselLayout(reindexed);
  }

  /**
   * Get full article data for carousel
   */
  getCarouselArticles() {
    const { articles: carouselItems } = this.getCarouselLayout();

    if (!carouselItems || carouselItems.length === 0) {
      return [];
    }

    const articleIds = carouselItems.map(item => item.articleId);

    // Fetch articles from DB
    const placeholders = articleIds.map(() => '?').join(',');
    const articles = this.db.prepare(`
      SELECT * FROM articles 
      WHERE id IN (${placeholders})
    `).all(...articleIds);

    // Map articles back to the order in carouselItems
    const orderedArticles = carouselItems.map(item => {
      const article = articles.find(a => a.id === item.articleId);
      if (!article) return null;

      // Parse images if string
      if (typeof article.images === 'string') {
        article.images = JSON.parse(article.images);
      }

      if (typeof article.headlineImage === 'string') {
        try {
          article.headlineImage = JSON.parse(article.headlineImage);
        } catch (error) {
          article.headlineImage = null;
        }
      }

      return article;
    }).filter(Boolean); // Remove any nulls (deleted articles)

    return orderedArticles;
  }

  /**
   * Migrate mock data if database is empty
   */
  migrateMockDataIfNeeded() {
    // Check if articles table is empty
    const articleCount = this.db.prepare('SELECT COUNT(*) as count FROM articles').get();

    if (articleCount.count === 0) {
      console.log('📦 Migrating mock data to database...');

      // Generate mock articles
      const mockArticles = this.generateMockArticles();
      const mockCategories = this.generateMockCategories();

      // Insert categories first
      const insertCategory = this.db.prepare(`
        INSERT INTO categories (id, name, description, slug, articleCount)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertCategoryTransaction = this.db.transaction((categories) => {
        for (const category of categories) {
          insertCategory.run(
            category.id,
            category.name,
            category.description || '',
            category.slug || '',
            category.articleCount || 0
          );
        }
      });

      insertCategoryTransaction(mockCategories);

      // Insert articles with new schema
      const insertArticle = this.db.prepare(`
        INSERT INTO articles (id, header, summaryHead, summary, category, tags, body, videoUrl, headlineImage, images, writer, creationDate, source, outlinks, targettedViews, updatedAt, relatedArticles, status, pressAnnouncementId, created_by, title, content, author, publishedAt, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertArticleTransaction = this.db.transaction((articles) => {
        for (const article of articles) {
          insertArticle.run(
            article.id,
            article.header || article.title || '',
            article.summaryHead || '',
            article.summary || '',
            article.category || '',
            JSON.stringify(article.tags || article.keywords || []),
            article.body || article.content || '',
            article.videoUrl || article.video || '',
            article.headlineImage ? JSON.stringify(article.headlineImage) : null,
            JSON.stringify(article.images || []),
            article.writer || article.author || 'UHA News',
            article.creationDate || article.publishedAt || new Date().toISOString(),
            article.source || '',
            JSON.stringify(article.outlinks || []),
            JSON.stringify(article.targettedViews || []),
            article.updatedAt || new Date().toISOString(),
            JSON.stringify(article.relatedArticles || []),
            article.status || 'visible',
            article.pressAnnouncementId || '',
            article.created_by || null,
            // Legacy fields
            article.header || article.title || '',
            article.body || article.content || '',
            article.writer || article.author || 'UHA News',
            article.creationDate || article.publishedAt || new Date().toISOString(),
            JSON.stringify(article.tags || article.keywords || [])
          );
        }
      });

      insertArticleTransaction(mockArticles);

      console.log('✅ Mock data migrated successfully');
    }
  }

  /**
   * Generate mock articles (for initial migration)
   */
  generateMockArticles() {
    const now = new Date().toISOString();
    return [
      // GÜNDEM (1-4)
      {
        id: '1',
        header: 'İzmir\'de 5.2 Büyüklüğünde Deprem Oldu',
        summaryHead: 'Son Dakika: İzmir\'de Deprem',
        summary: 'İzmir\'de 5.2 büyüklüğünde deprem meydana geldi. Deprem çevre illerde de hissedildi, can kaybı bildirilmedi.',
        category: 'Gündem',
        tags: ['deprem', 'izmir', 'afad', 'doğal afet'],
        body: '<p>İzmir\'de meydana gelen 5.2 büyüklüğündeki deprem, vatandaşları tedirgin etti. Deprem, sabah saatlerinde hissedildi ve çevre illerde de hissedildi.</p><p>AFAD yetkilileri, depremin merkez üssünün İzmir\'in güneyinde olduğunu açıkladı. Şu ana kadar herhangi bir can kaybı veya hasar bildirilmedi.</p>',
        writer: 'UHA Haber',
        creationDate: now,
        source: 'AFAD',
        outlinks: ['https://www.afad.gov.tr'],
        targettedViews: ['homepage', 'flash-news', 'carousel'],
        updatedAt: now,
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['2', '3'],
        created_by: 'mock_user_1'
      },
      {
        id: '2',
        header: 'Meclis Yeni Yasama Yılına Başladı',
        summaryHead: 'Siyaset Gündemi',
        summary: 'TBMM, 28. dönem 3. yasama yılına törenle başladı. Cumhurbaşkanı önemli mesajlar verdi.',
        category: 'Gündem',
        tags: ['tbmm', 'meclis', 'siyaset', 'yasama'],
        body: '<p>Türkiye Büyük Millet Meclisi, yeni yasama yılına düzenlenen törenle başladı. Açılış konuşmasını yapan Cumhurbaşkanı, yeni anayasa vurgusu yaptı.</p>',
        writer: 'UHA Ankara',
        creationDate: new Date(Date.now() - 3600000).toISOString(),
        source: 'TBMM',
        targettedViews: ['homepage', 'featured-news-grid'],
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['1'],
        created_by: 'mock_user_1'
      },
      {
        id: '3',
        header: 'İstanbul\'da Trafik Yoğunluğu %85\'e Ulaştı',
        summaryHead: 'İstanbul Trafik',
        summary: 'Akşam saatlerinde İstanbul trafiği durma noktasına geldi. Köprü geçişlerinde uzun kuyruklar oluştu.',
        category: 'Gündem',
        tags: ['istanbul', 'trafik', 'ulaşım'],
        body: '<p>İstanbul\'da iş çıkış saatiyle birlikte trafik yoğunluğu %85 seviyelerine ulaştı. Özellikle köprü geçişlerinde ve ana arterlerde sürücüler zor anlar yaşadı.</p>',
        writer: 'UHA İstanbul',
        creationDate: new Date(Date.now() - 7200000).toISOString(),
        source: 'İBB',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: [],
        created_by: 'mock_user_2'
      },
      {
        id: '4',
        header: 'Meteoroloji\'den Kuvvetli Yağış Uyarısı',
        summaryHead: 'Hava Durumu',
        summary: 'Meteoroloji Genel Müdürlüğü, Marmara ve Ege bölgesi için kuvvetli yağış uyarısında bulundu.',
        category: 'Gündem',
        tags: ['hava durumu', 'meteoroloji', 'yağmur'],
        body: '<p>Meteoroloji Genel Müdürlüğü tarafından yapılan son değerlendirmelere göre, yarın Marmara ve Ege bölgesinde kuvvetli sağanak yağış bekleniyor. Vatandaşların sel ve su baskınlarına karşı tedbirli olması istendi.</p>',
        writer: 'UHA Haber',
        creationDate: new Date(Date.now() - 10800000).toISOString(),
        source: 'MGM',
        targettedViews: ['flash-news'],
        updatedAt: new Date(Date.now() - 10800000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['1'],
        created_by: 'mock_user_1'
      },

      // EKONOMİ (5-8)
      {
        id: '5',
        header: 'Türkiye Ekonomisinde Büyüme Rakamları Açıklandı',
        summaryHead: 'Ekonomi Haberleri',
        summary: 'TÜİK, 2024 Q3 büyüme rakamlarını açıkladı. Ekonomi yüzde 4.2 büyüdü, piyasa beklentilerini aştı.',
        category: 'Ekonomi',
        tags: ['ekonomi', 'büyüme', 'tüik', 'gdp'],
        body: '<p>Türkiye İstatistik Kurumu (TÜİK), 2024 yılı üçüncü çeyrek büyüme rakamlarını açıkladı. Ekonomi yüzde 4.2 büyüdü.</p><p>Bu büyüme oranı, piyasa beklentilerini aştı ve TL\'de değerlenme yaşandı.</p>',
        writer: 'UHA Haber',
        creationDate: new Date(Date.now() - 86400000).toISOString(),
        source: 'TÜİK',
        outlinks: ['https://www.tuik.gov.tr'],
        targettedViews: ['homepage', 'carousel', 'category-feed'],
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['6', '7'],
        created_by: 'mock_user_3'
      },
      {
        id: '6',
        header: 'Borsa İstanbul Rekor Tazeledi',
        summaryHead: 'Piyasalar',
        summary: 'BIST 100 endeksi günü %2.5 artışla tamamlayarak tüm zamanların en yüksek kapanışını gerçekleştirdi.',
        category: 'Ekonomi',
        tags: ['borsa', 'bist100', 'finans', 'yatırım'],
        body: '<p>Borsa İstanbul\'da BIST 100 endeksi, bankacılık hisseleri öncülüğünde yükselişini sürdürdü. Endeks günü rekor seviyeden tamamladı.</p>',
        writer: 'UHA Finans',
        creationDate: new Date(Date.now() - 90000000).toISOString(),
        source: 'Borsa İstanbul',
        targettedViews: ['featured-news-grid', 'flash-news'],
        updatedAt: new Date(Date.now() - 90000000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['5'],
        created_by: 'mock_user_3'
      },
      {
        id: '7',
        header: 'Altın Fiyatlarında Son Durum',
        summaryHead: 'Altın Piyasası',
        summary: 'Gram altın güne yükselişle başladı. Çeyrek altın ve cumhuriyet altını fiyatları ne kadar?',
        category: 'Ekonomi',
        tags: ['altın', 'döviz', 'yatırım'],
        body: '<p>Uluslararası piyasalarda ons altının değer kazanmasıyla birlikte iç piyasada gram altın fiyatları da yükselişe geçti.</p>',
        writer: 'UHA Finans',
        creationDate: new Date(Date.now() - 95000000).toISOString(),
        source: 'Piyasalar',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 95000000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['5'],
        created_by: 'mock_user_3'
      },
      {
        id: '8',
        header: 'İhracat Rakamları Yüz Güldürdü',
        summaryHead: 'Dış Ticaret',
        summary: 'Ticaret Bakanlığı verilerine göre ihracat geçen yılın aynı ayına göre %10 artış gösterdi.',
        category: 'Ekonomi',
        tags: ['ihracat', 'ticaret', 'ekonomi'],
        body: '<p>Ticaret Bakanı, düzenlediği basın toplantısında dış ticaret verilerini açıkladı. İhracatın artması cari açık üzerinde olumlu etki yaratıyor.</p>',
        writer: 'UHA Ekonomi',
        creationDate: new Date(Date.now() - 100000000).toISOString(),
        source: 'Ticaret Bakanlığı',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 100000000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['5'],
        created_by: 'mock_user_3'
      },

      // SPOR (9-12)
      {
        id: '9',
        header: 'Galatasaray Avrupa Ligi\'nde Büyük Zafer',
        summaryHead: 'Spor Haberleri',
        summary: 'Galatasaray Avrupa Ligi\'nde 3-1 kazandı. Mauro Icardi\'nin golleriyle liderliğe yükseldi.',
        category: 'Spor',
        tags: ['galatasaray', 'avrupa ligi', 'futbol', 'mauro icardi'],
        body: '<p>Galatasaray, Avrupa Ligi\'nde rakiplerini 3-1 mağlup etti. Maçın yıldızı Mauro Icardi oldu.</p><p>Bu zaferle birlikte Galatasaray, gruplarda liderliğe yükseldi.</p>',
        writer: 'UHA Spor',
        creationDate: new Date(Date.now() - 172800000).toISOString(),
        source: 'UHA Spor',
        outlinks: [],
        targettedViews: ['homepage', 'carousel', 'featured-news-grid'],
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
        images: [{ url: '/uploads/media/placeHolder.png', highRes: '/uploads/media/placeHolder.png' }],
        relatedArticles: ['10', '11'],
        created_by: 'mock_user_4'
      },
      {
        id: '10',
        header: 'Fenerbahçe Derbi Hazırlıklarına Başladı',
        summaryHead: 'Fenerbahçe',
        summary: 'Sarı-lacivertliler, hafta sonu oynanacak dev derbi için hazırlıklarını sürdürüyor.',
        category: 'Spor',
        tags: ['fenerbahçe', 'futbol', 'derbi', 'süper lig'],
        body: '<p>Fenerbahçe, teknik direktör yönetiminde Samandıra Tesisleri\'nde antrenman yaptı. Takımda morallerin yüksek olduğu gözlendi.</p>',
        writer: 'UHA Spor',
        creationDate: new Date(Date.now() - 175000000).toISOString(),
        source: 'Fenerbahçe SK',
        targettedViews: ['category-feed', 'flash-news'],
        updatedAt: new Date(Date.now() - 175000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/2f855a/ffffff?text=Fenerbahçe', highRes: 'https://via.placeholder.com/800x600/2f855a/ffffff?text=Fenerbahçe' }],
        relatedArticles: ['9'],
        created_by: 'mock_user_4'
      },
      {
        id: '11',
        header: 'Milli Voleybolcularımızdan Altın Madalya',
        summaryHead: 'Filenin Sultanları',
        summary: 'A Milli Kadın Voleybol Takımı, Avrupa Şampiyonası\'nda altın madalya kazandı.',
        category: 'Spor',
        tags: ['voleybol', 'milli takım', 'filenin sultanları', 'şampiyon'],
        body: '<p>Filenin Sultanları, final maçında rakibini 3-2 mağluperek Avrupa Şampiyonu oldu. Tüm Türkiye bu zaferle gururlandı.</p>',
        writer: 'UHA Spor',
        creationDate: new Date(Date.now() - 180000000).toISOString(),
        source: 'TVF',
        targettedViews: ['carousel', 'featured-news-grid'],
        updatedAt: new Date(Date.now() - 180000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/276749/ffffff?text=Voleybol+Zaferi', highRes: 'https://via.placeholder.com/800x600/276749/ffffff?text=Voleybol+Zaferi' }],
        relatedArticles: [],
        created_by: 'mock_user_4'
      },
      {
        id: '12',
        header: 'Formula 1 İstanbul Park\'a Geri Dönüyor mu?',
        summaryHead: 'Motor Sporları',
        summary: 'Formula 1 yönetiminin İstanbul Park ile görüşmelere başladığı iddia edildi.',
        category: 'Spor',
        tags: ['formula 1', 'f1', 'istanbul park', 'yarış'],
        body: '<p>Motor sporları dünyasında heyecan yaratan iddia: Formula 1\'in yeniden Türkiye takvimine girmesi için görüşmelerin başladığı konuşuluyor.</p>',
        writer: 'UHA Spor',
        creationDate: new Date(Date.now() - 185000000).toISOString(),
        source: 'Dış Basın',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 185000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/22543d/ffffff?text=Formula+1', highRes: 'https://via.placeholder.com/800x600/22543d/ffffff?text=Formula+1' }],
        relatedArticles: [],
        created_by: 'mock_user_4'
      },

      // TEKNOLOJİ (13-15)
      {
        id: '13',
        header: 'Teknoloji Sektöründe Yeni Yatırımlar',
        summaryHead: 'Teknoloji Haberleri',
        summary: 'Yerli teknoloji şirketleri 50 milyon dolar yatırım topladı. Sektör büyümesi hızlanacak.',
        category: 'Teknoloji',
        tags: ['teknoloji', 'yatırım', 'startup', 'finansman'],
        body: '<p>Yerli teknoloji şirketleri, yeni yatırım turunda 50 milyon dolar topladı. Bu yatırım, sektörün büyümesini hızlandıracak.</p>',
        writer: 'UHA Teknoloji',
        creationDate: new Date(Date.now() - 259200000).toISOString(),
        source: 'UHA Teknoloji',
        outlinks: [],
        targettedViews: ['category-feed', 'featured-news-grid'],
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/d69e2e/ffffff?text=Teknoloji+Haberi', highRes: 'https://via.placeholder.com/800x600/d69e2e/ffffff?text=Teknoloji+Haberi' }],
        relatedArticles: ['14'],
        created_by: 'mock_user_5'
      },
      {
        id: '14',
        header: 'Yapay Zeka Düzenlemeleri Geliyor',
        summaryHead: 'Yapay Zeka',
        summary: 'Avrupa Birliği, yapay zeka kullanımına ilişkin yeni yasal düzenlemeleri kabul etti.',
        category: 'Teknoloji',
        tags: ['yapay zeka', 'ai', 'teknoloji', 'yasa'],
        body: '<p>Yapay zeka teknolojilerinin güvenli ve etik kullanımı için hazırlanan yasa tasarısı, Avrupa Parlamentosu\'nda onaylandı.</p>',
        writer: 'UHA Teknoloji',
        creationDate: new Date(Date.now() - 265000000).toISOString(),
        source: 'AB',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 265000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/b7791f/ffffff?text=Yapay+Zeka', highRes: 'https://via.placeholder.com/800x600/b7791f/ffffff?text=Yapay+Zeka' }],
        relatedArticles: ['13'],
        created_by: 'mock_user_5'
      },
      {
        id: '15',
        header: 'Yeni Nesil Akıllı Telefonlar Tanıtıldı',
        summaryHead: 'Mobil Teknoloji',
        summary: 'Teknoloji devi, katlanabilir ekranlı yeni telefon modellerini tanıttı.',
        category: 'Teknoloji',
        tags: ['akıllı telefon', 'mobil', 'teknoloji', 'lansman'],
        body: '<p>Yeni modeller, gelişmiş kamera özellikleri ve uzun pil ömrü ile dikkat çekiyor. Satışlar önümüzdeki ay başlayacak.</p>',
        writer: 'UHA Teknoloji',
        creationDate: new Date(Date.now() - 270000000).toISOString(),
        source: 'Teknoloji Basını',
        targettedViews: ['category-feed', 'carousel'],
        updatedAt: new Date(Date.now() - 270000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/975a16/ffffff?text=Akıllı+Telefon', highRes: 'https://via.placeholder.com/800x600/975a16/ffffff?text=Akıllı+Telefon' }],
        relatedArticles: [],
        created_by: 'mock_user_5'
      },

      // SAĞLIK (16-18)
      {
        id: '16',
        header: 'Sağlık Bakanlığı\'ndan Aşı Açıklaması',
        summaryHead: 'Sağlık Haberleri',
        summary: 'Sağlık Bakanlığı grip aşısı kampanyasını başlattı. Risk gruplarına öncelik verilecek.',
        category: 'Sağlık',
        tags: ['sağlık', 'aşı', 'grip', 'bakanlık'],
        body: '<p>Sağlık Bakanlığı, yeni grip aşısı kampanyasını başlattı. Risk gruplarına öncelik verilecek.</p>',
        writer: 'UHA Sağlık',
        creationDate: new Date(Date.now() - 345600000).toISOString(),
        source: 'Sağlık Bakanlığı',
        outlinks: ['https://www.saglik.gov.tr'],
        targettedViews: ['category-feed', 'flash-news'],
        updatedAt: new Date(Date.now() - 345600000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/e53e3e/ffffff?text=Sağlık+Haberi', highRes: 'https://via.placeholder.com/800x600/e53e3e/ffffff?text=Sağlık+Haberi' }],
        relatedArticles: ['17'],
        created_by: 'mock_user_6'
      },
      {
        id: '17',
        header: 'Düzenli Egzersizin Önemi',
        summaryHead: 'Sağlıklı Yaşam',
        summary: 'Uzmanlar, haftada en az 150 dakika orta tempolu yürüyüş öneriyor.',
        category: 'Sağlık',
        tags: ['spor', 'sağlık', 'yaşam', 'egzersiz'],
        body: '<p>Kalp sağlığını korumak ve stresi azaltmak için düzenli egzersiz şart. Uzmanlar, hareketli yaşam tarzının önemine dikkat çekiyor.</p>',
        writer: 'UHA Sağlık',
        creationDate: new Date(Date.now() - 350000000).toISOString(),
        source: 'Uzman Görüşü',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 350000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/c53030/ffffff?text=Egzersiz', highRes: 'https://via.placeholder.com/800x600/c53030/ffffff?text=Egzersiz' }],
        relatedArticles: ['16'],
        created_by: 'mock_user_6'
      },
      {
        id: '18',
        header: 'Beslenmede Dikkat Edilmesi Gerekenler',
        summaryHead: 'Beslenme',
        summary: 'Kış aylarında bağışıklık sistemini güçlendirmek için nasıl beslenmeliyiz?',
        category: 'Sağlık',
        tags: ['beslenme', 'diyet', 'sağlık', 'vitamin'],
        body: '<p>C vitamini açısından zengin meyve ve sebzelerin tüketimi, kış hastalıklarından korunmada önemli rol oynuyor.</p>',
        writer: 'UHA Sağlık',
        creationDate: new Date(Date.now() - 355000000).toISOString(),
        source: 'Diyetisyenler Odası',
        targettedViews: ['category-feed'],
        updatedAt: new Date(Date.now() - 355000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/9b2c2c/ffffff?text=Beslenme', highRes: 'https://via.placeholder.com/800x600/9b2c2c/ffffff?text=Beslenme' }],
        relatedArticles: [],
        created_by: 'mock_user_6'
      },

      // EĞİTİM (19-20)
      {
        id: '19',
        header: 'Eğitim Sisteminde Yeni Düzenlemeler',
        summaryHead: 'Eğitim Haberleri',
        summary: 'MEB yeni eğitim-öğretim yılı düzenlemelerini açıkladı. Dijital eğitim araçları genişletilecek.',
        category: 'Eğitim',
        tags: ['eğitim', 'meb', 'dijital', 'öğretim'],
        body: '<p>Milli Eğitim Bakanlığı, yeni eğitim-öğretim yılı için düzenlemeleri açıkladı. Dijital eğitim araçları genişletilecek.</p>',
        writer: 'UHA Eğitim',
        creationDate: new Date(Date.now() - 432000000).toISOString(),
        source: 'MEB',
        outlinks: ['https://www.meb.gov.tr'],
        targettedViews: ['category-feed', 'featured-news-grid'],
        updatedAt: new Date(Date.now() - 432000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/805ad5/ffffff?text=Eğitim+Haberi', highRes: 'https://via.placeholder.com/800x600/805ad5/ffffff?text=Eğitim+Haberi' }],
        relatedArticles: ['20'],
        created_by: 'mock_user_7'
      },
      {
        id: '20',
        header: 'Üniversite Tercih Sonuçları Açıklandı',
        summaryHead: 'YKS Sonuçları',
        summary: 'YKS yerleştirme sonuçları ÖSYM tarafından erişime açıldı. Adaylar heyecanlı.',
        category: 'Eğitim',
        tags: ['yks', 'üniversite', 'ösym', 'eğitim'],
        body: '<p>Milyonlarca öğrencinin beklediği üniversite yerleştirme sonuçları açıklandı. Kayıt işlemleri önümüzdeki hafta başlayacak.</p>',
        writer: 'UHA Eğitim',
        creationDate: new Date(Date.now() - 440000000).toISOString(),
        source: 'ÖSYM',
        targettedViews: ['category-feed', 'flash-news'],
        updatedAt: new Date(Date.now() - 440000000).toISOString(),
        images: [{ url: 'https://via.placeholder.com/800x600/6b46c1/ffffff?text=Üniversite', highRes: 'https://via.placeholder.com/800x600/6b46c1/ffffff?text=Üniversite' }],
        relatedArticles: ['19'],
        created_by: 'mock_user_7'
      }
    ];
  }

  /**
   * Generate mock categories (for initial migration)
   */
  generateMockCategories() {
    return [
      { id: '1', name: 'Gündem', description: 'Güncel haberler ve gelişmeler', slug: 'gundem', articleCount: 1 },
      { id: '2', name: 'Ekonomi', description: 'Ekonomi ve finans haberleri', slug: 'ekonomi', articleCount: 1 },
      { id: '3', name: 'Spor', description: 'Spor haberleri ve sonuçları', slug: 'spor', articleCount: 1 },
      { id: '4', name: 'Teknoloji', description: 'Teknoloji ve bilim haberleri', slug: 'teknoloji', articleCount: 1 },
      { id: '5', name: 'Sağlık', description: 'Sağlık ve tıp haberleri', slug: 'saglik', articleCount: 1 },
      { id: '6', name: 'Eğitim', description: 'Eğitim ve öğretim haberleri', slug: 'egitim', articleCount: 1 }
    ];
  }

  /**
   * Parse article from database row
   */
  parseArticle(row) {
    if (!row) return null;

    // Use new fields if available, fallback to legacy fields for backward compatibility
    const header = row.header || row.title || '';
    const body = row.body || row.content || '';
    const writer = row.writer || row.author || '';
    const creationDate = row.creationDate || row.publishedAt || '';
    const tags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) :
      (row.keywords ? (typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords) : []);
    const headlineImage = row.headlineImage
      ? (typeof row.headlineImage === 'string' ? JSON.parse(row.headlineImage) : row.headlineImage)
      : null;

    const status = row.status ? row.status.toLowerCase() : 'visible';

    return {
      id: row.id,
      // New structure
      header: header,
      summaryHead: row.summaryHead || '',
      summary: row.summary || '',
      category: row.category || '',
      tags: tags,
      body: body,
      images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : [],
      headlineImage,
      videoUrl: row.videoUrl || row.video || '',
      writer: writer,
      creationDate: creationDate,
      source: row.source || '',
      outlinks: row.outlinks ? (typeof row.outlinks === 'string' ? JSON.parse(row.outlinks) : row.outlinks) : [],
      targettedViews: row.targettedViews ? (typeof row.targettedViews === 'string' ? JSON.parse(row.targettedViews) : row.targettedViews) : [],
      updatedAt: row.updatedAt || '',
      relatedArticles: row.relatedArticles ? (typeof row.relatedArticles === 'string' ? JSON.parse(row.relatedArticles) : row.relatedArticles) : [],
      status: status === 'hidden' ? 'hidden' : 'visible',
      pressAnnouncementId: row.pressAnnouncementId || '',
      created_by: row.created_by || null,
      // Legacy fields for backward compatibility
      title: header,
      content: body,
      author: writer,
      publishedAt: creationDate,
      video: row.videoUrl || row.video || '',
      keywords: tags
    };
  }

  /**
   * Get articles with pagination and filters
   */
  getArticles(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      search = null,
      status = null,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = options;

    let query = 'SELECT * FROM articles WHERE 1=1';
    const params = [];

    // Filter by status
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    // Filter by category
    if (category) {
      query += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }

    // Filter by search
    if (search) {
      query += ' AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(summary) LIKE ?)';
      const searchTerm = `%${search.toLowerCase()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter by targetted view
    if (options.targettedView) {
      query += ' AND targettedViews LIKE ?';
      params.push(`%"${options.targettedView}"%`);
    }

    // Sort
    const validSortBy = ['publishedAt', 'updatedAt', 'title', 'category'].includes(sortBy)
      ? sortBy
      : 'publishedAt';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${validSortBy} ${validSortOrder}`;

    // Get total count for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = this.db.prepare(countQuery).get(...params);
    const total = countResult.count;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const rows = this.db.prepare(query).all(...params);
    const articles = rows.map(row => this.parseArticle(row));

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single article by ID
   */
  getArticleById(id) {
    const row = this.db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    return this.parseArticle(row);
  }

  /**
   * Get related articles
   */
  getRelatedArticles(articleId, limit = 4) {
    const article = this.getArticleById(articleId);
    if (!article || !article.relatedArticles || article.relatedArticles.length === 0) {
      return [];
    }

    // Get related articles by IDs
    const placeholders = article.relatedArticles.map(() => '?').join(',');
    const query = `SELECT * FROM articles WHERE id IN (${placeholders}) AND status != 'hidden' LIMIT ?`;
    const rows = this.db.prepare(query).all(...article.relatedArticles, limit);

    return rows.map(row => this.parseArticle(row));
  }

  /**
   * Get categories
   */
  getCategories() {
    const rows = this.db.prepare('SELECT * FROM categories ORDER BY name').all();
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      articleCount: row.articleCount
    }));
  }

  /**
   * Get single category by ID
   */
  getCategoryById(id) {
    if (!id) return null;
    const row = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      articleCount: row.articleCount
    };
  }

  /**
   * Create category
   */
  createCategory({ name, description = '', slug = '' }) {
    if (!name) {
      throw new Error('Category name is required');
    }

    const id = randomUUID();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    this.db.prepare(`
      INSERT INTO categories (id, name, description, slug, articleCount)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, trimmedName, trimmedDescription, slug);

    return this.getCategoryById(id);
  }

  /**
   * Update category
   */
  updateCategory(id, { name, description, slug }) {
    const existing = this.getCategoryById(id);
    if (!existing) {
      return null;
    }

    const nextName = name ? name.trim() : existing.name;
    const nextDescription = description !== undefined ? description.trim() : (existing.description || '');
    const nextSlug = slug !== undefined ? slug : existing.slug;

    this.db.prepare(`
      UPDATE categories
      SET name = ?, description = ?, slug = ?
      WHERE id = ?
    `).run(nextName, nextDescription, nextSlug, id);

    if (existing.name !== nextName) {
      this.db.prepare(`
        UPDATE articles SET category = ? WHERE category = ?
      `).run(nextName, existing.name);
    }

    this.updateCategoryArticleCount(nextName);

    return this.getCategoryById(id);
  }

  /**
   * Delete category
   */
  deleteCategory(id) {
    const existing = this.getCategoryById(id);
    if (!existing) {
      return false;
    }

    this.db.prepare(`
      UPDATE articles SET category = NULL WHERE category = ?
    `).run(existing.name);

    const result = this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get RSS feed data
   */
  getRSSFeed() {
    const rows = this.db.prepare(`
      SELECT * FROM articles 
      ORDER BY publishedAt DESC 
      LIMIT 10
    `).all();

    const articles = rows.map(row => this.parseArticle(row));

    return {
      articles,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Aggregate article status counts
   */
  getArticleStatusSummary() {
    const totalRow = this.db.prepare('SELECT COUNT(*) as total FROM articles').get();
    const statusRows = this.db.prepare(`
      SELECT COALESCE(status, 'visible') as status, COUNT(*) as count
      FROM articles
      GROUP BY COALESCE(status, 'visible')
    `).all();

    const summary = {
      total: totalRow.total || 0,
      visible: 0,
      hidden: 0
    };

    for (const row of statusRows) {
      const statusKey = (row.status || 'visible').toLowerCase();
      if (statusKey === 'hidden') {
        summary.hidden += row.count;
      } else {
        summary.visible += row.count;
      }
    }

    return summary;
  }

  /**
   * Update media references when a file path or URL changes
   */
  updateMediaReferences({ oldPath, newPath, oldUrl, newUrl }) {
    const normalizeUrl = (relativePath) => {
      if (!relativePath) return null;
      return `${MEDIA_UPLOAD_WEB_PATH}/${relativePath
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`;
    };

    const getFilenameFromPath = (value) => {
      if (!value) return null;
      const parts = value.split('/');
      return parts[parts.length - 1] || null;
    };

    const newFilename = newPath ? getFilenameFromPath(newPath) : null;
    const oldFilename = oldPath ? getFilenameFromPath(oldPath) : null;

    const resolvedOldUrl = oldUrl || normalizeUrl(oldPath);
    const resolvedNewUrl = newUrl || normalizeUrl(newPath);

    if (!oldPath && !resolvedOldUrl) {
      return;
    }

    const searchTerms = [];
    if (resolvedOldUrl) {
      searchTerms.push(`%${resolvedOldUrl}%`);
    }
    if (oldPath) {
      searchTerms.push(`%${oldPath}%`);
    }

    if (!searchTerms.length) {
      return;
    }

    const conditions = searchTerms.map(() => 'images LIKE ?').join(' OR ');
    const rows = this.db.prepare(
      `SELECT id, images FROM articles WHERE ${conditions}`
    ).all(...searchTerms);

    if (!rows.length) {
      return;
    }

    const now = new Date().toISOString();
    const keysToCheck = ['url', 'src', 'href', 'original', 'preview', 'thumb', 'thumbnail'];

    for (const row of rows) {
      if (!row.images) continue;

      let images;
      try {
        images = JSON.parse(row.images);
      } catch (error) {
        continue;
      }

      if (!Array.isArray(images)) {
        continue;
      }

      let changed = false;

      const updatedImages = images.map((entry) => {
        if (typeof entry === 'string') {
          const isMatch =
            (resolvedOldUrl && entry === resolvedOldUrl) ||
            (oldPath && entry === oldPath);
          if (isMatch) {
            changed = true;
            return resolvedNewUrl || newPath || entry;
          }
          return entry;
        }

        if (entry && typeof entry === 'object') {
          let mutated = false;

          if (oldPath && entry.path === oldPath) {
            entry.path = newPath || entry.path;
            mutated = true;
          }

          if (newFilename && oldFilename && entry.filename === oldFilename) {
            entry.filename = newFilename;
            mutated = true;
          }

          for (const key of keysToCheck) {
            if (entry[key] === resolvedOldUrl || entry[key] === oldPath) {
              entry[key] = resolvedNewUrl || entry[key];
              mutated = true;
            }
          }

          if (mutated) {
            changed = true;
          }
          return entry;
        }

        return entry;
      });

      if (changed) {
        this.db.prepare(
          'UPDATE articles SET images = ?, updatedAt = ? WHERE id = ?'
        ).run(JSON.stringify(updatedImages), now, row.id);
      }
    }
  }

  /**
   * Create article (for CMS)
   */
  createArticle(articleData) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const {
      header, summaryHead, summary, category, tags, body, videoUrl, images, headlineImage,
      writer, creationDate, source, outlinks, targettedViews, relatedArticles,
      status, pressAnnouncementId, created_by
    } = articleData;

    const stmt = this.db.prepare(`
      INSERT INTO articles (
        id, header, summaryHead, summary, category, tags, body, videoUrl, headlineImage, images,
        writer, creationDate, source, outlinks, targettedViews, relatedArticles,
        status, pressAnnouncementId, created_by,
        -- Legacy fields for backward compatibility
        title, content, author, publishedAt, keywords
      )
      VALUES (
        @id, @header, @summaryHead, @summary, @category, @tags, @body, @videoUrl, @headlineImage, @images,
        @writer, @creationDate, @source, @outlinks, @targettedViews, @relatedArticles,
        @status, @pressAnnouncementId, @created_by,
        -- Legacy fields for backward compatibility
        @title, @content, @author, @publishedAt, @keywords
      )
    `);

    const articleToInsert = {
      id,
      header: header || articleData.title || '',
      summaryHead: summaryHead || '',
      summary: summary || '',
      category: category || 'Genel',
      tags: JSON.stringify(tags || articleData.keywords || []),
      body: body || articleData.content || '',
      videoUrl: videoUrl || articleData.video || '',
      headlineImage: headlineImage ? JSON.stringify(headlineImage) : null,
      images: JSON.stringify(images || []),
      writer: writer || articleData.author || 'UHA News',
      creationDate: creationDate || articleData.publishedAt || now,
      source: source || '',
      outlinks: JSON.stringify(outlinks || []),
      targettedViews: JSON.stringify(targettedViews || []),
      relatedArticles: JSON.stringify(relatedArticles || []),
      status: status || 'visible',
      pressAnnouncementId: pressAnnouncementId || '',
      created_by: created_by || null,
      updatedAt: articleData.updatedAt || now,
      // Legacy fields
      title: header || articleData.title || '',
      content: body || articleData.content || '',
      author: writer || articleData.author || 'UHA News',
      publishedAt: creationDate || articleData.publishedAt || now,
      keywords: JSON.stringify(tags || articleData.keywords || [])
    };

    stmt.run(articleToInsert);

    // Update category article count
    this.updateCategoryArticleCount(articleToInsert.category);

    return this.getArticleById(id);
  }

  /**
   * Update article (for CMS)
   */
  updateArticle(id, articleData) {
    const existing = this.getArticleById(id);
    if (!existing) return null;

    const updatedAt = new Date().toISOString();
    const oldCategory = existing.category;

    // Use new fields, fallback to legacy or existing values
    const header = articleData.header !== undefined ? articleData.header :
      (articleData.title !== undefined ? articleData.title : existing.header);
    const body = articleData.body !== undefined ? articleData.body :
      (articleData.content !== undefined ? articleData.content : existing.body);
    const writer = articleData.writer !== undefined ? articleData.writer :
      (articleData.author !== undefined ? articleData.author : existing.writer);
    const tags = articleData.tags !== undefined ? articleData.tags :
      (articleData.keywords !== undefined ? articleData.keywords : existing.tags);

    const normalizedHeadlineImage = articleData.headlineImage !== undefined
      ? articleData.headlineImage
      : existing.headlineImage || null;

    const updatedArticle = {
      header,
      summaryHead: articleData.summaryHead !== undefined ? articleData.summaryHead : existing.summaryHead,
      summary: articleData.summary !== undefined ? articleData.summary : existing.summary,
      category: articleData.category !== undefined ? articleData.category : existing.category,
      tags: JSON.stringify(tags),
      body,
      videoUrl: articleData.videoUrl !== undefined ? articleData.videoUrl :
        (articleData.video !== undefined ? articleData.video : existing.videoUrl),
      headlineImage: normalizedHeadlineImage ? JSON.stringify(normalizedHeadlineImage) : null,
      images: articleData.images !== undefined ? JSON.stringify(articleData.images) :
        (existing.images ? JSON.stringify(existing.images) : '[]'),
      writer,
      creationDate: articleData.creationDate !== undefined ? articleData.creationDate :
        (articleData.publishedAt !== undefined ? articleData.publishedAt : existing.creationDate),
      source: articleData.source !== undefined ? articleData.source : existing.source,
      outlinks: articleData.outlinks !== undefined ? JSON.stringify(articleData.outlinks) :
        (existing.outlinks ? JSON.stringify(existing.outlinks) : '[]'),
      targettedViews: articleData.targettedViews !== undefined ? JSON.stringify(articleData.targettedViews) :
        (existing.targettedViews ? JSON.stringify(existing.targettedViews) : '[]'),
      updatedAt,
      relatedArticles: articleData.relatedArticles !== undefined ? JSON.stringify(articleData.relatedArticles) :
        (existing.relatedArticles ? JSON.stringify(existing.relatedArticles) : '[]'),
      status: articleData.status !== undefined ? articleData.status : existing.status || 'visible',
      pressAnnouncementId: articleData.pressAnnouncementId !== undefined ? articleData.pressAnnouncementId : (existing.pressAnnouncementId || ''),
      // Legacy fields
      title: header,
      content: body,
      author: writer,
      publishedAt: articleData.creationDate !== undefined ? articleData.creationDate :
        (articleData.publishedAt !== undefined ? articleData.publishedAt : existing.creationDate),
      keywords: JSON.stringify(tags)
    };

    this.db.prepare(`
      UPDATE articles 
      SET header = ?, summaryHead = ?, summary = ?, category = ?, tags = ?, body = ?, videoUrl = ?, headlineImage = ?, images = ?, writer = ?, creationDate = ?, source = ?, outlinks = ?, targettedViews = ?, updatedAt = ?, relatedArticles = ?, status = ?, pressAnnouncementId = ?, title = ?, content = ?, author = ?, publishedAt = ?, keywords = ?
      WHERE id = ?
    `).run(
      updatedArticle.header,
      updatedArticle.summaryHead,
      updatedArticle.summary,
      updatedArticle.category,
      updatedArticle.tags,
      updatedArticle.body,
      updatedArticle.videoUrl,
      updatedArticle.headlineImage,
      updatedArticle.images,
      updatedArticle.writer,
      updatedArticle.creationDate,
      updatedArticle.source,
      updatedArticle.outlinks,
      updatedArticle.targettedViews,
      updatedArticle.updatedAt,
      updatedArticle.relatedArticles,
      updatedArticle.status,
      updatedArticle.pressAnnouncementId,
      updatedArticle.title,
      updatedArticle.content,
      updatedArticle.author,
      updatedArticle.publishedAt,
      updatedArticle.keywords,
      id
    );

    // Update category article counts if category changed
    if (oldCategory !== updatedArticle.category) {
      this.updateCategoryArticleCount(oldCategory);
      this.updateCategoryArticleCount(updatedArticle.category);
    }

    return this.getArticleById(id);
  }

  /**
   * Delete article (for CMS)
   */
  deleteArticle(id) {
    const article = this.getArticleById(id);
    if (!article) return false;

    this.db.prepare('DELETE FROM articles WHERE id = ?').run(id);

    // Update category article count
    this.updateCategoryArticleCount(article.category);

    return true;
  }

  /**
   * Update category article count
   */
  updateCategoryArticleCount(categoryName) {
    if (!categoryName) return;

    const count = this.db.prepare(`
      SELECT COUNT(*) as count FROM articles WHERE category = ?
    `).get(categoryName);

    this.db.prepare(`
      UPDATE categories SET articleCount = ? WHERE name = ?
    `).run(count.count, categoryName);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
  /**
   * Create a new user
   */
  createUser(userData) {
    const {
      username,
      password,
      displayName,
      role,
      permissions,
      allowedTabs,
      visibleTabs,
      articleCreatedCount,
      recentArticleIds,
      recentActions,
      lastActionAt,
      status,
      profile
    } = userData;
    const id = require('crypto').randomUUID();
    const passwordHash = require('bcrypt').hashSync(password, 10);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (
        id,
        username,
        password_hash,
        display_name,
        role,
        permissions,
        allowed_tabs,
        visible_tabs,
        article_created_count,
        recent_article_ids,
        recent_actions,
        last_action_at,
        status,
        profile,
        created_at
      )
      VALUES (
        @id,
        @username,
        @passwordHash,
        @displayName,
        @role,
        @permissions,
        @allowedTabs,
        @visibleTabs,
        @articleCreatedCount,
        @recentArticleIds,
        @recentActions,
        @lastActionAt,
        @status,
        @profile,
        @createdAt
      )
    `).run({
      id,
      username,
      passwordHash,
      displayName,
      role: role || 'editor',
      permissions: JSON.stringify(permissions || []),
      allowedTabs: JSON.stringify(allowedTabs || []),
      visibleTabs: JSON.stringify(visibleTabs || allowedTabs || []),
      articleCreatedCount: Number.isFinite(articleCreatedCount) ? articleCreatedCount : 0,
      recentArticleIds: JSON.stringify(recentArticleIds || []),
      recentActions: JSON.stringify(recentActions || []),
      lastActionAt: lastActionAt || null,
      status: status || 'active',
      profile: profile ? JSON.stringify(profile) : null,
      createdAt: now
    });

    return this.getUserById(id);
  }

  /**
   * Get user by username
   */
  getUserByUsername(username) {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) return null;
    return this.parseUser(row);
  }

  /**
   * Get user by ID
   */
  getUserById(id) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return null;
    return this.parseUser(row);
  }

  /**
   * Get all users
   */
  getAllUsers() {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows.map(row => this.parseUser(row));
  }

  /**
   * Update user
   */
  updateUser(id, updates) {
    const current = this.getUserById(id);
    if (!current) return null;

    const {
      password,
      displayName,
      role,
      permissions,
      allowedTabs,
      visibleTabs,
      articleCreatedCount,
      recentArticleIds,
      recentActions,
      lastActionAt,
      status,
      profile
    } = updates;
    let passwordHash;

    // We need to fetch the raw row to get the password hash if we aren't updating it
    const rawUser = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (password) {
      passwordHash = require('bcrypt').hashSync(password, 10);
    } else {
      passwordHash = rawUser.password_hash;
    }

    this.db.prepare(`
      UPDATE users
      SET password_hash = @passwordHash,
          display_name = @displayName,
          role = @role,
          permissions = @permissions,
          allowed_tabs = @allowedTabs,
          visible_tabs = @visibleTabs,
          article_created_count = @articleCreatedCount,
          recent_article_ids = @recentArticleIds,
          recent_actions = @recentActions,
          last_action_at = @lastActionAt,
          status = @status,
          profile = @profile
      WHERE id = @id
    `).run({
      id,
      passwordHash,
      displayName: displayName !== undefined ? displayName : current.displayName,
      role: role || current.role,
      permissions: JSON.stringify(permissions !== undefined ? permissions : current.permissions),
      allowedTabs: JSON.stringify(allowedTabs !== undefined ? allowedTabs : (current.allowedTabs || [])),
      visibleTabs: JSON.stringify(visibleTabs !== undefined ? visibleTabs : (current.visibleTabs || current.allowedTabs || [])),
      articleCreatedCount: Number.isFinite(articleCreatedCount) ? articleCreatedCount : current.articleCreatedCount || 0,
      recentArticleIds: JSON.stringify(recentArticleIds !== undefined ? recentArticleIds : (current.recentArticleIds || [])),
      recentActions: JSON.stringify(recentActions !== undefined ? recentActions : (current.recentActions || [])),
      lastActionAt: lastActionAt !== undefined ? lastActionAt : current.lastActionAt || null,
      status: status || current.status || 'active',
      profile: profile !== undefined ? (profile ? JSON.stringify(profile) : null) : (current.profile ? JSON.stringify(current.profile) : null)
    });

    return this.getUserById(id);
  }

  /**
   * Delete user
   */
  deleteUser(id) {
    const info = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /**
   * Update last login time
   */
  updateLastLogin(id) {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, id);
  }

  /**
   * Parse user row
   */
  parseUser(row) {
    return {
      id: row.id,
      username: row.username,
      // password_hash is internal, usually not returned unless needed for auth check
      password_hash: row.password_hash,
      displayName: row.display_name,
      role: row.role,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      allowedTabs: row.allowed_tabs ? JSON.parse(row.allowed_tabs) : [],
      visibleTabs: row.visible_tabs ? JSON.parse(row.visible_tabs) : [],
      articleCreatedCount: row.article_created_count || 0,
      recentArticleIds: row.recent_article_ids ? JSON.parse(row.recent_article_ids) : [],
      recentActions: row.recent_actions ? JSON.parse(row.recent_actions) : [],
      lastActionAt: row.last_action_at || null,
      status: row.status || 'active',
      profile: row.profile ? JSON.parse(row.profile) : null,
      createdAt: row.created_at,
      lastLogin: row.last_login
    };
  }

  /**
   * Migrate schema if needed (Add created_by column)
   */
  migrateSchemaIfNeeded() {
    try {
      const tableInfo = this.db.pragma('table_info(articles)');
      const hasCreatedBy = tableInfo.some(col => col.name === 'created_by');

      if (!hasCreatedBy) {
        console.log('Migrating schema: Adding created_by column to articles table');
        this.db.exec('ALTER TABLE articles ADD COLUMN created_by TEXT');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_articles_created_by ON articles(created_by)');
      }
    } catch (error) {
      console.error('Schema migration error:', error);
    }
  }
}

module.exports = DataService;

