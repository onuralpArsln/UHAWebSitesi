const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const DataService = require('../services/data-service');
const URLSlugService = require('../services/url-slug');
const config = require('../services/config');

const router = express.Router();
const dataService = new DataService();
const urlSlugService = new URLSlugService();

const BRANDING_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/branding');
const BRANDING_WEB_PATH = '/uploads/branding';

const allowedImageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BRANDING_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const baseName = file.fieldname === 'footerLogo' ? 'footer-logo' : 'header-logo';
    cb(null, `${baseName}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya türü. Lütfen PNG, JPG, WEBP veya SVG yükleyin.'));
    }
  }
});

function toArray(value, delimiter = ',') {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(delimiter)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts;
  }
  return [];
}

function toLineArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function toImageArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Not JSON, fallback to line-based URLs
    }

    return toLineArray(trimmed).map((url) => ({
      url,
      alt: '',
      title: ''
    }));
  }

  return [];
}

function normalizeStatus(value) {
  if (!value) return 'visible';
  const normalized = value.toLowerCase();
  return normalized === 'hidden' ? 'hidden' : 'visible';
}

function normalizeColor(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
  if (hexMatch) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed.toLowerCase();
  }
  return fallback;
}

function mapArticleToSummary(article) {
  if (!article) return null;
  const summary = {
    id: article.id,
    header: article.header,
    summaryHead: article.summaryHead,
    category: article.category,
    writer: article.writer,
    status: article.status,
    creationDate: article.creationDate
  };

  if (article.updatedAt) {
    summary.updatedAt = article.updatedAt;
  }

  return summary;
}

function buildBrandingResponse(raw) {
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
  return {
    ...defaults,
    ...(raw || {})
  };
}

function formatBrandingForClient(raw) {
  const branding = buildBrandingResponse(raw);
  const normalizePath = (value) => {
    if (!value) return '';
    return value.startsWith('/uploads/') ? value : toWebPath(value);
  };

  return {
    ...branding,
    headerLogo: normalizePath(branding.headerLogo),
    footerLogo: normalizePath(branding.footerLogo)
  };
}

function toWebPath(filename) {
  if (!filename) return '';
  if (filename.startsWith('/')) return filename;
  return `${BRANDING_WEB_PATH}/${filename}`;
}

function removeOldBrandingAsset(relativePath) {
  if (!relativePath) return;
  if (!relativePath.startsWith(BRANDING_WEB_PATH)) return;
  const absolutePath = path.join(__dirname, '../../public', relativePath);
  if (absolutePath.startsWith(BRANDING_UPLOAD_DIR) && fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      console.warn('Branding asset cleanup failed:', error.message);
    }
  }
}

/**
 * Serve CMS panel
 */
router.get('/', (req, res) => {
  const articlesResult = dataService.getArticles({
    page: 1,
    limit: 50,
    sortBy: 'creationDate',
    sortOrder: 'desc'
  });

  const categories = dataService.getCategories();
  const statusSummary = dataService.getArticleStatusSummary();
  const branding = formatBrandingForClient(dataService.getBranding());
  const { layout: homepageLayout } = dataService.getHomepageLayout();

  const stats = {
    totalArticles: statusSummary.total,
    totalCategories: categories.length,
    visibleArticles: statusSummary.visible,
    hiddenArticles: statusSummary.hidden
  };

  const settings = {
    siteName: config.getSiteDefaults().name,
    siteDescription: config.getSiteDefaults().description,
    siteUrl: config.getSiteUrl(req),
    adsenseClientId: config.getFeatures().adsenseClientId,
    adsenseSlotId: config.getFeatures().adsenseSlotId
  };

  const targetOptions = ['carousel', 'manset', 'anasayfa', 'akış'];

  const articleSummaries = articlesResult.articles
    .map(mapArticleToSummary)
    .filter(Boolean);

  const initialState = {
    stats,
    articles: articleSummaries,
    categories,
    recentArticles: articleSummaries.slice(0, 5),
    settings,
    targetOptions,
    branding,
    homepageLayout
  };

  const initialStateJson = JSON.stringify(initialState).replace(/</g, '\\u003c');

  res.render('cms/pages/dashboard.njk', {
    pageTitle: 'UHA CMS',
    initialState,
    initialStateJson
  });
});

/**
 * Get current branding configuration
 */
router.get('/branding', (req, res) => {
  try {
    const branding = formatBrandingForClient(dataService.getBranding());
    res.json({ branding });
  } catch (error) {
    console.error('CMS Branding fetch error:', error);
    res.status(500).json({ error: 'Marka ayarları alınamadı' });
  }
});

/**
 * Update branding configuration (colors + logos)
 */
router.post('/branding', (req, res, next) => {
  const handleUpload = upload.fields([
    { name: 'headerLogo', maxCount: 1 },
    { name: 'footerLogo', maxCount: 1 }
  ]);

  handleUpload(req, res, (err) => {
    if (err) {
      console.error('CMS Branding upload error:', err);
      return res.status(400).json({ error: err.message || 'Dosya yükleme başarısız' });
    }
    next();
  });
}, (req, res) => {
  try {
    const current = dataService.getBranding();
    const body = req.body || {};

    const brandingUpdate = {
      siteName: body.siteName ? body.siteName.toString().trim() : current.siteName,
      primaryColor: normalizeColor(body.primaryColor, current.primaryColor),
      secondaryColor: normalizeColor(body.secondaryColor, current.secondaryColor),
      accentColor: normalizeColor(body.accentColor, current.accentColor),
      logoTextColor: normalizeColor(body.logoTextColor, current.logoTextColor),
      navTextColor: normalizeColor(body.navTextColor, current.navTextColor),
      navBackgroundColor: normalizeColor(body.navBackgroundColor, current.navBackgroundColor),
      headerLogo: current.headerLogo,
      footerLogo: current.footerLogo
    };

    const uploadedHeader = req.files?.headerLogo?.[0];
    const uploadedFooter = req.files?.footerLogo?.[0];

    if (uploadedHeader) {
      removeOldBrandingAsset(current.headerLogo);
      brandingUpdate.headerLogo = `${BRANDING_WEB_PATH}/${uploadedHeader.filename}`;
    }

    if (uploadedFooter) {
      removeOldBrandingAsset(current.footerLogo);
      brandingUpdate.footerLogo = `${BRANDING_WEB_PATH}/${uploadedFooter.filename}`;
    }

    const updatedBranding = dataService.updateBranding(brandingUpdate);
    const response = formatBrandingForClient(updatedBranding);

    res.json({
      success: true,
      branding: response
    });
  } catch (error) {
    console.error('CMS Branding update error:', error);
    res.status(500).json({ error: 'Marka ayarları güncellenemedi' });
  }
});

/**
 * Get CMS dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get recent articles
    const recentArticles = dataService.getArticles({ limit: 10 });

    // Get categories
    const categories = dataService.getCategories();

    // Get statistics
    const stats = {
      totalArticles: recentArticles.pagination.total,
      totalCategories: categories.length,
      recentArticles: recentArticles.articles.slice(0, 5)
    };

    res.json(stats);

  } catch (error) {
    console.error('CMS Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get articles for CMS
 */
router.get('/articles', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;

    const articles = dataService.getArticles({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search,
      sortBy,
      sortOrder
    });

    // Add slugs to articles
    const articlesWithSlugs = {
      ...articles,
      articles: articles.articles.map(article => ({
        ...article,
        slug: urlSlugService.getSlugById(article.id) ||
          urlSlugService.generateSlug(article.title)
      }))
    };

    res.json(articlesWithSlugs);

  } catch (error) {
    console.error('CMS Articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

/**
 * Get single article for editing
 */
router.get('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = dataService.getArticleById(id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Add slug to article
    const articleWithSlug = {
      ...article,
      slug: urlSlugService.getSlugById(article.id) ||
        urlSlugService.generateSlug(article.title)
    };

    res.json(articleWithSlug);

  } catch (error) {
    console.error('CMS Article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

/**
 * Create new article
 */
router.post('/articles', async (req, res) => {
  try {
    const articleData = req.body;

    // Validate required fields
    if (!articleData.header || !articleData.body) {
      return res.status(400).json({ error: 'Başlık ve metin alanları zorunludur' });
    }

    const normalizedArticle = {
      header: articleData.header,
      summaryHead: articleData.summaryHead,
      summary: articleData.summary,
      category: articleData.category,
      tags: toArray(articleData.tags),
      images: toImageArray(articleData.images),
      body: articleData.body,
      videoUrl: (articleData.videoUrl || articleData.video || '').toString().trim(),
      writer: articleData.writer ? articleData.writer.toString().trim() : '',
      creationDate: articleData.creationDate,
      source: articleData.source,
      outlinks: toLineArray(articleData.outlinks),
      targettedViews: toArray(articleData.targettedViews),
      relatedArticles: toArray(articleData.relatedArticles),
      status: normalizeStatus(articleData.status),
      pressAnnouncementId: (articleData.pressAnnouncementId || '').toString().trim()
    };

    // Create article
    const newArticle = dataService.createArticle({
      ...normalizedArticle,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Store slug mapping
    if (newArticle.id) {
      urlSlugService.getSlugForArticle(newArticle.id, newArticle.header);
    }

    res.status(201).json(newArticle);

  } catch (error) {
    console.error('CMS Create article error:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

/**
 * Update article
 */
router.put('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const articleData = req.body;
    const existingArticle = dataService.getArticleById(id);

    if (!existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Validate required fields
    if (!articleData.header || !articleData.body) {
      return res.status(400).json({ error: 'Başlık ve metin alanları zorunludur' });
    }

    const normalizedArticle = {
      header: articleData.header,
      summaryHead: articleData.summaryHead,
      summary: articleData.summary,
      category: articleData.category,
      tags: toArray(articleData.tags),
      images: toImageArray(articleData.images),
      body: articleData.body,
      videoUrl: (articleData.videoUrl || articleData.video || '').toString().trim(),
      writer: articleData.writer ? articleData.writer.toString().trim() : '',
      creationDate: articleData.creationDate,
      source: articleData.source,
      outlinks: toLineArray(articleData.outlinks),
      targettedViews: toArray(articleData.targettedViews),
      relatedArticles: toArray(articleData.relatedArticles),
      status: normalizeStatus(articleData.status),
      pressAnnouncementId: (articleData.pressAnnouncementId || '').toString().trim()
    };

    const headerChanged =
      normalizedArticle.header &&
      normalizedArticle.header !== (existingArticle.header || existingArticle.title || '');

    // Update article
    const updatedArticle = dataService.updateArticle(id, {
      ...normalizedArticle,
      updatedAt: new Date().toISOString()
    });

    if (!updatedArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Update slug if title changed
    if (headerChanged) {
      urlSlugService.updateSlug(id, normalizedArticle.header);
    }

    res.json(updatedArticle);

  } catch (error) {
    console.error('CMS Update article error:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

/**
 * Delete article
 */
router.delete('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete article from database
    const deleted = dataService.deleteArticle(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Remove slug mapping
    urlSlugService.deleteSlug(id);

    res.json({ success: true, message: 'Article deleted successfully' });

  } catch (error) {
    console.error('CMS Delete article error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

/**
 * Get categories for CMS
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = dataService.getCategories();
    res.json({ categories });

  } catch (error) {
    console.error('CMS Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Create category
 */
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ error: 'Kategori adı zorunludur' });
    }

    const trimmedName = name.toString().trim();
    const trimmedDescription = description ? description.toString().trim() : '';
    const slug = urlSlugService.generateSlug(trimmedName);

    const newCategory = dataService.createCategory({
      name: trimmedName,
      description: trimmedDescription,
      slug
    });

    res.status(201).json(newCategory);

  } catch (error) {
    console.error('CMS Create category error:', error);
    if (error && error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Bu kategori adı zaten kullanılıyor' });
    }
    res.status(500).json({ error: 'Kategori oluşturulamadı' });
  }
});

/**
 * Update category
 */
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ error: 'Kategori adı zorunludur' });
    }

    const trimmedName = name.toString().trim();
    const trimmedDescription = description !== undefined ? description.toString().trim() : undefined;
    const slug = urlSlugService.generateSlug(trimmedName);

    const updatedCategory = dataService.updateCategory(id, {
      name: trimmedName,
      description: trimmedDescription,
      slug
    });

    if (!updatedCategory) {
      return res.status(404).json({ error: 'Kategori bulunamadı' });
    }

    res.json(updatedCategory);
  } catch (error) {
    console.error('CMS Update category error:', error);
    if (error && error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Bu kategori adı zaten kullanılıyor' });
    }
    res.status(500).json({ error: 'Kategori güncellenemedi' });
  }
});

/**
 * Delete category
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = dataService.deleteCategory(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Kategori bulunamadı' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('CMS Delete category error:', error);
    res.status(500).json({ error: 'Kategori silinemedi' });
  }
});

/**
 * Get layout configurations
 */
router.get('/layouts', async (req, res) => {
  try {
    // In a real implementation, this would fetch from database
    const layouts = [
      {
        id: 'home-default',
        name: 'Default Homepage',
        template: 'home.html',
        widgets: [
          { type: 'carousel', position: 'hero', config: { autoplay: true } },
          { type: 'ad-placeholder', position: 'hero-bottom', config: { slot: 'hero' } },
          { type: 'related-news', position: 'content', config: { limit: 4 } }
        ]
      },
      {
        id: 'article-default',
        name: 'Default Article',
        template: 'article.html',
        widgets: [
          { type: 'ad-placeholder', position: 'content-top', config: { slot: 'content' } },
          { type: 'comment-section', position: 'content-bottom', config: {} },
          { type: 'related-news', position: 'sidebar', config: { limit: 3 } }
        ]
      }
    ];

    res.json({ layouts });

  } catch (error) {
    console.error('CMS Layouts error:', error);
    res.status(500).json({ error: 'Failed to fetch layouts' });
  }
});

/**
 * Save layout configuration
 */
router.post('/layouts', async (req, res) => {
  try {
    const layoutData = req.body;

    // Validate layout data
    if (!layoutData.name || !layoutData.template) {
      return res.status(400).json({ error: 'Layout name and template are required' });
    }

    // Save layout configuration
    const newLayout = {
      id: Date.now().toString(),
      ...layoutData,
      createdAt: new Date().toISOString()
    };

    // In a real implementation, this would save to database
    res.status(201).json(newLayout);

  } catch (error) {
    console.error('CMS Save layout error:', error);
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

/**
 * Update layout configuration
 */
router.put('/layouts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const layoutData = req.body;

    // Update layout configuration
    const updatedLayout = {
      id,
      ...layoutData,
      updatedAt: new Date().toISOString()
    };

    // In a real implementation, this would update in database
    res.json(updatedLayout);

  } catch (error) {
    console.error('CMS Update layout error:', error);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

/**
 * Get available widgets
 */
router.get('/widgets', async (req, res) => {
  try {
    const widgets = [
      {
        type: 'carousel',
        name: 'Carousel',
        description: 'Image carousel with navigation',
        config: {
          autoplay: { type: 'boolean', default: true },
          interval: { type: 'number', default: 5000 },
          showDots: { type: 'boolean', default: true },
          showArrows: { type: 'boolean', default: true }
        }
      },
      {
        type: 'ad-placeholder',
        name: 'Ad Placeholder',
        description: 'AdSense advertisement placeholder',
        config: {
          slot: { type: 'string', required: true },
          size: { type: 'select', options: ['banner', 'rectangle', 'square'] }
        }
      },
      {
        type: 'related-news',
        name: 'Related News',
        description: 'Related articles widget',
        config: {
          limit: { type: 'number', default: 4 },
          category: { type: 'string', optional: true }
        }
      },
      {
        type: 'comment-section',
        name: 'Comment Section',
        description: 'User comments and discussion',
        config: {
          allowAnonymous: { type: 'boolean', default: true },
          moderation: { type: 'boolean', default: true }
        }
      }
    ];

    res.json({ widgets });

  } catch (error) {
    console.error('CMS Widgets error:', error);
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

/**
 * Preview page with layout
 */
router.post('/preview', async (req, res) => {
  try {
    const { template, layout, data } = req.body;

    // In a real implementation, this would render the page with the layout
    // For now, we'll return a success response
    res.json({
      success: true,
      previewUrl: `/cms/preview/${Date.now()}`,
      message: 'Preview generated successfully'
    });

  } catch (error) {
    console.error('CMS Preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * Get CMS settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = {
      siteName: config.getSiteDefaults().name,
      siteDescription: config.getSiteDefaults().description,
      siteUrl: config.getSiteUrl(req),
      adsenseClientId: config.getFeatures().adsenseClientId,
      adsenseSlotId: config.getFeatures().adsenseSlotId
    };

    res.json({ settings });

  } catch (error) {
    console.error('CMS Settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Update CMS settings
 */
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    // In a real implementation, this would update environment variables or database
    // For now, we'll return a success response
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });

  } catch (error) {
    console.error('CMS Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
