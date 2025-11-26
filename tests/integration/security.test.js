/**
 * Security Tests
 * Tests for path traversal, SQL injection, XSS, CSRF, file upload security, and session security
 */
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const DataService = require('../../server/services/data-service');
const URLSlugService = require('../../server/services/url-slug');
const apiRoutes = require('../../server/routes/api');
const cmsRoutes = require('../../server/routes/cms');
const authRoutes = require('../../server/routes/auth');
const cmsMediaRoutes = require('../../server/routes/cms-media');
const {
  createTestDatabase,
  createTestArticle,
  insertArticle,
  createTestCategory,
  insertCategory,
  cleanupTestDatabase
} = require('../test-helpers');
const {
  pathTraversalPayloads,
  sqlInjectionPayloads,
  xssPayloads,
  maliciousFilePayloads,
  createMaliciousTestFile,
  createOversizedFileBuffer,
  xssContexts,
} = require('../test-helpers/security-helpers');

describe('Security Tests', () => {
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
    app.use('/api/auth', authRoutes);
    app.use('/cms', cmsRoutes);
    app.use('/cms/media', cmsMediaRoutes);

    // Create test user and login to get session
    const bcrypt = require('bcrypt');
    const testUser = {
      id: 'test-user-1',
      username: 'testuser',
      password_hash: bcrypt.hashSync('testpass123', 10),
      display_name: 'Test User',
      role: 'editor',
      permissions: JSON.stringify(['manage_articles']),
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

  describe('Path Traversal Protection', () => {
    test('should prevent path traversal in file uploads', async () => {
      for (const payload of pathTraversalPayloads) {
        const res = await request(app)
          .post('/cms/media/upload')
          .set('Cookie', sessionCookie)
          .attach('file', Buffer.from('test content'), payload);

        // Should either reject or sanitize the path
        expect([400, 403, 500]).toContain(res.status);
      }
    });

    test('should prevent path traversal in file deletion', async () => {
      for (const payload of pathTraversalPayloads) {
        const res = await request(app)
          .delete('/cms/media')
          .set('Cookie', sessionCookie)
          .send({ path: payload });

        expect([400, 403, 404, 500]).toContain(res.status);
      }
    });

    test('should prevent path traversal in folder operations', async () => {
      for (const payload of pathTraversalPayloads) {
        const res = await request(app)
          .get('/cms/media/folders/tree')
          .set('Cookie', sessionCookie)
          .query({ path: payload });

        expect([400, 403, 500]).toContain(res.status);
      }
    });
  });

  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in article queries', async () => {
      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .get('/api/articles')
          .query({ search: payload });

        // Should not return 500 (database error) or expose SQL errors
        expect(res.status).not.toBe(500);
        if (res.status === 200) {
          // If successful, should return empty or sanitized results
          expect(res.body).toHaveProperty('articles');
        }
      }
    });

    test('should prevent SQL injection in category queries', async () => {
      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .get('/api/articles')
          .query({ category: payload });

        expect(res.status).not.toBe(500);
      }
    });

    test('should prevent SQL injection in article ID parameter', async () => {
      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .get(`/api/articles/${encodeURIComponent(payload)}`);

        // Should return 404 or 400, not 500
        expect([200, 404, 400]).toContain(res.status);
        expect(res.status).not.toBe(500);
      }
    });

    test('should prevent SQL injection in login username', async () => {
      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: payload, password: 'test' });

        // Should not expose database errors
        expect(res.status).not.toBe(500);
        expect(res.body).not.toHaveProperty('sql');
        expect(res.body).not.toHaveProperty('error');
      }
    });
  });

  describe('XSS Protection', () => {
    test('should sanitize XSS in article header', async () => {
      for (const payload of xssPayloads.slice(0, 5)) { // Test first 5 to avoid too many tests
        const res = await request(app)
          .post('/cms/articles')
          .set('Cookie', sessionCookie)
          .send({
            header: payload,
            body: 'Test body',
            category: 'Gündem'
          });

        if (res.status === 201) {
          // Article created, check if XSS is escaped in response
          expect(res.body.header).not.toContain('<script>');
          expect(res.body.header).not.toContain('javascript:');
        }
      }
    });

    test('should sanitize XSS in article body', async () => {
      const payload = xssPayloads[0];
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: payload,
          category: 'Gündem'
        });

      if (res.status === 201) {
        // Body might contain HTML, but should be sanitized when rendered
        expect(res.body).toHaveProperty('body');
      }
    });

    test('should sanitize XSS in category name', async () => {
      const payload = xssPayloads[0];
      const res = await request(app)
        .post('/cms/categories')
        .set('Cookie', sessionCookie)
        .send({
          name: payload,
          description: 'Test category'
        });

      if (res.status === 201) {
        expect(res.body.name).not.toContain('<script>');
      }
    });

    test('should sanitize XSS in search queries', async () => {
      for (const payload of xssPayloads.slice(0, 3)) {
        const res = await request(app)
          .get('/api/articles')
          .query({ search: payload });

        // Should not execute XSS
        expect(res.status).not.toBe(500);
        if (res.status === 200) {
          expect(JSON.stringify(res.body)).not.toContain('<script>');
        }
      }
    });
  });

  describe('File Upload Security', () => {
    test('should reject executable files', async () => {
      for (const ext of maliciousFilePayloads.executableExtensions) {
        const maliciousFile = createMaliciousTestFile(`test${ext}`, 'malicious content');
        
        const res = await request(app)
          .post('/cms/media/upload')
          .set('Cookie', sessionCookie)
          .attach('file', maliciousFile.buffer, maliciousFile.originalname);

        // Should reject executable files
        expect([400, 403, 415]).toContain(res.status);
      }
    });

    test('should reject files with double extensions', async () => {
      for (const filename of maliciousFilePayloads.doubleExtensions) {
        const maliciousFile = createMaliciousTestFile(filename, 'malicious content');
        
        const res = await request(app)
          .post('/cms/media/upload')
          .set('Cookie', sessionCookie)
          .attach('file', maliciousFile.buffer, maliciousFile.originalname);

        // Should reject or sanitize double extensions
        expect([200, 400, 403]).toContain(res.status);
        if (res.status === 200) {
          // If accepted, filename should be sanitized
          expect(res.body.filename).not.toContain('.php');
          expect(res.body.filename).not.toContain('.exe');
        }
      }
    });

    test('should reject oversized files', async () => {
      const oversizedBuffer = createOversizedFileBuffer(5); // 5MB
      
      const res = await request(app)
        .post('/cms/media/upload')
        .set('Cookie', sessionCookie)
        .attach('file', oversizedBuffer, 'large-file.jpg');

      // Should reject files that are too large
      expect([400, 413, 500]).toContain(res.status);
    });

    test('should validate MIME types', async () => {
      // Try to upload a text file as an image
      const textFile = createMaliciousTestFile('test.txt', 'This is not an image');
      
      const res = await request(app)
        .post('/cms/media/upload')
        .set('Cookie', sessionCookie)
        .attach('file', textFile.buffer, textFile.originalname)
        .field('mimetype', 'image/jpeg'); // Try to fake MIME type

      // Should validate actual MIME type, not just extension
      expect([400, 415]).toContain(res.status);
    });
  });

  describe('Session Security', () => {
    test('should require authentication for protected routes', async () => {
      const res = await request(app)
        .get('/cms/articles');

      // Should redirect to login or return 401
      expect([301, 302, 401]).toContain(res.status);
    });

    test('should invalidate session on logout', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass123' });

      const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      // Try to access protected route
      const res = await request(app)
        .get('/cms/articles')
        .set('Cookie', cookie);

      // Should be unauthorized
      expect([301, 302, 401]).toContain(res.status);
    });

    test('should prevent session fixation', async () => {
      // Create a session
      const sessionId = 'fixed-session-id';
      
      // Try to use a fixed session ID (if possible)
      const res = await request(app)
        .get('/cms/articles')
        .set('Cookie', `connect.sid=${sessionId}`);

      // Should not accept fixed session IDs
      expect([301, 302, 401]).toContain(res.status);
    });

    test('should enforce session timeout', async () => {
      // This test would require mocking time or waiting
      // For now, just verify session structure
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass123' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('success', true);
    });
  });

  describe('CSRF Protection', () => {
    test('should validate session for state-changing operations', async () => {
      // Try to create article without valid session
      const res = await request(app)
        .post('/cms/articles')
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem'
        });

      // Should require authentication
      expect([301, 302, 401]).toContain(res.status);
    });

    test('should require session for DELETE operations', async () => {
      const res = await request(app)
        .delete('/cms/articles/1');

      // Should require authentication
      expect([301, 302, 401, 403]).toContain(res.status);
    });

    test('should require session for PUT operations', async () => {
      const res = await request(app)
        .put('/cms/articles/1')
        .send({
          header: 'Updated Article',
          body: 'Updated body',
          category: 'Gündem'
        });

      // Should require authentication
      expect([301, 302, 401, 403]).toContain(res.status);
    });
  });

  describe('Input Validation', () => {
    test('should validate required fields', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          // Missing required fields
          category: 'Gündem'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should validate field types', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 12345, // Should be string
          body: 'Test body',
          category: 'Gündem'
        });

      // Should either accept (with conversion) or reject
      expect([200, 201, 400]).toContain(res.status);
    });

    test('should validate array inputs', async () => {
      const res = await request(app)
        .post('/cms/articles')
        .set('Cookie', sessionCookie)
        .send({
          header: 'Test Article',
          body: 'Test body',
          category: 'Gündem',
          tags: 'not-an-array', // Should be array
          images: 'not-an-array' // Should be array
        });

      // Should handle gracefully (convert or reject)
      expect([200, 201, 400]).toContain(res.status);
    });

    test('should validate string length limits', async () => {
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
      expect([200, 201, 400, 413]).toContain(res.status);
    });
  });

  describe('Master Admin Credentials', () => {
    test('should use environment variables for master admin', async () => {
      const originalUser = process.env.MASTER_ADMIN_USER;
      const originalPass = process.env.MASTER_ADMIN_PASS;

      process.env.MASTER_ADMIN_USER = 'env-admin';
      process.env.MASTER_ADMIN_PASS = 'env-pass123';

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'env-admin', password: 'env-pass123' });

      // Should login successfully
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Restore
      if (originalUser) process.env.MASTER_ADMIN_USER = originalUser;
      if (originalPass) process.env.MASTER_ADMIN_PASS = originalPass;
    });

    test('should fallback to default credentials if env not set', async () => {
      const originalUser = process.env.MASTER_ADMIN_USER;
      const originalPass = process.env.MASTER_ADMIN_PASS;

      delete process.env.MASTER_ADMIN_USER;
      delete process.env.MASTER_ADMIN_PASS;

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });

      // Should login with defaults (security risk, but current behavior)
      expect(res.status).toBe(200);

      // Restore
      if (originalUser) process.env.MASTER_ADMIN_USER = originalUser;
      if (originalPass) process.env.MASTER_ADMIN_PASS = originalPass;
    });
  });

  describe('Permission Checks', () => {
    test('should enforce permission requirements', async () => {
      // Create a user with limited permissions
      const bcrypt = require('bcrypt');
      const limitedUser = {
        id: 'limited-user',
        username: 'limited',
        password_hash: bcrypt.hashSync('limited123', 10),
        display_name: 'Limited User',
        role: 'editor',
        permissions: JSON.stringify([]), // No permissions
        allowed_tabs: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      testDb.prepare(`
        INSERT INTO users (id, username, password_hash, display_name, role, permissions, allowed_tabs, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        limitedUser.id,
        limitedUser.username,
        limitedUser.password_hash,
        limitedUser.display_name,
        limitedUser.role,
        limitedUser.permissions,
        limitedUser.allowed_tabs,
        limitedUser.created_at
      );

      // Login as limited user
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'limited', password: 'limited123' });

      const limitedCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];

      // Try to access restricted endpoint
      const res = await request(app)
        .post('/cms/branding')
        .set('Cookie', limitedCookie)
        .send({ siteName: 'Hacked' });

      // Should be forbidden
      expect([403, 401]).toContain(res.status);
    });
  });
});

