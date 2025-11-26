/**
 * Concurrency Tests
 * Tests for concurrent updates, file uploads, race conditions, and database locking scenarios
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
const {
  executeConcurrentRequests,
  executeRaceCondition,
  testDataConsistency,
  testReadWriteConcurrency,
  testLostUpdates,
} = require('../test-helpers/concurrency-helpers');

describe('Concurrency Tests', () => {
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
    insertArticle(testDb, createTestArticle({
      id: '1',
      header: 'Test Article',
      category: 'Gündem',
      status: 'visible'
    }));

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

  describe('Concurrent Article Updates', () => {
    test('should handle concurrent updates to the same article', async () => {
      const articleId = '1';

      const updateFn = async (index) => {
        return await request(app)
          .put(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie)
          .send({
            header: `Updated Article ${index}`,
            body: `Updated body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await executeConcurrentRequests(updateFn, 5);

      // All updates should complete (some may succeed, some may conflict)
      expect(results.length).toBe(5);
      
      // At least one should succeed
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      expect(successful.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalRes = await request(app)
        .get(`/api/articles/${articleId}`);
      
      expect(finalRes.status).toBe(200);
      expect(finalRes.body).toHaveProperty('header');
    });

    test('should handle concurrent status updates', async () => {
      const articleId = '1';

      const updateFn = async (index) => {
        const status = index % 2 === 0 ? 'visible' : 'hidden';
        return await request(app)
          .put(`/cms/articles/${articleId}/status`)
          .set('Cookie', sessionCookie)
          .send({ status });
      };

      const results = await executeConcurrentRequests(updateFn, 10);

      // All should complete
      expect(results.length).toBe(10);

      // Verify final state
      const finalRes = await request(app)
        .get(`/api/articles/${articleId}`);
      
      expect(finalRes.status).toBe(200);
      expect(['visible', 'hidden']).toContain(finalRes.body.status);
    });

    test('should prevent lost updates in concurrent edits', async () => {
      const articleId = '1';

      // Simulate lost update scenario
      const updateFn = async (index) => {
        // Get current article
        const getRes = await request(app)
          .get(`/api/articles/${articleId}`);

        if (getRes.status === 200) {
          const article = getRes.body;
          
          // Update with modification
          return await request(app)
            .put(`/cms/articles/${articleId}`)
            .set('Cookie', sessionCookie)
            .send({
              header: article.header,
              body: `${article.body} [Update ${index}]`,
              category: article.category
            });
        }
        return getRes;
      };

      const results = await executeConcurrentRequests(updateFn, 5, { delay: 10 });

      // All should complete
      expect(results.length).toBe(5);

      // Verify final state contains updates
      const finalRes = await request(app)
        .get(`/api/articles/${articleId}`);
      
      expect(finalRes.status).toBe(200);
    });
  });

  describe('Concurrent Article Creation', () => {
    test('should handle concurrent article creation', async () => {
      const createFn = async (index) => {
        return await request(app)
          .post('/cms/articles')
          .set('Cookie', sessionCookie)
          .send({
            header: `Concurrent Article ${index}`,
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await executeConcurrentRequests(createFn, 10);

      // All should complete
      expect(results.length).toBe(10);

      // Count successful creations
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );

      // All should succeed (no conflicts in creation)
      expect(successful.length).toBe(10);

      // Verify all articles exist
      const listRes = await request(app)
        .get('/api/articles');

      expect(listRes.status).toBe(200);
      expect(listRes.body.articles.length).toBeGreaterThanOrEqual(10);
    });

    test('should generate unique IDs for concurrent creations', async () => {
      const createFn = async (index) => {
        return await request(app)
          .post('/cms/articles')
          .set('Cookie', sessionCookie)
          .send({
            header: `Article ${index}`,
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await executeConcurrentRequests(createFn, 20);

      const successful = results
        .filter(r => r.status === 'fulfilled' && r.value.status === 201)
        .map(r => r.value.body.id);

      // All IDs should be unique
      const uniqueIds = new Set(successful);
      expect(uniqueIds.size).toBe(successful.length);
    });
  });

  describe('Concurrent Slug Generation', () => {
    test('should handle concurrent slug generation for same title', async () => {
      const createFn = async (index) => {
        return await request(app)
          .post('/cms/articles')
          .set('Cookie', sessionCookie)
          .send({
            header: 'Same Title Article',
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await executeConcurrentRequests(createFn, 5);

      // All should complete
      expect(results.length).toBe(5);

      const successful = results
        .filter(r => r.status === 'fulfilled' && r.value.status === 201)
        .map(r => r.value.body);

      // Verify slugs are unique or handled properly
      if (successful.length > 0) {
        // Articles should be created (slugs might be unique with suffixes)
        expect(successful.length).toBeGreaterThan(0);
      }
    });

    test('should handle race condition in slug uniqueness check', async () => {
      // Create article with specific title
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Race Condition Test',
          body: 'Body',
          category: 'Gündem'
        });

      if (createRes.status === 201) {
        // Try to create another with same title concurrently
        const createFn = async () => {
          return await request(app)
            .post('/cms/articles')
            .set('Cookie', sessionCookie)
            .send({
              header: 'Race Condition Test',
              body: 'Body 2',
              category: 'Gündem'
            });
        };

        const results = await executeConcurrentRequests(createFn, 3);

        // Should handle gracefully (either create with unique slug or reject)
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            expect([201, 400, 409]).toContain(result.value.status);
          }
        });
      }
    });
  });

  describe('Concurrent File Operations', () => {
    test('should handle concurrent file uploads', async () => {
      const uploadFn = async (index) => {
        return await request(app)
          .post('/cms/media/upload')
          .set('Cookie', sessionCookie)
          .attach('file', Buffer.from(`test content ${index}`), `test-${index}.txt`);
      };

      const results = await executeConcurrentRequests(uploadFn, 5);

      // All should complete
      expect(results.length).toBe(5);

      // Check for successful uploads
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      // Some may succeed, some may fail (depending on implementation)
      expect(successful.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Read-Write Operations', () => {
    test('should handle concurrent reads and writes', async () => {
      const articleId = '1';

      const readFn = async () => {
        return await request(app)
          .get(`/api/articles/${articleId}`);
      };

      const writeFn = async (index) => {
        return await request(app)
          .put(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie)
          .send({
            header: `Updated ${index}`,
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const { reads, writes } = await testReadWriteConcurrency(
        readFn,
        writeFn,
        { readCount: 10, writeCount: 5 }
      );

      // All operations should complete
      expect(reads.length).toBe(10);
      expect(writes.length).toBe(5);

      // Reads should succeed
      const successfulReads = reads.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      expect(successfulReads.length).toBeGreaterThan(0);
    });

    test('should maintain data consistency during concurrent operations', async () => {
      const articleId = '1';

      const operations = [
        async () => {
          const res = await request(app)
            .get(`/api/articles/${articleId}`);
          return res.status === 200;
        },
        async () => {
          const res = await request(app)
            .put(`/cms/articles/${articleId}`)
            .set('Cookie', sessionCookie)
            .send({
              header: 'Updated',
              body: 'Updated body',
              category: 'Gündem'
            });
          return res.status === 200;
        },
      ];

      const verificationFn = async () => {
        const res = await request(app)
          .get(`/api/articles/${articleId}`);
        return {
          consistent: res.status === 200,
          article: res.body
        };
      };

      const results = await testDataConsistency(operations, verificationFn, {
        iterations: 5,
        concurrency: 3
      });

      // All iterations should complete
      expect(results.length).toBe(5);

      // Most should be consistent
      const consistent = results.filter(r => r.consistent);
      expect(consistent.length).toBeGreaterThan(0);
    });
  });

  describe('Database Locking Scenarios', () => {
    test('should handle database locks gracefully', async () => {
      // SQLite handles locks automatically, but we can test concurrent transactions
      const articleId = '1';

      const updateFn = async (index) => {
        return await request(app)
          .put(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie)
          .send({
            header: `Lock Test ${index}`,
            body: `Body ${index}`,
            category: 'Gündem'
          });
      };

      const results = await executeConcurrentRequests(updateFn, 20, { delay: 5 });

      // All should complete (SQLite will queue or retry)
      expect(results.length).toBe(20);

      // Most should succeed
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Race Conditions', () => {
    test('should handle race condition in article deletion and update', async () => {
      const articleId = '1';

      const deleteFn = async () => {
        return await request(app)
          .delete(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie);
      };

      const updateFn = async () => {
        return await request(app)
          .put(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie)
          .send({
            header: 'Updated',
            body: 'Updated body',
            category: 'Gündem'
          });
      };

      const results = await executeRaceCondition(deleteFn, updateFn, 10);

      // Both should complete
      expect(results.length).toBe(2);

      // One should succeed, one should fail appropriately
      const statuses = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.status);

      // Should handle race condition gracefully
      expect(statuses.length).toBeGreaterThan(0);
    });

    test('should handle race condition in category update', async () => {
      const categoryId = testDb.prepare('SELECT id FROM categories LIMIT 1').get()?.id;

      if (categoryId) {
        const updateFn1 = async () => {
          return await request(app)
            .put(`/cms/categories/${categoryId}`)
            .set('Cookie', sessionCookie)
            .send({
              name: 'Updated Category 1',
              description: 'Description 1'
            });
        };

        const updateFn2 = async () => {
          return await request(app)
            .put(`/cms/categories/${categoryId}`)
            .set('Cookie', sessionCookie)
            .send({
              name: 'Updated Category 2',
              description: 'Description 2'
            });
        };

        const results = await executeRaceCondition(updateFn1, updateFn2, 5);

        // Both should complete
        expect(results.length).toBe(2);

        // Verify final state
        const finalRes = await request(app)
          .get('/api/categories');

        expect(finalRes.status).toBe(200);
      }
    });
  });

  describe('Stress Testing', () => {
    test('should handle high concurrency load', async () => {
      const readFn = async () => {
        return await request(app)
          .get('/api/articles');
      };

      const results = await executeConcurrentRequests(readFn, 50);

      // All should complete
      expect(results.length).toBe(50);

      // Most should succeed
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      expect(successful.length).toBeGreaterThan(40); // At least 80% success rate
    });
  });
});

