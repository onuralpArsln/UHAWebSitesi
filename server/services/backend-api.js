const axios = require('axios');
const xml2js = require('xml2js');
const NodeCache = require('node-cache');

class BackendAPIService {
  constructor() {
    this.baseURL = process.env.BACKEND_API_URL || 'http://localhost:8000';
    this.rssURL = process.env.BACKEND_RSS_URL || `${this.baseURL}/api/rss`;
    this.cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 300000 }); // 5 min default
    this.xmlParser = new xml2js.Parser();
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(url, options = {}) {
    try {
      const response = await axios({
        url,
        timeout: 10000,
        ...options
      });
      return response.data;
    } catch (error) {
      console.error(`❌ API Request failed for ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Get articles with pagination and filters
   */
  async getArticles(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      search = null,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = options;

    const cacheKey = `articles:${JSON.stringify(options)}`;
    let articles = this.cache.get(cacheKey);

    if (articles) {
      return articles;
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder
      });

      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const data = await this.makeRequest(`${this.baseURL}/api/articles?${params}`);
      
      // Normalize article data
      articles = {
        articles: this.normalizeArticles(data.articles || data),
        pagination: data.pagination || {
          page,
          limit,
          total: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / limit)
        }
      };

      this.cache.set(cacheKey, articles);
      return articles;
    } catch (error) {
      console.error('❌ Failed to fetch articles:', error.message);
      return { articles: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get single article by ID
   */
  async getArticleById(articleId) {
    const cacheKey = `article:${articleId}`;
    let article = this.cache.get(cacheKey);

    if (article) {
      return article;
    }

    try {
      const data = await this.makeRequest(`${this.baseURL}/api/articles/${articleId}`);
      article = this.normalizeArticle(data);
      
      this.cache.set(cacheKey, article);
      return article;
    } catch (error) {
      console.error(`❌ Failed to fetch article ${articleId}:`, error.message);
      return null;
    }
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId, limit = 4) {
    const cacheKey = `related:${articleId}:${limit}`;
    let related = this.cache.get(cacheKey);

    if (related) {
      return related;
    }

    try {
      const data = await this.makeRequest(`${this.baseURL}/api/related/${articleId}?limit=${limit}`);
      related = this.normalizeArticles(data.articles || data);
      
      this.cache.set(cacheKey, related);
      return related;
    } catch (error) {
      console.error(`❌ Failed to fetch related articles for ${articleId}:`, error.message);
      return [];
    }
  }

  /**
   * Get RSS feed
   */
  async getRSSFeed() {
    const cacheKey = 'rss:feed';
    let feed = this.cache.get(cacheKey);

    if (feed) {
      return feed;
    }

    try {
      const xmlData = await this.makeRequest(this.rssURL);
      const parsed = await this.xmlParser.parseStringPromise(xmlData);
      
      // Normalize RSS data to our article format
      const items = parsed.rss?.channel?.[0]?.item || [];
      const articles = items.map(item => this.normalizeRSSItem(item));
      
      feed = { articles, lastUpdated: new Date().toISOString() };
      this.cache.set(cacheKey, feed);
      
      return feed;
    } catch (error) {
      console.error('❌ Failed to fetch RSS feed:', error.message);
      return { articles: [], lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Send article update to backend
   */
  async updateArticle(articleId, articleData) {
    try {
      const data = await this.makeRequest(`${this.baseURL}/api/articles/${articleId}`, {
        method: 'PUT',
        data: articleData
      });
      
      // Clear cache for this article
      this.cache.del(`article:${articleId}`);
      this.cache.del(`related:${articleId}`);
      
      return data;
    } catch (error) {
      console.error(`❌ Failed to update article ${articleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create new article
   */
  async createArticle(articleData) {
    try {
      const data = await this.makeRequest(`${this.baseURL}/api/articles`, {
        method: 'POST',
        data: articleData
      });
      
      return data;
    } catch (error) {
      console.error('❌ Failed to create article:', error.message);
      throw error;
    }
  }

  /**
   * Get categories
   */
  async getCategories() {
    const cacheKey = 'categories';
    let categories = this.cache.get(cacheKey);

    if (categories) {
      return categories;
    }

    try {
      const data = await this.makeRequest(`${this.baseURL}/api/categories`);
      categories = data.categories || data;
      
      this.cache.set(cacheKey, categories);
      return categories;
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error.message);
      return [];
    }
  }

  /**
   * Normalize article data from API
   */
  normalizeArticle(article) {
    if (!article) return null;

    return {
      id: article.id,
      title: article.title,
      content: article.content,
      summary: article.summary || this.generateSummary(article.content),
      author: article.author || 'UHA News',
      category: article.category,
      publishedAt: article.publishedAt || article.createdAt,
      updatedAt: article.updatedAt || article.publishedAt,
      keywords: article.keywords || [],
      images: this.normalizeImages(article.images || []),
      relatedArticles: article.relatedArticles || []
    };
  }

  /**
   * Normalize multiple articles
   */
  normalizeArticles(articles) {
    if (!Array.isArray(articles)) return [];
    return articles.map(article => this.normalizeArticle(article));
  }

  /**
   * Normalize RSS item to article format
   */
  normalizeRSSItem(item) {
    return {
      id: item.guid?.[0]?._ || item.link?.[0]?.split('/').pop(),
      title: item.title?.[0] || '',
      content: item.description?.[0] || '',
      summary: item.description?.[0]?.substring(0, 160) || '',
      author: item['dc:creator']?.[0] || 'UHA News',
      category: item.category?.[0] || 'Genel',
      publishedAt: item.pubDate?.[0] || new Date().toISOString(),
      updatedAt: item.pubDate?.[0] || new Date().toISOString(),
      keywords: [],
      images: this.extractImagesFromContent(item.description?.[0] || ''),
      relatedArticles: []
    };
  }

  /**
   * Normalize images array
   */
  normalizeImages(images) {
    if (!Array.isArray(images)) return [];
    
    return images.map(img => ({
      url: img.url,
      lowRes: img.lowRes || img.thumbnail || img.url,
      highRes: img.highRes || img.url,
      width: img.width || 800,
      height: img.height || 600,
      alt: img.alt || img.title || 'News image',
      title: img.title || ''
    }));
  }

  /**
   * Extract images from HTML content
   */
  extractImagesFromContent(content) {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const images = [];
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      images.push({
        url: match[1],
        lowRes: match[1],
        highRes: match[1],
        width: 800,
        height: 600,
        alt: 'News image'
      });
    }

    return images;
  }

  /**
   * Generate summary from content
   */
  generateSummary(content) {
    if (!content) return '';
    
    // Remove HTML tags
    const text = content.replace(/<[^>]*>/g, '');
    
    // Take first 160 characters
    return text.length > 160 ? text.substring(0, 157) + '...' : text;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.flushAll();
    console.log('🗑️ Backend API cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

module.exports = BackendAPIService;
