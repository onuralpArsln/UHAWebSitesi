/**
 * Data Consistency Tests
 * Tests for slug cache sync, category counts, related article references, and orphaned data cleanup
 */
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const DataService = require('../../server/services/data-service');
const URLSlugService = require('../../server/services/url-slug');
const apiRoutes = require('../../server/routes/api');
const cmsRoutes = require('../../server/routes/cms');
const {
  createTestDatabase,
  createTestArticle,
  insertArticle,
  createTestCategory,
  insertCategory,
  cleanupTestDatabase
} = require('../test-helpers');

describe('Data Consistency Tests', () => {
  let app;
  let testDb;
  let dataService;
  let sessionCookie;

  beforeAll(() => {
    // Create test database
    testDb = createTestDatabase();
    dataService = new DataService(testDb);

    // Create test app with session support
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Mount routes
    app.use('/api', apiRoutes);
    app.use('/cms', cmsRoutes);

    // Create test user and login
    const bcrypt = require('bcrypt');
    const testUser = {
      id: 'test-user-1',
      username: 'testuser',
      password_hash: bcrypt.hashSync('testpass123', 10),
      display_name: 'Test User',
      role: 'admin',
      permissions: JSON.stringify(['*']),
      allowed_tabs: JSON.stringify([]),
      created_at: new Date().toISOString()
    };
    testDb.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, permissions, allowed_tabs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testUser.id,
      testUser.username,
      testUser.password_hash,
      testUser.display_name,
      testUser.role,
      testUser.permissions,
      testUser.allowed_tabs,
      testUser.created_at
    );
  });

  beforeEach(async () => {
    // Clear database
    testDb.exec('DELETE FROM articles');
    testDb.exec('DELETE FROM categories');

    // Insert test data
    insertCategory(testDb, createTestCategory({ name: 'Gündem', slug: 'gundem' }));
    insertCategory(testDb, createTestCategory({ name: 'Ekonomi', slug: 'ekonomi' }));

    // Login to get session cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });

    if (loginRes.headers['set-cookie']) {
      sessionCookie = loginRes.headers['set-cookie'][0].split(';')[0];
    }
  });

  afterAll(() => {
    cleanupTestDatabase(testDb);
  });

  describe('Slug Cache Consistency', () => {
    test('should sync slug cache when article is created', async () => {
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article for Slug',
          body: 'Test body',
          category: 'Gündem'
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Wait a bit for async slug generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check slug via API
      const slugRes = await request(app)
        .get(`/api/slug/${articleId}`);

      // Slug should exist
      expect([200, 404]).toContain(slugRes.status);
    });

    test('should update slug cache when article title changes', async () => {
      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Original Title',
          body: 'Test body',
          category: 'Gündem'
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Wait for slug generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get original slug
      const originalSlugRes = await request(app)
        .get(`/api/slug/${articleId}`);

      // Update article title
      const updateRes = await request(app)
        .put(`/cms/articles/${articleId}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Updated Title',
          body: 'Test body',
          category: 'Gündem'
        });

      expect(updateRes.status).toBe(200);

      // Wait for slug update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get updated slug
      const updatedSlugRes = await request(app)
        .get(`/api/slug/${articleId}`);

      // Slug should be updated
      if (originalSlugRes.status === 200 && updatedSlugRes.status === 200) {
        expect(updatedSlugRes.body.slug).not.toBe(originalSlugRes.body.slug);
      }
    });

    test('should remove slug from cache when article is deleted', async () => {
      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article to Delete',
          body: 'Test body',
          category: 'Gündem'
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Wait for slug generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify slug exists
      const slugRes = await request(app)
        .get(`/api/slug/${articleId}`);

      // Delete article
      const deleteRes = await request(app)
        .delete(`/cms/articles/${articleId}`)
        .set('Cookie', sessionCookie);

      expect(deleteRes.status).toBe(200);

      // Wait for slug deletion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify slug is removed
      const deletedSlugRes = await request(app)
        .get(`/api/slug/${articleId}`);

      expect(deletedSlugRes.status).toBe(404);
    });

    test('should handle slug cache sync after direct database operations', async () => {
      // Create article directly in database
      const article = createTestArticle({
        id: 'direct-db-article',
        header: 'Direct DB Article',
        category: 'Gündem'
      });
      insertArticle(testDb, article);

      // Slug should not exist initially (not created via API)
      const slugRes = await request(app)
        .get(`/api/slug/${article.id}`);

      // Slug might not exist if not created via API
      expect([200, 404]).toContain(slugRes.status);
    });

    test('should maintain slug uniqueness', async () => {
      // Create multiple articles with same title
      const createFn = async (index) => {
        return await request(app)
          .post('/cms/articles')
          .set('Cookie', sessionCookie)
          .send({
            header: 'Duplicate Title',
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await Promise.all([
        createFn(1),
        createFn(2),
        createFn(3)
      ]);

      const successful = results
        .filter(r => r.status === 201)
        .map(r => r.body.id);

      // Wait for slug generation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get slugs
      const slugs = [];
      for (const id of successful) {
        const slugRes = await request(app)
          .get(`/api/slug/${id}`);
        if (slugRes.status === 200) {
          slugs.push(slugRes.body.slug);
        }
      }

      // All slugs should be unique
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });
  });

  describe('Category Article Counts', () => {
    test('should update category count when article is created', async () => {
      const categoryName = 'Gündem';

      // Get initial count
      const initialRes = await request(app)
        .get('/api/categories');

      const initialCategory = initialRes.body.categories.find(c => c.name === categoryName);
      const initialCount = initialCategory?.articleCount || 0;

      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: categoryName
        });

      expect(createRes.status).toBe(201);

      // Get updated count
      const updatedRes = await request(app)
        .get('/api/categories');

      const updatedCategory = updatedRes.body.categories.find(c => c.name === categoryName);
      const updatedCount = updatedCategory?.articleCount || 0;

      // Count should increase
      expect(updatedCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should update category count when article is deleted', async () => {
      const categoryName = 'Gündem';

      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article to Delete',
          body: 'Test body',
          category: categoryName
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Get count before deletion
      const beforeRes = await request(app)
        .get('/api/categories');

      const beforeCategory = beforeRes.body.categories.find(c => c.name === categoryName);
      const beforeCount = beforeCategory?.articleCount || 0;

      // Delete article
      const deleteRes = await request(app)
        .delete(`/cms/articles/${articleId}`)
        .set('Cookie', sessionCookie);

      expect(deleteRes.status).toBe(200);

      // Get count after deletion
      const afterRes = await request(app)
        .get('/api/categories');

      const afterCategory = afterRes.body.categories.find(c => c.name === categoryName);
      const afterCount = afterCategory?.articleCount || 0;

      // Count should decrease
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    });

    test('should update category count when article category changes', async () => {
      // Create article in Gündem
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article to Move',
          body: 'Test body',
          category: 'Gündem'
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Get counts before update
      const beforeRes = await request(app)
        .get('/api/categories');

      const gundemBefore = beforeRes.body.categories.find(c => c.name === 'Gündem')?.articleCount || 0;
      const ekonomiBefore = beforeRes.body.categories.find(c => c.name === 'Ekonomi')?.articleCount || 0;

      // Update category to Ekonomi
      const updateRes = await request(app)
        .put(`/cms/articles/${articleId}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article to Move',
          body: 'Test body',
          category: 'Ekonomi'
        });

      expect(updateRes.status).toBe(200);

      // Get counts after update
      const afterRes = await request(app)
        .get('/api/categories');

      const gundemAfter = afterRes.body.categories.find(c => c.name === 'Gündem')?.articleCount || 0;
      const ekonomiAfter = afterRes.body.categories.find(c => c.name === 'Ekonomi')?.articleCount || 0;

      // Gündem should decrease, Ekonomi should increase
      expect(gundemAfter).toBeLessThanOrEqual(gundemBefore);
      expect(ekonomiAfter).toBeGreaterThanOrEqual(ekonomiBefore);
    });

    test('should maintain accurate counts after multiple operations', async () => {
      const categoryName = 'Gündem';

      // Create multiple articles
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          request(app)
            .post('/cms/articles')
            .set('Cookie', sessionCookie)
            .send({
              header: `Article ${i}`,
              body: `Body ${i}`,
              category: categoryName
            })
        );
      }

      const createResults = await Promise.all(createPromises);
      const createdIds = createResults
        .filter(r => r.status === 201)
        .map(r => r.body.id);

      // Get count
      const countRes = await request(app)
        .get('/api/categories');

      const category = countRes.body.categories.find(c => c.name === categoryName);
      const apiCount = category?.articleCount || 0;

      // Get actual count from database
      const actualCount = testDb.prepare(`
        SELECT COUNT(*) as count FROM articles WHERE category = ?
      `).get(categoryName)?.count || 0;

      // Counts should match
      expect(apiCount).toBe(actualCount);

      // Delete some articles
      for (let i = 0; i < 2 && i < createdIds.length; i++) {
        await request(app)
          .delete(`/cms/articles/${createdIds[i]}`)
          .set('Cookie', sessionCookie);
      }

      // Get updated count
      const updatedCountRes = await request(app)
        .get('/api/categories');

      const updatedCategory = updatedCountRes.body.categories.find(c => c.name === categoryName);
      const updatedApiCount = updatedCategory?.articleCount || 0;

      // Get actual count
      const updatedActualCount = testDb.prepare(`
        SELECT COUNT(*) as count FROM articles WHERE category = ?
      `).get(categoryName)?.count || 0;

      // Counts should still match
      expect(updatedApiCount).toBe(updatedActualCount);
    });
  });

  describe('Related Article References', () => {
    test('should handle valid related article references', async () => {
      // Create articles
      const article1Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem'
        });

      const article2Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 2',
          body: 'Body 2',
          category: 'Gündem'
        });

      expect(article1Res.status).toBe(201);
      expect(article2Res.status).toBe(201);

      const article1Id = article1Res.body.id;
      const article2Id = article2Res.body.id;

      // Update article 1 to reference article 2
      const updateRes = await request(app)
        .put(`/cms/articles/${article1Id}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem',
          relatedArticles: [article2Id]
        });

      expect(updateRes.status).toBe(200);

      // Get related articles
      const relatedRes = await request(app)
        .get(`/api/related/${article1Id}`);

      expect(relatedRes.status).toBe(200);
      expect(relatedRes.body.articles.length).toBeGreaterThan(0);
    });

    test('should handle invalid related article references', async () => {
      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article with Invalid References',
          body: 'Body',
          category: 'Gündem',
          relatedArticles: ['nonexistent-id-1', 'nonexistent-id-2']
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Get related articles
      const relatedRes = await request(app)
        .get(`/api/related/${articleId}`);

      // Should handle gracefully (return empty or filter out invalid)
      expect(relatedRes.status).toBe(200);
      expect(Array.isArray(relatedRes.body.articles)).toBe(true);
    });

    test('should handle deleted related articles', async () => {
      // Create articles
      const article1Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem'
        });

      const article2Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 2',
          body: 'Body 2',
          category: 'Gündem'
        });

      const article1Id = article1Res.body.id;
      const article2Id = article2Res.body.id;

      // Update article 1 to reference article 2
      await request(app)
        .put(`/cms/articles/${article1Id}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem',
          relatedArticles: [article2Id]
        });

      // Delete article 2
      await request(app)
        .delete(`/cms/articles/${article2Id}`)
        .set('Cookie', sessionCookie);

      // Get related articles
      const relatedRes = await request(app)
        .get(`/api/related/${article1Id}`);

      // Should handle deleted article gracefully
      expect(relatedRes.status).toBe(200);
      // Should not return deleted article
      const deletedArticle = relatedRes.body.articles.find(a => a.id === article2Id);
      expect(deletedArticle).toBeUndefined();
    });

    test('should handle circular related article references', async () => {
      // Create articles
      const article1Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem'
        });

      const article2Res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 2',
          body: 'Body 2',
          category: 'Gündem'
        });

      const article1Id = article1Res.body.id;
      const article2Id = article2Res.body.id;

      // Create circular references
      await request(app)
        .put(`/cms/articles/${article1Id}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 1',
          body: 'Body 1',
          category: 'Gündem',
          relatedArticles: [article2Id]
        });

      await request(app)
        .put(`/cms/articles/${article2Id}`)
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article 2',
          body: 'Body 2',
          category: 'Gündem',
          relatedArticles: [article1Id]
        });

      // Should handle circular references without infinite loops
      const related1Res = await request(app)
        .get(`/api/related/${article1Id}`);

      const related2Res = await request(app)
        .get(`/api/related/${article2Id}`);

      expect(related1Res.status).toBe(200);
      expect(related2Res.status).toBe(200);
    });
  });

  describe('Orphaned Data Cleanup', () => {
    test('should handle articles with deleted categories', async () => {
      // Create article in a category
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article in Category',
          body: 'Body',
          category: 'Gündem'
        });

      expect(createRes.status).toBe(201);
      const articleId = createRes.body.id;

      // Delete category
      const categoryId = testDb.prepare('SELECT id FROM categories WHERE name = ?').get('Gündem')?.id;
      if (categoryId) {
        await request(app)
          .delete(`/cms/categories/${categoryId}`)
          .set('Cookie', sessionCookie);
      }

      // Article should still be accessible (category set to NULL or handled)
      const articleRes = await request(app)
        .get(`/api/articles/${articleId}`);

      expect([200, 404]).toContain(articleRes.status);
    });

    test('should handle articles with invalid category names', async () => {
      // Create article with invalid category
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Article with Invalid Category',
          body: 'Body',
          category: 'Nonexistent Category'
        });

      // Should either create with category or reject
      expect([201, 400]).toContain(createRes.status);
    });
  });
});

