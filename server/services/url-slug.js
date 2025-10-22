const fs = require('fs').promises;
const path = require('path');
const slugify = require('slugify');
const NodeCache = require('node-cache');

class URLSlugService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
    this.slugCachePath = path.join(__dirname, '../cache/slug-cache.json');
    this.slugMap = new Map();
    this.loadSlugCache();
  }

  /**
   * Load slug cache from file
   */
  async loadSlugCache() {
    try {
      const data = await fs.readFile(this.slugCachePath, 'utf8');
      const cache = JSON.parse(data);
      this.slugMap = new Map(Object.entries(cache));
      console.log(`📝 Loaded ${this.slugMap.size} slug mappings from cache`);
    } catch (error) {
      console.log('📝 No existing slug cache found, starting fresh');
      this.slugMap = new Map();
    }
  }

  /**
   * Save slug cache to file
   */
  async saveSlugCache() {
    try {
      const cacheDir = path.dirname(this.slugCachePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cache = Object.fromEntries(this.slugMap);
      await fs.writeFile(this.slugCachePath, JSON.stringify(cache, null, 2));
      console.log(`💾 Saved ${this.slugMap.size} slug mappings to cache`);
    } catch (error) {
      console.error('❌ Error saving slug cache:', error);
    }
  }

  /**
   * Generate SEO-friendly slug from title
   */
  generateSlug(title) {
    if (!title) return '';
    
    // Turkish character mapping for better SEO
    const turkishMap = {
      'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
      'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };
    
    let slug = title;
    
    // Replace Turkish characters
    Object.entries(turkishMap).forEach(([tr, en]) => {
      slug = slug.replace(new RegExp(tr, 'g'), en);
    });
    
    // Generate slug using slugify
    slug = slugify(slug, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    // Ensure slug is not too long (max 60 chars for SEO)
    if (slug.length > 60) {
      slug = slug.substring(0, 60);
      // Remove trailing dash if exists
      slug = slug.replace(/-$/, '');
    }
    
    return slug;
  }

  /**
   * Get or create slug for article
   */
  async getSlugForArticle(articleId, title) {
    const cacheKey = `slug:${articleId}`;
    let slug = this.cache.get(cacheKey);
    
    if (slug) {
      return slug;
    }
    
    // Check if we have it in our persistent cache
    if (this.slugMap.has(articleId)) {
      slug = this.slugMap.get(articleId);
      this.cache.set(cacheKey, slug);
      return slug;
    }
    
    // Generate new slug
    slug = this.generateSlug(title);
    
    // Ensure uniqueness
    slug = await this.ensureUniqueSlug(slug, articleId);
    
    // Cache it
    this.slugMap.set(articleId, slug);
    this.cache.set(cacheKey, slug);
    
    // Save to persistent cache
    await this.saveSlugCache();
    
    return slug;
  }

  /**
   * Ensure slug is unique by adding number suffix if needed
   */
  async ensureUniqueSlug(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const existingId = this.getIdBySlug(slug);
      
      if (!existingId || existingId === excludeId) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Get article ID by slug
   */
  getIdBySlug(slug) {
    for (const [id, cachedSlug] of this.slugMap.entries()) {
      if (cachedSlug === slug) {
        return id;
      }
    }
    return null;
  }

  /**
   * Get slug by article ID
   */
  getSlugById(articleId) {
    return this.slugMap.get(articleId) || null;
  }

  /**
   * Update slug for existing article
   */
  async updateSlug(articleId, newTitle) {
    const newSlug = await this.getSlugForArticle(articleId, newTitle);
    
    // Update cache
    this.slugMap.set(articleId, newSlug);
    this.cache.set(`slug:${articleId}`, newSlug);
    
    // Save to persistent cache
    await this.saveSlugCache();
    
    return newSlug;
  }

  /**
   * Delete slug mapping
   */
  async deleteSlug(articleId) {
    this.slugMap.delete(articleId);
    this.cache.del(`slug:${articleId}`);
    await this.saveSlugCache();
  }

  /**
   * Get all slugs (for sitemap generation)
   */
  getAllSlugs() {
    return Array.from(this.slugMap.entries()).map(([id, slug]) => ({
      id,
      slug,
      url: `/haber/${slug}`
    }));
  }

  /**
   * Batch update slugs from backend
   */
  async batchUpdateSlugs(articles) {
    let updated = 0;
    
    for (const article of articles) {
      if (article.id && article.title) {
        const existingSlug = this.getSlugById(article.id);
        const newSlug = this.generateSlug(article.title);
        
        if (!existingSlug || existingSlug !== newSlug) {
          await this.getSlugForArticle(article.id, article.title);
          updated++;
        }
      }
    }
    
    if (updated > 0) {
      await this.saveSlugCache();
      console.log(`🔄 Updated ${updated} slug mappings`);
    }
    
    return updated;
  }
}

module.exports = URLSlugService;
