const express = require('express');
const DataService = require('../services/data-service');
const URLSlugService = require('../services/url-slug');
const SitemapService = require('../services/sitemap');
const config = require('../services/config');
const {
  buildMeta,
  buildNewsArticleSchema,
  optimizeImageData
} = require('../services/view-helpers');

const router = express.Router();
const dataService = new DataService();
const urlSlugService = new URLSlugService();
const sitemapService = new SitemapService(dataService, urlSlugService);
const BRANDING_WEB_PATH = '/uploads/branding';

function formatBranding(raw) {
  const defaults = {
    siteName: 'UHA News',
    primaryColor: '#1a365d',
    secondaryColor: '#2d3748',
    accentColor: '#3182ce',
    logoTextColor: '#3182ce',
    navTextColor: '#ffffff',
    navBackgroundColor: '#1a365d',
    headerLogo: '',
    footerLogo: ''
  };

  const branding = { ...defaults, ...(raw || {}) };
  const ensurePath = (value) => {
    if (!value) return '';
    return value.startsWith('/uploads/') ? value : `${BRANDING_WEB_PATH}/${value.replace(/^\/+/, '')}`;
  };

  branding.headerLogo = ensurePath(branding.headerLogo);
  branding.footerLogo = ensurePath(branding.footerLogo);

  return branding;
}

function buildNavCategories(categories = []) {
  const BASE_PATH = config.getBasePath();

  const items = categories.map(category => {
    const slug = category.slug || urlSlugService.generateSlug(category.name);
    return {
      name: category.name,
      slug,
      href: `${BASE_PATH}/kategori/${slug}`
    };
  });

  return [
    {
      name: 'Ana Sayfa',
      slug: '',
      href: `${BASE_PATH}/`
    },
    ...items
  ];
}

/**
 * Homepage route
 */
router.get('/', async (req, res) => {
  try {
    // Fetch homepage layout configuration
    const { layout } = dataService.getHomepageLayout();

    // Fetch categories for navigation
    const categories = dataService.getCategories();
    const navCategories = buildNavCategories(categories);

    // Process layout and fetch data for each widget
    const processedLayout = layout.map(widget => {
      const widgetData = { ...widget, data: {} };

      switch (widget.type) {
        case 'carousel':
        case 'featured-news-grid':
          // Fetch featured articles
          if (widget.config.source === 'featured') {
            const featuredArticles = dataService.getArticles({
              limit: widget.type === 'carousel' ? 8 : 8,
              sortBy: 'publishedAt',
              sortOrder: 'desc'
            });
            widgetData.data.articles = featuredArticles.articles.map(article => ({
              ...article,
              images: optimizeImageData(article.images),
              slug: urlSlugService.getSlugById(article.id) ||
                urlSlugService.generateSlug(article.title)
            }));
          }
          break;

        case 'category-feed':
          // Fetch articles for specific category
          if (widget.config.category) {
            const categoryArticles = dataService.getArticles({
              category: widget.config.category,
              limit: 4,
              sortBy: 'publishedAt',
              sortOrder: 'desc'
            });
            widgetData.data.articles = categoryArticles.articles.map(article => ({
              ...article,
              images: optimizeImageData(article.images),
              slug: urlSlugService.getSlugById(article.id) ||
                urlSlugService.generateSlug(article.title)
            }));
          }
          break;

        // Other widget types don't need data fetching
        case 'hero-title':
        case 'ad-placeholder':
        default:
          break;
      }

      return widgetData;
    });

    // Branding data
    const branding = formatBranding(dataService.getBranding());

    // Prepare page data
    const meta = buildMeta({
      image: `${config.getSiteUrl(req)}/static/images/og-home.jpg`
    }, req);

    const pageData = {
      meta,
      branding,
      layout: processedLayout,
      navCategories,
      flashNewsItems: [],  // TODO: Add flash news data fetching
      jsonLd: null
    };

    res.render('pages/home.njk', pageData);
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
    const categories = dataService.getCategories();
    const navCategories = buildNavCategories(categories);
    const articleCategory = categories.find(cat => cat.name === article.category);
    const articleCategorySlug = articleCategory?.slug ||
      (article.category ? urlSlugService.generateSlug(article.category) : '');

    // Branding data
    const branding = formatBranding(dataService.getBranding());

    // Prepare page data
    const siteUrl = config.getSiteUrl(req);
    const siteDefaults = config.getSiteDefaults();
    const meta = buildMeta({
      title: `${article.title} - ${siteDefaults.name}`,
      description: article.summary,
      url: `${siteUrl}/haber/${slug}`,
      image: article.images?.[0]?.highRes,
      type: 'article'
    }, req);

    const articleSchema = buildNewsArticleSchema({
      ...article,
      slug,
      images: optimizeImageData(article.images)
    }, req);

    const pageData = {
      meta,
      branding,
      article: {
        ...article,
        slug,
        images: optimizeImageData(article.images),
        categorySlug: articleCategorySlug
      },
      relatedArticles: relatedArticles.map(related => ({
        ...related,
        slug: urlSlugService.getSlugById(related.id) ||
          urlSlugService.generateSlug(related.title)
      })),
      navCategories,
      jsonLd: articleSchema
    };

    res.render('pages/article.njk', pageData);
  } catch (error) {
    console.error('Article page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Redirect direct category name URLs to /kategori/:slug
 * This handles URLs like /ekonomi → /kategori/ekonomi
 */
router.get('/:potentialCategorySlug', async (req, res, next) => {
  try {
    const { potentialCategorySlug } = req.params;
    const BASE_PATH = config.getBasePath();

    // Skip if this is a known route path
    const knownPaths = ['haber', 'kategori', 'arama', 'sitemap.xml', 'news-sitemap.xml', 'robots.txt', 'rss.xml', 'cms', 'api', 'static', 'css', 'js', 'uploads'];
    if (knownPaths.includes(potentialCategorySlug)) {
      return next();
    }

    // Normalize the potential category slug from URL
    const normalizedPotentialSlug = urlSlugService.normalizeSlugFromUrl(potentialCategorySlug);

    // Check if this matches a category slug
    const categories = dataService.getCategories();
    const matchingCategory = categories.find(cat => {
      const storedSlug = cat.slug || '';
      const generatedSlug = urlSlugService.generateSlug(cat.name);
      // Match against normalized slug from URL
      return storedSlug === normalizedPotentialSlug || generatedSlug === normalizedPotentialSlug;
    });

    if (matchingCategory) {
      const categorySlug = matchingCategory.slug || urlSlugService.generateSlug(matchingCategory.name);
      return res.redirect(302, `${BASE_PATH}/kategori/${categorySlug}`);
    }

    // Not a category, continue to next route/404
    next();
  } catch (error) {
    console.error('Category redirect error:', error);
    next();
  }
});

/**
 * Category page route
 */
router.get('/kategori/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;

    // Normalize the slug from URL (handles URL-encoded Turkish characters)
    const normalizedSlug = urlSlugService.normalizeSlugFromUrl(categorySlug);

    // Find category by slug - check both stored slug and generated slug
    const categories = dataService.getCategories();
    const navCategories = buildNavCategories(categories);
    const category = categories.find(cat => {
      const storedSlug = cat.slug || '';
      const generatedSlug = urlSlugService.generateSlug(cat.name);
      // Match against normalized slug from URL
      return storedSlug === normalizedSlug || generatedSlug === normalizedSlug;
    });

    if (!category) {
      return res.status(404).send('Category not found');
    }

    // Get canonical slug (prefer stored slug, fallback to generated slug)
    const canonicalSlug = category.slug || urlSlugService.generateSlug(category.name);

    // Redirect to canonical slug if normalized slug matches but URL doesn't (for SEO consistency)
    // This handles cases where URL has Turkish characters but normalizes to the same slug
    if (normalizedSlug === canonicalSlug && categorySlug !== canonicalSlug) {
      const BASE_PATH = config.getBasePath();
      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      return res.redirect(301, `${BASE_PATH}/kategori/${canonicalSlug}${queryString}`);
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

    // Branding data
    const branding = formatBranding(dataService.getBranding());

    // Prepare page data
    const siteUrl = config.getSiteUrl(req);
    const siteDefaults = config.getSiteDefaults();
    const meta = buildMeta({
      title: `${category.name} Haberleri - ${siteDefaults.name}`,
      description: `${category.name} kategorisindeki son haberler ve güncel gelişmeler`,
      url: `${siteUrl}/kategori/${canonicalSlug}`,
      image: `${siteUrl}/static/images/category-${canonicalSlug}.jpg`
    }, req);

    const pageData = {
      meta,
      branding,
      category: {
        ...category,
        slug: canonicalSlug
      },
      articles: articlesData.articles.map(article => ({
        ...article,
        images: optimizeImageData(article.images),
        slug: urlSlugService.getSlugById(article.id) ||
          urlSlugService.generateSlug(article.title)
      })),
      navCategories,
      pagination,
      jsonLd: null
    };

    res.render('pages/category.njk', pageData);
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
    const BASE_PATH = config.getBasePath();

    if (!query) {
      return res.redirect(`${BASE_PATH}/`);
    }

    // Search articles
    const searchResults = dataService.getArticles({
      search: query,
      page: parseInt(page),
      limit: 12,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });
    const categories = dataService.getCategories();
    const navCategories = buildNavCategories(categories);

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

    // Branding data
    const branding = formatBranding(dataService.getBranding());

    // Prepare page data
    const siteUrl = config.getSiteUrl(req);
    const siteDefaults = config.getSiteDefaults();
    const meta = buildMeta({
      title: `"${query}" Arama Sonuçları - ${siteDefaults.name}`,
      description: `"${query}" için arama sonuçları`,
      url: `${siteUrl}/arama?q=${encodeURIComponent(query)}`
    }, req);

    const pageData = {
      meta,
      branding,
      searchQuery: query,
      articles: searchResults.articles.map(article => ({
        ...article,
        images: optimizeImageData(article.images),
        slug: urlSlugService.getSlugById(article.id) ||
          urlSlugService.generateSlug(article.title)
      })),
      navCategories,
      pagination,
      jsonLd: null
    };

    res.render('pages/search.njk', pageData);
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
    const sitemap = await sitemapService.generateSitemap(req);
    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Sitemap generation failed');
  }
});

router.get('/news-sitemap.xml', async (req, res) => {
  try {
    const newsSitemap = await sitemapService.generateNewsSitemap(req);
    res.set('Content-Type', 'application/xml');
    res.send(newsSitemap);
  } catch (error) {
    console.error('News sitemap error:', error);
    res.status(500).send('News sitemap generation failed');
  }
});

router.get('/robots.txt', async (req, res) => {
  try {
    const robots = await sitemapService.generateRobotsTxt(req);
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
    const siteUrl = config.getSiteUrl(req);
    const siteDefaults = config.getSiteDefaults();

    // Convert to RSS XML format
    const rssXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteDefaults.name}</title>
    <description>${siteDefaults.description}</description>
    <link>${siteUrl}</link>
    <language>tr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    
    ${rssFeed.articles.map(article => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <description><![CDATA[${article.summary}]]></description>
      <link>${siteUrl}/haber/${urlSlugService.getSlugById(article.id) || urlSlugService.generateSlug(article.title)}</link>
      <guid isPermaLink="true">${siteUrl}/haber/${urlSlugService.getSlugById(article.id) || urlSlugService.generateSlug(article.title)}</guid>
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
  const siteDefaults = config.getSiteDefaults();
  const BASE_PATH = config.getBasePath();
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sayfa Bulunamadı - ${siteDefaults.name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #e53e3e; }
        a { color: #3182ce; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Sayfa Bulunamadı</h1>
      <p>Aradığınız sayfa mevcut değil.</p>
      <a href="${BASE_PATH}/">Ana Sayfaya Dön</a>
    </body>
    </html>
  `);
});

module.exports = router;
