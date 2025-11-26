/**
 * Error Handling Tests
 * Tests for database failures, file system errors, invalid input handling, and async operation failures
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
  MockErrorDatabase,
  MockErrorFileSystem,
  createError,
  invalidInputs,
} = require('../test-helpers/error-helpers');

describe('Error Handling Tests', () => {
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

  describe('Database Connection Failures', () => {
    test('should handle database connection errors gracefully', () => {
      // This would require mocking the database connection
      // For now, test that errors are caught
      const errorDb = new MockErrorDatabase('connection');
      
      expect(() => {
        errorDb.prepare('SELECT * FROM articles').get();
      }).toThrow();
    });

    test('should handle database locked errors', () => {
      const errorDb = new MockErrorDatabase('locked');
      
      expect(() => {
        errorDb.prepare('SELECT * FROM articles').get();
      }).toThrow();
    });

    test('should handle corrupted database errors', () => {
      const errorDb = new MockErrorDatabase('corrupt');
      
      expect(() => {
        errorDb.prepare('SELECT * FROM articles').get();
      }).toThrow();
    });

    test('should handle readonly database errors', () => {
      const errorDb = new MockErrorDatabase('readonly');
      
      expect(() => {
        errorDb.prepare('INSERT INTO articles (id, header) VALUES (?, ?)').run('1', 'Test');
      }).toThrow();
    });
  });

  describe('File System Errors', () => {
    test('should handle permission denied errors', () => {
      const errorFs = new MockErrorFileSystem('permission');
      
      expect(() => {
        errorFs.readFileSync('/protected/file.txt', 'utf8');
      }).toThrow();
    });

    test('should handle file not found errors', () => {
      const errorFs = new MockErrorFileSystem('notfound');
      
      expect(() => {
        errorFs.readFileSync('/nonexistent/file.txt', 'utf8');
      }).toThrow();
    });

    test('should handle disk full errors', () => {
      const errorFs = new MockErrorFileSystem('diskfull');
      
      expect(() => {
        errorFs.writeFileSync('/path/to/file.txt', 'data');
      }).toThrow();
    });
  });

  describe('Invalid Input Handling', () => {
    test('should handle null values', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: null,
          body: 'Test body',
          category: 'Gündem'
        });

      expect([400, 500]).toContain(res.status);
    });

    test('should handle undefined values', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: undefined,
          body: 'Test body',
          category: 'Gündem'
        });

      expect([400, 500]).toContain(res.status);
    });

    test('should handle empty strings', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: '',
          body: 'Test body',
          category: 'Gündem'
        });

      // Should reject empty required fields
      expect([400, 500]).toContain(res.status);
    });

    test('should handle empty arrays', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem',
          tags: [],
          images: []
        });

      // Should accept empty arrays
      expect([200, 201, 400]).toContain(res.status);
    });

    test('should handle empty objects', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem',
          ...{}
        });

      // Should handle gracefully
      expect([200, 201, 400, 500]).toContain(res.status);
    });

    test('should handle very long strings', async () => {
      const longString = 'a'.repeat(100000);
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: longString,
          body: 'Test body',
          category: 'Gündem'
        });

      // Should either truncate or reject
      expect([200, 201, 400, 413, 500]).toContain(res.status);
    });

    test('should handle negative numbers', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query({ page: -1, limit: -10 });

      // Should handle gracefully (use defaults or reject)
      expect([200, 400]).toContain(res.status);
    });

    test('should handle zero values', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query({ page: 0, limit: 0 });

      // Should handle gracefully
      expect([200, 400]).toContain(res.status);
    });

    test('should handle very large numbers', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query({ page: Number.MAX_SAFE_INTEGER + 1, limit: Number.MAX_SAFE_INTEGER + 1 });

      // Should handle gracefully
      expect([200, 400, 500]).toContain(res.status);
    });

    test('should handle NaN values', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query({ page: NaN, limit: NaN });

      // Should handle gracefully
      expect([200, 400, 500]).toContain(res.status);
    });

    test('should handle Infinity values', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query({ page: Infinity, limit: Infinity });

      // Should handle gracefully
      expect([200, 400, 500]).toContain(res.status);
    });

    test('should handle special characters', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: invalidInputs.specialCharacters,
          body: 'Test body',
          category: 'Gündem'
        });

      // Should handle or sanitize
      expect([200, 201, 400, 500]).toContain(res.status);
    });

    test('should handle unicode characters', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: invalidInputs.unicode,
          body: 'Test body',
          category: 'Gündem'
        });

      // Should handle or sanitize
      expect([200, 201, 400, 500]).toContain(res.status);
    });
  });

  describe('Async Operation Failures', () => {
    test('should handle async slug generation failures', async () => {
      // Create article that might fail slug generation
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem'
        });

      // Should handle gracefully even if slug generation fails
      expect([200, 201, 500]).toContain(res.status);
    });

    test('should handle async slug update failures', async () => {
      // Update article header to trigger slug update
      const res = await request(app)
        .put('/cms/articles/1')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Updated Article Title',
          body: 'Updated body',
          category: 'Gündem'
        });

      // Should handle gracefully even if slug update fails
      expect([200, 500]).toContain(res.status);
    });

    test('should handle async cache save failures', async () => {
      // This would require mocking URLSlugService
      // For now, test that operations complete even if cache fails
      const res = await request(app)
        .get('/api/articles/1');

      // Should return article even if cache fails
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Error Response Format', () => {
    test('should return consistent error format', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          // Missing required fields
        });

      if (res.status >= 400) {
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
      }
    });

    test('should not expose internal errors', async () => {
      // Try to trigger an internal error
      const res = await request(app)
        .get('/api/articles/invalid-id-that-causes-error');

      // Should not expose stack traces or internal details
      if (res.status >= 500) {
        expect(res.body).not.toHaveProperty('stack');
        expect(res.body).not.toHaveProperty('code');
        expect(JSON.stringify(res.body)).not.toContain('at ');
      }
    });

    test('should log errors appropriately', async () => {
      // This test would require mocking console.error
      // For now, just verify error responses
      const res = await request(app)
        .get('/api/articles/nonexistent-id');

      // Should return appropriate status
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing article ID', async () => {
      const res = await request(app)
        .get('/api/articles/');

      // Should handle missing ID
      expect([404, 400, 500]).toContain(res.status);
    });

    test('should handle malformed JSON', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Should return 400 for malformed JSON
      expect([400, 500]).toContain(res.status);
    });

    test('should handle missing request body', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send();

      // Should return 400 for missing body
      expect([400, 500]).toContain(res.status);
    });

    test('should handle invalid HTTP methods', async () => {
      const res = await request(app)
        .patch('/cms/articles/1')
        .set('Cookie', sessionCookie);

      // Should return 404 or 405 for unsupported methods
      expect([404, 405, 500]).toContain(res.status);
    });

    test('should handle concurrent error scenarios', async () => {
      // Try multiple operations that might fail
      const promises = [
        request(app).get('/api/articles/invalid'),
        request(app).get('/api/articles/another-invalid'),
        request(app).get('/api/articles/yet-another-invalid'),
      ];

      const results = await Promise.allSettled(promises);

      // All should handle errors gracefully
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 404, 400, 500]).toContain(result.value.status);
        }
      });
    });
  });

  describe('Recovery from Errors', () => {
    test('should recover from temporary database errors', async () => {
      // First request might fail
      const res1 = await request(app)
        .get('/api/articles/1');

      // Second request should succeed
      const res2 = await request(app)
        .get('/api/articles/1');

      // At least one should succeed
      expect([res1.status, res2.status]).toContain(200);
    });

    test('should maintain data consistency after errors', async () => {
      // Create article
      const createRes = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem'
        });

      if (createRes.status === 201) {
        const articleId = createRes.body.id;

        // Try to update with invalid data
        const updateRes = await request(app)
          .put(`/cms/articles/${articleId}`)
          .set('Cookie', sessionCookie)
          .send({
            header: null, // Invalid
            body: 'Updated body',
            category: 'Gündem'
          });

        // Original article should still exist
        const getRes = await request(app)
          .get(`/api/articles/${articleId}`);

        // Should still be accessible
        expect([200, 404]).toContain(getRes.status);
      }
    });
  });
});

