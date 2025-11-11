/**
 * Data service with SQLite3 database
 * Provides persistent storage for articles and categories
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const MEDIA_UPLOAD_WEB_PATH = '/uploads/media';

class DataService {
  constructor() {
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
    
    // Migrate mock data if database is empty
    this.migrateMockDataIfNeeded();
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
        keywords TEXT
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

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
      CREATE INDEX IF NOT EXISTS idx_articles_creationDate ON articles(creationDate);
      CREATE INDEX IF NOT EXISTS idx_articles_targettedViews ON articles(targettedViews);
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
        headerLogo TEXT,
        footerLogo TEXT,
        updatedAt TEXT
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
          { name: 'pressAnnouncementId', type: 'TEXT', default: "''" }
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
    } catch (error) {
      console.error('⚠️ Schema migration error (might be expected on first run):', error.message);
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
        INSERT INTO branding (id, siteName, primaryColor, secondaryColor, accentColor, headerLogo, footerLogo, updatedAt)
        VALUES (@id, @siteName, @primaryColor, @secondaryColor, @accentColor, @headerLogo, @footerLogo, @updatedAt)
      `).run({
        id: 'branding',
        siteName: 'UHA News',
        primaryColor: '#1a365d',
        secondaryColor: '#2d3748',
        accentColor: '#3182ce',
        headerLogo: '',
        footerLogo: '',
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
      headerLogo: row.headerLogo || '',
      footerLogo: row.footerLogo || '',
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
      updatedAt: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE branding
      SET siteName = @siteName,
          primaryColor = @primaryColor,
          secondaryColor = @secondaryColor,
          accentColor = @accentColor,
          headerLogo = @headerLogo,
          footerLogo = @footerLogo,
          updatedAt = @updatedAt
      WHERE id = 'branding'
    `).run(updated);

    return this.getBranding();
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
        INSERT INTO articles (id, header, summaryHead, summary, category, tags, body, images, writer, creationDate, source, outlinks, targettedViews, updatedAt, relatedArticles, title, content, author, publishedAt, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            JSON.stringify(article.images || []),
            article.writer || article.author || 'UHA News',
            article.creationDate || article.publishedAt || new Date().toISOString(),
            article.source || '',
            JSON.stringify(article.outlinks || []),
            JSON.stringify(article.targettedViews || []),
            article.updatedAt || new Date().toISOString(),
            JSON.stringify(article.relatedArticles || []),
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
        targettedViews: ['homepage', 'breaking-news'],
        updatedAt: now,
        // Legacy fields
        title: 'İzmir\'de 5.2 Büyüklüğünde Deprem Oldu',
        content: '<p>İzmir\'de meydana gelen 5.2 büyüklüğündeki deprem, vatandaşları tedirgin etti. Deprem, sabah saatlerinde hissedildi ve çevre illerde de hissedildi.</p><p>AFAD yetkilileri, depremin merkez üssünün İzmir\'in güneyinde olduğunu açıkladı. Şu ana kadar herhangi bir can kaybı veya hasar bildirilmedi.</p>',
        author: 'UHA Haber',
        publishedAt: now,
        keywords: ['deprem', 'izmir', 'afad', 'doğal afet'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/1a365d/ffffff?text=Deprem+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/1a365d/ffffff?text=Deprem',
            highRes: 'https://via.placeholder.com/800x600/1a365d/ffffff?text=Deprem+Haberi',
            width: 800,
            height: 600,
            alt: 'İzmir depremi 5.2 büyüklüğünde',
            title: 'İzmir Depremi'
          }
        ],
        relatedArticles: ['2', '3']
      },
      {
        id: '2',
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
        targettedViews: ['homepage', 'category'],
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        // Legacy fields
        title: 'Türkiye Ekonomisinde Büyüme Rakamları Açıklandı',
        content: '<p>Türkiye İstatistik Kurumu (TÜİK), 2024 yılı üçüncü çeyrek büyüme rakamlarını açıkladı. Ekonomi yüzde 4.2 büyüdü.</p><p>Bu büyüme oranı, piyasa beklentilerini aştı ve TL\'de değerlenme yaşandı.</p>',
        author: 'UHA Haber',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        keywords: ['ekonomi', 'büyüme', 'tüik', 'gdp'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/3182ce/ffffff?text=Ekonomi+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/3182ce/ffffff?text=Ekonomi',
            highRes: 'https://via.placeholder.com/800x600/3182ce/ffffff?text=Ekonomi+Haberi',
            width: 800,
            height: 600,
            alt: 'Türkiye ekonomisi büyüme rakamları',
            title: 'Ekonomi Büyümesi'
          }
        ],
        relatedArticles: ['1', '4']
      },
      {
        id: '3',
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
        targettedViews: ['homepage', 'category'],
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
        // Legacy fields
        title: 'Galatasaray Avrupa Ligi\'nde Büyük Zafer',
        content: '<p>Galatasaray, Avrupa Ligi\'nde rakiplerini 3-1 mağlup etti. Maçın yıldızı Mauro Icardi oldu.</p><p>Bu zaferle birlikte Galatasaray, gruplarda liderliğe yükseldi.</p>',
        author: 'UHA Spor',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        keywords: ['galatasaray', 'avrupa ligi', 'futbol', 'mauro icardi'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/38a169/ffffff?text=Spor+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/38a169/ffffff?text=Spor',
            highRes: 'https://via.placeholder.com/800x600/38a169/ffffff?text=Spor+Haberi',
            width: 800,
            height: 600,
            alt: 'Galatasaray Avrupa Ligi maçı',
            title: 'Galatasaray Zaferi'
          }
        ],
        relatedArticles: ['1', '5']
      },
      {
        id: '4',
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
        targettedViews: ['category'],
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
        // Legacy fields
        title: 'Teknoloji Sektöründe Yeni Yatırımlar',
        content: '<p>Yerli teknoloji şirketleri, yeni yatırım turunda 50 milyon dolar topladı. Bu yatırım, sektörün büyümesini hızlandıracak.</p>',
        author: 'UHA Teknoloji',
        publishedAt: new Date(Date.now() - 259200000).toISOString(),
        keywords: ['teknoloji', 'yatırım', 'startup', 'finansman'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/d69e2e/ffffff?text=Teknoloji+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/d69e2e/ffffff?text=Teknoloji',
            highRes: 'https://via.placeholder.com/800x600/d69e2e/ffffff?text=Teknoloji+Haberi',
            width: 800,
            height: 600,
            alt: 'Teknoloji sektörü yatırımları',
            title: 'Teknoloji Yatırımları'
          }
        ],
        relatedArticles: ['2', '6']
      },
      {
        id: '5',
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
        targettedViews: ['category'],
        updatedAt: new Date(Date.now() - 345600000).toISOString(),
        // Legacy fields
        title: 'Sağlık Bakanlığı\'ndan Aşı Açıklaması',
        content: '<p>Sağlık Bakanlığı, yeni grip aşısı kampanyasını başlattı. Risk gruplarına öncelik verilecek.</p>',
        author: 'UHA Sağlık',
        publishedAt: new Date(Date.now() - 345600000).toISOString(),
        keywords: ['sağlık', 'aşı', 'grip', 'bakanlık'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/e53e3e/ffffff?text=Sağlık+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/e53e3e/ffffff?text=Sağlık',
            highRes: 'https://via.placeholder.com/800x600/e53e3e/ffffff?text=Sağlık+Haberi',
            width: 800,
            height: 600,
            alt: 'Sağlık Bakanlığı aşı kampanyası',
            title: 'Aşı Kampanyası'
          }
        ],
        relatedArticles: ['3', '7']
      },
      {
        id: '6',
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
        targettedViews: ['category'],
        updatedAt: new Date(Date.now() - 432000000).toISOString(),
        // Legacy fields
        title: 'Eğitim Sisteminde Yeni Düzenlemeler',
        content: '<p>Milli Eğitim Bakanlığı, yeni eğitim-öğretim yılı için düzenlemeleri açıkladı. Dijital eğitim araçları genişletilecek.</p>',
        author: 'UHA Eğitim',
        publishedAt: new Date(Date.now() - 432000000).toISOString(),
        keywords: ['eğitim', 'meb', 'dijital', 'öğretim'],
        images: [
          {
            url: 'https://via.placeholder.com/800x600/805ad5/ffffff?text=Eğitim+Haberi',
            lowRes: 'https://via.placeholder.com/400x300/805ad5/ffffff?text=Eğitim',
            highRes: 'https://via.placeholder.com/800x600/805ad5/ffffff?text=Eğitim+Haberi',
            width: 800,
            height: 600,
            alt: 'Eğitim sistemi düzenlemeleri',
            title: 'Eğitim Düzenlemeleri'
          }
        ],
        relatedArticles: ['4', '8']
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
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = options;

    let query = 'SELECT * FROM articles WHERE 1=1';
    const params = [];

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
    const query = `SELECT * FROM articles WHERE id IN (${placeholders}) LIMIT ?`;
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
    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    // Use new fields, fallback to legacy fields for backward compatibility
    const header = articleData.header || articleData.title || '';
    const body = articleData.body || articleData.content || '';
    const writer = articleData.writer || articleData.author || 'UHA News';
    const creationDate = articleData.creationDate || articleData.publishedAt || now;
    const tags = articleData.tags || articleData.keywords || [];
    
    const newArticle = {
      id,
      header,
      summaryHead: articleData.summaryHead || '',
      summary: articleData.summary || '',
      category: articleData.category || 'Genel',
      tags: JSON.stringify(tags),
      body,
      videoUrl: articleData.videoUrl || articleData.video || '',
      images: JSON.stringify(articleData.images || []),
      writer,
      creationDate,
      source: articleData.source || '',
      outlinks: JSON.stringify(articleData.outlinks || []),
      targettedViews: JSON.stringify(articleData.targettedViews || []),
      updatedAt: articleData.updatedAt || now,
      relatedArticles: JSON.stringify(articleData.relatedArticles || []),
      status: articleData.status || 'visible',
      pressAnnouncementId: articleData.pressAnnouncementId || '',
      // Legacy fields for backward compatibility
      title: header,
      content: body,
      author: writer,
      publishedAt: creationDate,
      keywords: JSON.stringify(tags)
    };

    this.db.prepare(`
      INSERT INTO articles (id, header, summaryHead, summary, category, tags, body, videoUrl, images, writer, creationDate, source, outlinks, targettedViews, updatedAt, relatedArticles, status, pressAnnouncementId, title, content, author, publishedAt, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newArticle.id,
      newArticle.header,
      newArticle.summaryHead,
      newArticle.summary,
      newArticle.category,
      newArticle.tags,
      newArticle.body,
      newArticle.videoUrl,
      newArticle.images,
      newArticle.writer,
      newArticle.creationDate,
      newArticle.source,
      newArticle.outlinks,
      newArticle.targettedViews,
      newArticle.updatedAt,
      newArticle.relatedArticles,
      newArticle.status,
      newArticle.pressAnnouncementId,
      newArticle.title,
      newArticle.content,
      newArticle.author,
      newArticle.publishedAt,
      newArticle.keywords
    );

    // Update category article count
    this.updateCategoryArticleCount(newArticle.category);

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

    const updatedArticle = {
      header,
      summaryHead: articleData.summaryHead !== undefined ? articleData.summaryHead : existing.summaryHead,
      summary: articleData.summary !== undefined ? articleData.summary : existing.summary,
      category: articleData.category !== undefined ? articleData.category : existing.category,
      tags: JSON.stringify(tags),
      body,
      videoUrl: articleData.videoUrl !== undefined ? articleData.videoUrl : 
                (articleData.video !== undefined ? articleData.video : existing.videoUrl),
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
      SET header = ?, summaryHead = ?, summary = ?, category = ?, tags = ?, body = ?, videoUrl = ?, images = ?, writer = ?, creationDate = ?, source = ?, outlinks = ?, targettedViews = ?, updatedAt = ?, relatedArticles = ?, status = ?, pressAnnouncementId = ?, title = ?, content = ?, author = ?, publishedAt = ?, keywords = ?
      WHERE id = ?
    `).run(
      updatedArticle.header,
      updatedArticle.summaryHead,
      updatedArticle.summary,
      updatedArticle.category,
      updatedArticle.tags,
      updatedArticle.body,
      updatedArticle.videoUrl,
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
}

module.exports = DataService;

