const express = require('express');
const path = require('path');
const DataService = require('../services/data-service');
const URLSlugService = require('../services/url-slug');

const router = express.Router();
const dataService = new DataService();
const urlSlugService = new URLSlugService();

/**
 * Serve CMS panel
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../cms/index.html'));
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
    if (!articleData.title || !articleData.content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Generate slug
    const slug = urlSlugService.generateSlug(articleData.title);

    // Create article
    const newArticle = dataService.createArticle({
      ...articleData,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Store slug mapping
    if (newArticle.id) {
      urlSlugService.getSlugForArticle(newArticle.id, newArticle.title);
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

    // Validate required fields
    if (!articleData.title || !articleData.content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Update article
    const updatedArticle = dataService.updateArticle(id, {
      ...articleData,
      updatedAt: new Date().toISOString()
    });

    // Update slug if title changed
    if (updatedArticle.title !== articleData.title) {
      urlSlugService.updateSlug(id, updatedArticle.title);
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

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Create category
    const newCategory = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date().toISOString()
    };

    // In a real implementation, this would save to backend
    res.status(201).json(newCategory);

  } catch (error) {
    console.error('CMS Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
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
      siteName: process.env.SITE_NAME || 'UHA News',
      siteDescription: process.env.SITE_DESCRIPTION || 'Latest news and updates',
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
      adsenseSlotId: process.env.ADSENSE_SLOT_ID || ''
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
