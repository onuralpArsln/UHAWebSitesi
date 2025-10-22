/**
 * Placeholder data service for development
 * Provides mock data without external backend dependencies
 */

class PlaceholderDataService {
  constructor() {
    this.articles = this.generateMockArticles();
    this.categories = this.generateMockCategories();
  }

  /**
   * Generate mock articles
   */
  generateMockArticles() {
    return [
      {
        id: '1',
        title: 'İzmir\'de 5.2 Büyüklüğünde Deprem Oldu',
        content: '<p>İzmir\'de meydana gelen 5.2 büyüklüğündeki deprem, vatandaşları tedirgin etti. Deprem, sabah saatlerinde hissedildi ve çevre illerde de hissedildi.</p><p>AFAD yetkilileri, depremin merkez üssünün İzmir\'in güneyinde olduğunu açıkladı. Şu ana kadar herhangi bir can kaybı veya hasar bildirilmedi.</p>',
        summary: 'İzmir\'de 5.2 büyüklüğünde deprem meydana geldi. Deprem çevre illerde de hissedildi, can kaybı bildirilmedi.',
        author: 'UHA Haber',
        category: 'Gündem',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        title: 'Türkiye Ekonomisinde Büyüme Rakamları Açıklandı',
        content: '<p>Türkiye İstatistik Kurumu (TÜİK), 2024 yılı üçüncü çeyrek büyüme rakamlarını açıkladı. Ekonomi yüzde 4.2 büyüdü.</p><p>Bu büyüme oranı, piyasa beklentilerini aştı ve TL\'de değerlenme yaşandı.</p>',
        summary: 'TÜİK, 2024 Q3 büyüme rakamlarını açıkladı. Ekonomi yüzde 4.2 büyüdü, piyasa beklentilerini aştı.',
        author: 'UHA Haber',
        category: 'Ekonomi',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
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
        title: 'Galatasaray Avrupa Ligi\'nde Büyük Zafer',
        content: '<p>Galatasaray, Avrupa Ligi\'nde rakiplerini 3-1 mağlup etti. Maçın yıldızı Mauro Icardi oldu.</p><p>Bu zaferle birlikte Galatasaray, gruplarda liderliğe yükseldi.</p>',
        summary: 'Galatasaray Avrupa Ligi\'nde 3-1 kazandı. Mauro Icardi\'nin golleriyle liderliğe yükseldi.',
        author: 'UHA Spor',
        category: 'Spor',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
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
        title: 'Teknoloji Sektöründe Yeni Yatırımlar',
        content: '<p>Yerli teknoloji şirketleri, yeni yatırım turunda 50 milyon dolar topladı. Bu yatırım, sektörün büyümesini hızlandıracak.</p>',
        summary: 'Yerli teknoloji şirketleri 50 milyon dolar yatırım topladı. Sektör büyümesi hızlanacak.',
        author: 'UHA Teknoloji',
        category: 'Teknoloji',
        publishedAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
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
        title: 'Sağlık Bakanlığı\'ndan Aşı Açıklaması',
        content: '<p>Sağlık Bakanlığı, yeni grip aşısı kampanyasını başlattı. Risk gruplarına öncelik verilecek.</p>',
        summary: 'Sağlık Bakanlığı grip aşısı kampanyasını başlattı. Risk gruplarına öncelik verilecek.',
        author: 'UHA Sağlık',
        category: 'Sağlık',
        publishedAt: new Date(Date.now() - 345600000).toISOString(),
        updatedAt: new Date(Date.now() - 345600000).toISOString(),
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
        title: 'Eğitim Sisteminde Yeni Düzenlemeler',
        content: '<p>Milli Eğitim Bakanlığı, yeni eğitim-öğretim yılı için düzenlemeleri açıkladı. Dijital eğitim araçları genişletilecek.</p>',
        summary: 'MEB yeni eğitim-öğretim yılı düzenlemelerini açıkladı. Dijital eğitim araçları genişletilecek.',
        author: 'UHA Eğitim',
        category: 'Eğitim',
        publishedAt: new Date(Date.now() - 432000000).toISOString(),
        updatedAt: new Date(Date.now() - 432000000).toISOString(),
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
   * Generate mock categories
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

    let filteredArticles = [...this.articles];

    // Filter by category
    if (category) {
      filteredArticles = filteredArticles.filter(article => 
        article.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filteredArticles = filteredArticles.filter(article =>
        article.title.toLowerCase().includes(searchLower) ||
        article.content.toLowerCase().includes(searchLower) ||
        article.summary.toLowerCase().includes(searchLower)
      );
    }

    // Sort articles
    filteredArticles.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'publishedAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

    return {
      articles: paginatedArticles,
      pagination: {
        page,
        limit,
        total: filteredArticles.length,
        totalPages: Math.ceil(filteredArticles.length / limit)
      }
    };
  }

  /**
   * Get single article by ID
   */
  getArticleById(id) {
    return this.articles.find(article => article.id === id) || null;
  }

  /**
   * Get related articles
   */
  getRelatedArticles(articleId, limit = 4) {
    const article = this.getArticleById(articleId);
    if (!article) return [];

    const relatedIds = article.relatedArticles || [];
    const relatedArticles = relatedIds
      .map(id => this.getArticleById(id))
      .filter(Boolean)
      .slice(0, limit);

    return relatedArticles;
  }

  /**
   * Get categories
   */
  getCategories() {
    return this.categories;
  }

  /**
   * Get RSS feed data
   */
  getRSSFeed() {
    return {
      articles: this.articles.slice(0, 10), // Last 10 articles
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Create article (for CMS)
   */
  createArticle(articleData) {
    const newArticle = {
      id: (this.articles.length + 1).toString(),
      ...articleData,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.articles.unshift(newArticle);
    return newArticle;
  }

  /**
   * Update article (for CMS)
   */
  updateArticle(id, articleData) {
    const index = this.articles.findIndex(article => article.id === id);
    if (index === -1) return null;

    this.articles[index] = {
      ...this.articles[index],
      ...articleData,
      updatedAt: new Date().toISOString()
    };

    return this.articles[index];
  }

  /**
   * Delete article (for CMS)
   */
  deleteArticle(id) {
    const index = this.articles.findIndex(article => article.id === id);
    if (index === -1) return false;

    this.articles.splice(index, 1);
    return true;
  }
}

module.exports = PlaceholderDataService;
