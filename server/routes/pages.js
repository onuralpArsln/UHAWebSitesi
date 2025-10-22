const express = require('express');
const SSREngine = require('../ssr-engine');
const PlaceholderDataService = require('../services/placeholder-data');
const URLSlugService = require('../services/url-slug');
const SitemapService = require('../services/sitemap');

const router = express.Router();
const ssrEngine = new SSREngine();
const dataService = new PlaceholderDataService();
const urlSlugService = new URLSlugService();
const sitemapService = new SitemapService(dataService, urlSlugService);

/**
 * Homepage route
 */
router.get('/', async (req, res) => {
  try {
    // Fetch featured articles
    const featuredArticles = dataService.getArticles({ 
      limit: 8, 
      sortBy: 'publishedAt', 
      sortOrder: 'desc' 
    });

    // Fetch articles by category for category sections
    const categories = dataService.getCategories();
    const categorySections = [];

    for (const category of categories.slice(0, 3)) {
      const categoryArticles = dataService.getArticles({
        category: category.name,
        limit: 4,
        sortBy: 'publishedAt',
        sortOrder: 'desc'
      });
      
      if (categoryArticles.articles.length > 0) {
        categorySections.push({
          name: category.name,
          slug: urlSlugService.generateSlug(category.name),
          articles: categoryArticles.articles.map(article => ({
            ...article,
            slug: urlSlugService.getSlugById(article.id) || 
                  urlSlugService.generateSlug(article.title)
          }))
        });
      }
    }

    // Prepare page data
    const pageData = {
      meta: {
        title: process.env.SITE_NAME || 'UHA News',
        description: process.env.SITE_DESCRIPTION || 'Son dakika haberleri ve güncel gelişmeler',
        url: process.env.SITE_URL || 'http://localhost:3000',
        image: `${process.env.SITE_URL}/static/images/og-home.jpg`,
        type: 'website'
      },
      featuredArticles: featuredArticles.articles.map(article => ({
        ...article,
        slug: urlSlugService.getSlugById(article.id) || 
              urlSlugService.generateSlug(article.title)
      })),
      categorySections
    };

    // Render page
    const html = await ssrEngine.render('pages/home.html', pageData);
    res.send(html);

  } catch (error) {
    console.error('Homepage error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Article detail route
 */
router.get('/haber/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Get article ID from slug
    const articleId = urlSlugService.getIdBySlug(slug);
    
    if (!articleId) {
      return res.status(404).send('Article not found');
    }

    // Fetch article
    const article = dataService.getArticleById(articleId);
    
    if (!article) {
      return res.status(404).send('Article not found');
    }

    // Fetch related articles
    const relatedArticles = dataService.getRelatedArticles(articleId, 4);

    // Prepare page data
    const pageData = {
      meta: {
        title: `${article.title} - ${process.env.SITE_NAME}`,
        description: article.summary,
        url: `${process.env.SITE_URL}/haber/${slug}`,
        image: article.images?.[0]?.highRes,
        type: 'article'
      },
      article: {
        ...article,
        slug,
        images: ssrEngine.optimizeImageData(article.images)
      },
      relatedArticles: relatedArticles.map(related => ({
        ...related,
        slug: urlSlugService.getSlugById(related.id) || 
              urlSlugService.generateSlug(related.title)
      }))
    };

    // Render page
    const html = await ssrEngine.render('pages/article.html', pageData);
    res.send(html);

  } catch (error) {
    console.error('Article page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Category page route
 */
router.get('/kategori/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;
    
    // Find category by slug
    const categories = dataService.getCategories();
    const category = categories.find(cat => 
      urlSlugService.generateSlug(cat.name) === categorySlug
    );
    
    if (!category) {
      return res.status(404).send('Category not found');
    }

    // Fetch articles for category
    const articlesData = dataService.getArticles({
      category: category.name,
      page: parseInt(page),
      limit: 12,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });

    // Prepare pagination
    const pagination = {
      ...articlesData.pagination,
      hasPrev: articlesData.pagination.page > 1,
      hasNext: articlesData.pagination.page < articlesData.pagination.totalPages,
      prevPage: articlesData.pagination.page - 1,
      nextPage: articlesData.pagination.page + 1,
      pages: Array.from({ length: articlesData.pagination.totalPages }, (_, i) => ({
        number: i + 1,
        isCurrent: i + 1 === articlesData.pagination.page
      }))
    };

    // Prepare page data
    const pageData = {
      meta: {
        title: `${category.name} Haberleri - ${process.env.SITE_NAME}`,
        description: `${category.name} kategorisindeki son haberler ve güncel gelişmeler`,
        url: `${process.env.SITE_URL}/kategori/${categorySlug}`,
        image: `${process.env.SITE_URL}/static/images/category-${categorySlug}.jpg`,
        type: 'website'
      },
      category: {
        ...category,
        slug: categorySlug
      },
      articles: articlesData.articles.map(article => ({
        ...article,
        slug: urlSlugService.getSlugById(article.id) || 
              urlSlugService.generateSlug(article.title)
      })),
      pagination
    };

    // Render page
    const html = await ssrEngine.render('pages/category.html', pageData);
    res.send(html);

  } catch (error) {
    console.error('Category page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Search page route
 */
router.get('/arama', async (req, res) => {
  try {
    const { q: query, page = 1 } = req.query;
    
    if (!query) {
      return res.redirect('/');
    }

    // Search articles
    const searchResults = dataService.getArticles({
      search: query,
      page: parseInt(page),
      limit: 12,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });

    // Prepare pagination
    const pagination = {
      ...searchResults.pagination,
      hasPrev: searchResults.pagination.page > 1,
      hasNext: searchResults.pagination.page < searchResults.pagination.totalPages,
      prevPage: searchResults.pagination.page - 1,
      nextPage: searchResults.pagination.page + 1,
      pages: Array.from({ length: searchResults.pagination.totalPages }, (_, i) => ({
        number: i + 1,
        isCurrent: i + 1 === searchResults.pagination.page
      }))
    };

    // Prepare page data
    const pageData = {
      meta: {
        title: `"${query}" Arama Sonuçları - ${process.env.SITE_NAME}`,
        description: `"${query}" için arama sonuçları`,
        url: `${process.env.SITE_URL}/arama?q=${encodeURIComponent(query)}`,
        type: 'website'
      },
      searchQuery: query,
      articles: searchResults.articles.map(article => ({
        ...article,
        slug: urlSlugService.getSlugById(article.id) || 
              urlSlugService.generateSlug(article.title)
      })),
      pagination
    };

    // Render page (using category template for now)
    const html = await ssrEngine.render('pages/category.html', pageData);
    res.send(html);

  } catch (error) {
    console.error('Search page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Sitemap routes
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await sitemapService.generateSitemap();
    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Sitemap generation failed');
  }
});

router.get('/news-sitemap.xml', async (req, res) => {
  try {
    const newsSitemap = await sitemapService.generateNewsSitemap();
    res.set('Content-Type', 'application/xml');
    res.send(newsSitemap);
  } catch (error) {
    console.error('News sitemap error:', error);
    res.status(500).send('News sitemap generation failed');
  }
});

router.get('/robots.txt', async (req, res) => {
  try {
    const robots = await sitemapService.generateRobotsTxt();
    res.set('Content-Type', 'text/plain');
    res.send(robots);
  } catch (error) {
    console.error('Robots.txt error:', error);
    res.status(500).send('Robots.txt generation failed');
  }
});

/**
 * RSS feed route
 */
router.get('/rss.xml', async (req, res) => {
  try {
    const rssFeed = dataService.getRSSFeed();
    
    // Convert to RSS XML format
    const rssXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${process.env.SITE_NAME}</title>
    <description>${process.env.SITE_DESCRIPTION}</description>
    <link>${process.env.SITE_URL}</link>
    <language>tr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${process.env.SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    
    ${rssFeed.articles.map(article => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <description><![CDATA[${article.summary}]]></description>
      <link>${process.env.SITE_URL}/haber/${urlSlugService.getSlugById(article.id) || urlSlugService.generateSlug(article.title)}</link>
      <guid isPermaLink="true">${process.env.SITE_URL}/haber/${urlSlugService.getSlugById(article.id) || urlSlugService.generateSlug(article.title)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${article.category}</category>
      ${article.images?.[0] ? `<enclosure url="${article.images[0].highRes}" type="image/jpeg" length="0"/>` : ''}
    </item>
    `).join('')}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.send(rssXML);

  } catch (error) {
    console.error('RSS feed error:', error);
    res.status(500).send('RSS feed generation failed');
  }
});

/**
 * 404 handler
 */
router.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sayfa Bulunamadı - ${process.env.SITE_NAME}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #e53e3e; }
        a { color: #3182ce; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Sayfa Bulunamadı</h1>
      <p>Aradığınız sayfa mevcut değil.</p>
      <a href="/">Ana Sayfaya Dön</a>
    </body>
    </html>
  `);
});

module.exports = router;
