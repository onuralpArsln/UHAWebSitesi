const fs = require('fs').promises;
const path = require('path');

class SitemapService {
  constructor(dataService, urlSlugService) {
    this.dataService = dataService;
    this.urlSlugService = urlSlugService;
    this.publicPath = path.join(__dirname, '../../public');
  }

  /**
   * Generate XML sitemap
   */
  async generateSitemap() {
    try {
      const articles = this.dataService.getArticles({ limit: 1000 });
      const slugs = this.urlSlugService.getAllSlugs();
      
      const sitemap = this.buildSitemapXML(articles.articles, slugs);
      
      // Save sitemap.xml
      await fs.writeFile(
        path.join(this.publicPath, 'sitemap.xml'),
        sitemap,
        'utf8'
      );
      
      console.log('🗺️ Generated sitemap.xml');
      return sitemap;
    } catch (error) {
      console.error('❌ Failed to generate sitemap:', error);
      throw error;
    }
  }

  /**
   * Generate news sitemap for Google News
   */
  async generateNewsSitemap() {
    try {
      // Get articles from last 2 days
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const articles = this.dataService.getArticles({ 
        limit: 1000,
        sortBy: 'publishedAt',
        sortOrder: 'desc'
      });
      
      // Filter recent articles
      const recentArticles = articles.articles.filter(article => {
        const publishedDate = new Date(article.publishedAt);
        return publishedDate >= twoDaysAgo;
      });
      
      const newsSitemap = this.buildNewsSitemapXML(recentArticles);
      
      // Save news-sitemap.xml
      await fs.writeFile(
        path.join(this.publicPath, 'news-sitemap.xml'),
        newsSitemap,
        'utf8'
      );
      
      console.log('📰 Generated news-sitemap.xml');
      return newsSitemap;
    } catch (error) {
      console.error('❌ Failed to generate news sitemap:', error);
      throw error;
    }
  }

  /**
   * Build XML sitemap
   */
  buildSitemapXML(articles, slugs) {
    const baseURL = process.env.SITE_URL || 'http://localhost:3000';
    const slugMap = new Map(slugs.map(s => [s.id, s.slug]));
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Homepage
    xml += `
  <url>
    <loc>${baseURL}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`;

    // Category pages
    const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];
    categories.forEach(category => {
      const categorySlug = this.slugify(category);
      xml += `
  <url>
    <loc>${baseURL}/kategori/${categorySlug}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Article pages
    articles.forEach(article => {
      const slug = slugMap.get(article.id);
      if (slug) {
        const lastmod = article.updatedAt || article.publishedAt;
        xml += `
  <url>
    <loc>${baseURL}/haber/${slug}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
      }
    });

    xml += `
</urlset>`;

    return xml;
  }

  /**
   * Build news sitemap XML
   */
  buildNewsSitemapXML(articles) {
    const baseURL = process.env.SITE_URL || 'http://localhost:3000';
    const slugMap = new Map(this.urlSlugService.getAllSlugs().map(s => [s.id, s.slug]));
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`;

    articles.forEach(article => {
      const slug = slugMap.get(article.id);
      if (slug) {
        const publishedDate = new Date(article.publishedAt);
        const lastmod = new Date(article.updatedAt || article.publishedAt);
        
        xml += `
  <url>
    <loc>${baseURL}/haber/${slug}</loc>
    <lastmod>${lastmod.toISOString()}</lastmod>
    <news:news>
      <news:publication>
        <news:name>${process.env.SITE_NAME || 'UHA News'}</news:name>
        <news:language>tr</news:language>
      </news:publication>
      <news:publication_date>${publishedDate.toISOString()}</news:publication_date>
      <news:title>${this.escapeXML(article.title)}</news:title>
      ${article.keywords && article.keywords.length > 0 ? 
        `<news:keywords>${this.escapeXML(article.keywords.join(', '))}</news:keywords>` : ''}
    </news:news>
  </url>`;
      }
    });

    xml += `
</urlset>`;

    return xml;
  }

  /**
   * Generate robots.txt
   */
  async generateRobotsTxt() {
    const baseURL = process.env.SITE_URL || 'http://localhost:3000';
    
    const robots = `User-agent: *
Allow: /

Sitemap: ${baseURL}/sitemap.xml
Sitemap: ${baseURL}/news-sitemap.xml

# Disallow admin and CMS areas
Disallow: /cms/
Disallow: /api/
Disallow: /admin/

# Allow Google News bot
User-agent: Googlebot-News
Allow: /`;

    await fs.writeFile(
      path.join(this.publicPath, 'robots.txt'),
      robots,
      'utf8'
    );
    
    console.log('🤖 Generated robots.txt');
    return robots;
  }

  /**
   * Generate all sitemaps
   */
  async generateAll() {
    try {
      await Promise.all([
        this.generateSitemap(),
        this.generateNewsSitemap(),
        this.generateRobotsTxt()
      ]);
      
      console.log('✅ All sitemaps generated successfully');
    } catch (error) {
      console.error('❌ Failed to generate sitemaps:', error);
      throw error;
    }
  }

  /**
   * Utility: Slugify string
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[çğıöşü]/g, match => {
        const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
        return map[match];
      })
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Utility: Escape XML special characters
   */
  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

module.exports = SitemapService;
