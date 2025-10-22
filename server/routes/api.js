const express = require('express');
const PlaceholderDataService = require('../services/placeholder-data');
const URLSlugService = require('../services/url-slug');

const router = express.Router();
const dataService = new PlaceholderDataService();
const urlSlugService = new URLSlugService();

/**
 * Get articles with pagination and filters
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
    console.error('API Articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

/**
 * Get single article by ID
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
    console.error('API Article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

/**
 * Get related articles
 */
router.get('/related/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    const relatedArticles = dataService.getRelatedArticles(id, parseInt(limit));

    // Add slugs to related articles
    const relatedWithSlugs = relatedArticles.map(article => ({
      ...article,
      slug: urlSlugService.getSlugById(article.id) || 
            urlSlugService.generateSlug(article.title)
    }));

    res.json({ articles: relatedWithSlugs });

  } catch (error) {
    console.error('API Related articles error:', error);
    res.status(500).json({ error: 'Failed to fetch related articles' });
  }
});

/**
 * Get related news by category
 */
router.get('/related-news', async (req, res) => {
  try {
    const { category, offset = 0, limit = 4 } = req.query;

    const articles = dataService.getArticles({
      category,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      limit: parseInt(limit),
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });

    // Add slugs to articles
    const articlesWithSlugs = articles.articles.map(article => ({
      ...article,
      slug: urlSlugService.getSlugById(article.id) || 
            urlSlugService.generateSlug(article.title)
    }));

    res.json({
      articles: articlesWithSlugs,
      hasMore: articles.pagination.page < articles.pagination.totalPages
    });

  } catch (error) {
    console.error('API Related news error:', error);
    res.status(500).json({ error: 'Failed to fetch related news' });
  }
});

/**
 * Get categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = dataService.getCategories();
    res.json({ categories });

  } catch (error) {
    console.error('API Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Submit comment
 */
router.post('/comments', async (req, res) => {
  try {
    const { name, email, comment, articleId } = req.body;

    // Validate input
    if (!name || !email || !comment || !articleId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send comment to backend
    const commentData = {
      name: name.trim(),
      email: email.trim(),
      content: comment.trim(),
      articleId,
      createdAt: new Date().toISOString()
    };

    // In a real implementation, this would send to backend
    // For now, we'll simulate success
    const newComment = {
      id: Date.now().toString(),
      ...commentData,
      likes: 0
    };

    res.status(201).json({ comment: newComment });

  } catch (error) {
    console.error('API Comment submission error:', error);
    res.status(500).json({ error: 'Failed to submit comment' });
  }
});

/**
 * Get comments for article
 */
router.get('/comments', async (req, res) => {
  try {
    const { articleId, offset = 0, limit = 10 } = req.query;

    if (!articleId) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    // In a real implementation, this would fetch from backend
    // For now, we'll return empty array
    const comments = [];
    const hasMore = false;

    res.json({ comments, hasMore });

  } catch (error) {
    console.error('API Comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * Like comment
 */
router.post('/comments/:id/like', async (req, res) => {
  try {
    const { id } = req.params;

    // In a real implementation, this would update the backend
    // For now, we'll simulate success
    res.json({ success: true, likes: Math.floor(Math.random() * 10) + 1 });

  } catch (error) {
    console.error('API Comment like error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

/**
 * Get breaking news
 */
router.get('/breaking-news', async (req, res) => {
  try {
    // Fetch recent articles marked as breaking news
    const breakingNews = dataService.getArticles({
      limit: 5,
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });

    // Add slugs to articles
    const breakingWithSlugs = breakingNews.articles.map(article => ({
      ...article,
      slug: urlSlugService.getSlugById(article.id) || 
            urlSlugService.generateSlug(article.title)
    }));

    res.json({ articles: breakingWithSlugs });

  } catch (error) {
    console.error('API Breaking news error:', error);
    res.status(500).json({ error: 'Failed to fetch breaking news' });
  }
});

/**
 * Get trending articles
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Fetch trending articles (in real implementation, this would be based on views/shares)
    const trendingArticles = dataService.getArticles({
      limit: parseInt(limit),
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });

    // Add slugs to articles
    const trendingWithSlugs = trendingArticles.articles.map(article => ({
      ...article,
      slug: urlSlugService.getSlugById(article.id) || 
            urlSlugService.generateSlug(article.title)
    }));

    res.json({ articles: trendingWithSlugs });

  } catch (error) {
    console.error('API Trending articles error:', error);
    res.status(500).json({ error: 'Failed to fetch trending articles' });
  }
});

/**
 * Get article slug by ID
 */
router.get('/slug/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slug = urlSlugService.getSlugById(id);

    if (!slug) {
      return res.status(404).json({ error: 'Slug not found' });
    }

    res.json({ id, slug });

  } catch (error) {
    console.error('API Slug error:', error);
    res.status(500).json({ error: 'Failed to fetch slug' });
  }
});

/**
 * Generate slug for article
 */
router.post('/slug', async (req, res) => {
  try {
    const { id, title } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'ID and title are required' });
    }

    const slug = urlSlugService.generateSlug(title);

    res.json({ id, title, slug });

  } catch (error) {
    console.error('API Slug generation error:', error);
    res.status(500).json({ error: 'Failed to generate slug' });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Cache statistics endpoint
 */
router.get('/cache/stats', (req, res) => {
  try {
    const backendStats = { hits: 0, misses: 0, keys: 0 };
    const slugStats = {
      totalSlugs: urlSlugService.getAllSlugs().length
    };

    res.json({
      backend: backendStats,
      slugs: slugStats
    });

  } catch (error) {
    console.error('API Cache stats error:', error);
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

/**
 * Clear cache endpoint
 */
router.post('/cache/clear', (req, res) => {
  try {
    // Clear cache (placeholder implementation)
    console.log('Cache cleared');
    res.json({ success: true, message: 'Cache cleared successfully' });

  } catch (error) {
    console.error('API Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
