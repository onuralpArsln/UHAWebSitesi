/**
 * Integration Tests for API Routes
 * Based on FeaturesLog.txt test plans
 */
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const DataService = require('../../server/services/data-service');
const URLSlugService = require('../../server/services/url-slug');
const apiRoutes = require('../../server/routes/api');
const {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createTestCategory,
    insertCategory,
    cleanupTestDatabase
} = require('../test-helpers');

describe('API Routes Integration Tests', () => {
    let app;
    let testDb;
    let dataService;
    let originalDataService;

    beforeAll(() => {
        // Create test database
        testDb = createTestDatabase();
        
        // Create test app
        app = express();
        app.use(bodyParser.json());
        app.use('/api', apiRoutes);
    });

    beforeEach(() => {
        // Clear database
        testDb.exec('DELETE FROM articles');
        testDb.exec('DELETE FROM categories');
        
        // Insert test data
        const category1 = insertCategory(testDb, createTestCategory({ name: 'Gündem', slug: 'gundem' }));
        const category2 = insertCategory(testDb, createTestCategory({ name: 'Ekonomi', slug: 'ekonomi' }));
        
        const article1 = insertArticle(testDb, createTestArticle({
            id: '1',
            header: 'Test Article 1',
            category: 'Gündem',
            status: 'visible',
            targettedViews: ['carousel', 'homepage']
        }));
        
        const article2 = insertArticle(testDb, createTestArticle({
            id: '2',
            header: 'Test Article 2',
            category: 'Ekonomi',
            status: 'visible',
            relatedArticles: ['1']
        }));
        
        const article3 = insertArticle(testDb, createTestArticle({
            id: '3',
            header: 'Hidden Article',
            category: 'Gündem',
            status: 'hidden'
        }));
    });

    afterAll(() => {
        cleanupTestDatabase(testDb);
    });

    describe('GET /api/articles - Get Articles with Pagination, Filtering, Sorting', () => {
        test('should return articles with pagination', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 1, limit: 10 });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(res.body).toHaveProperty('pagination');
            expect(res.body.pagination).toHaveProperty('page', 1);
            expect(res.body.pagination).toHaveProperty('limit', 10);
            expect(res.body.pagination).toHaveProperty('total');
            expect(res.body.pagination).toHaveProperty('totalPages');
        });

        test('should filter articles by category', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ category: 'Gündem' });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.every(a => a.category === 'Gündem')).toBe(true);
        });

        test('should search articles', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ search: 'Test' });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.length).toBeGreaterThan(0);
        });

        test('should sort articles by publishedAt desc', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ sortBy: 'publishedAt', sortOrder: 'desc' });

            expect(res.statusCode).toBe(200);
            if (res.body.articles.length > 1) {
                const dates = res.body.articles.map(a => new Date(a.creationDate || a.publishedAt));
                for (let i = 1; i < dates.length; i++) {
                    expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
                }
            }
        });

        test('should handle invalid pagination parameters', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ page: -1, limit: 0 });

            // Should still return 200 but with default/validated values
            expect([200, 400]).toContain(res.statusCode);
        });

        test('should include slugs in response', async () => {
            const res = await request(app)
                .get('/api/articles');

            expect(res.statusCode).toBe(200);
            if (res.body.articles.length > 0) {
                expect(res.body.articles[0]).toHaveProperty('slug');
            }
        });
    });

    describe('GET /api/articles/:id - Get Single Article', () => {
        test('should return article by valid ID', async () => {
            const res = await request(app)
                .get('/api/articles/1');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('id', '1');
            expect(res.body).toHaveProperty('header');
            expect(res.body).toHaveProperty('body');
        });

        test('should return 404 for non-existent article', async () => {
            const res = await request(app)
                .get('/api/articles/999');

            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty('error');
        });

        test('should include slug in response', async () => {
            const res = await request(app)
                .get('/api/articles/1');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('slug');
        });
    });

    describe('GET /api/related/:id - Get Related Articles', () => {
        test('should return related articles', async () => {
            const res = await request(app)
                .get('/api/related/2')
                .query({ limit: 4 });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(Array.isArray(res.body.articles)).toBe(true);
        });

        test('should return empty array for article without related articles', async () => {
            const res = await request(app)
                .get('/api/related/1')
                .query({ limit: 4 });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles).toEqual([]);
        });

        test('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/related/2')
                .query({ limit: 1 });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.length).toBeLessThanOrEqual(1);
        });
    });

    describe('GET /api/related-news - Get Related News by Category', () => {
        test('should return articles by category', async () => {
            const res = await request(app)
                .get('/api/related-news')
                .query({ category: 'Gündem', offset: 0, limit: 4 });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(res.body).toHaveProperty('hasMore');
        });

        test('should handle offset pagination', async () => {
            const res = await request(app)
                .get('/api/related-news')
                .query({ category: 'Gündem', offset: 0, limit: 1 });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.length).toBeLessThanOrEqual(1);
        });
    });

    describe('GET /api/categories - Get Categories', () => {
        test('should return all categories', async () => {
            const res = await request(app)
                .get('/api/categories');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('categories');
            expect(Array.isArray(res.body.categories)).toBe(true);
            expect(res.body.categories.length).toBeGreaterThan(0);
        });

        test('should return categories with correct structure', async () => {
            const res = await request(app)
                .get('/api/categories');

            expect(res.statusCode).toBe(200);
            if (res.body.categories.length > 0) {
                const cat = res.body.categories[0];
                expect(cat).toHaveProperty('id');
                expect(cat).toHaveProperty('name');
                expect(cat).toHaveProperty('slug');
            }
        });
    });

    describe('POST /api/comments - Submit Comment (Simulated)', () => {
        test('should accept valid comment', async () => {
            const res = await request(app)
                .post('/api/comments')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    comment: 'Great article!',
                    articleId: '1'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('comment');
            expect(res.body.comment).toHaveProperty('id');
            expect(res.body.comment).toHaveProperty('name', 'Test User');
            expect(res.body.comment).toHaveProperty('email', 'test@example.com');
        });

        test('should reject comment with missing required fields', async () => {
            const res = await request(app)
                .post('/api/comments')
                .send({
                    name: 'Test User',
                    email: 'test@example.com'
                    // missing comment and articleId
                });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('should reject invalid email format', async () => {
            const res = await request(app)
                .post('/api/comments')
                .send({
                    name: 'Test User',
                    email: 'invalid-email',
                    comment: 'Test comment',
                    articleId: '1'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/comments - Get Comments (Simulated)', () => {
        test('should return empty array (simulated)', async () => {
            const res = await request(app)
                .get('/api/comments')
                .query({ articleId: '1' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('comments');
            expect(res.body.comments).toEqual([]);
            expect(res.body).toHaveProperty('hasMore', false);
        });

        test('should require articleId parameter', async () => {
            const res = await request(app)
                .get('/api/comments');

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('POST /api/comments/:id/like - Like Comment (Simulated)', () => {
        test('should return success with random likes count', async () => {
            const res = await request(app)
                .post('/api/comments/123/like');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('likes');
            expect(typeof res.body.likes).toBe('number');
            expect(res.body.likes).toBeGreaterThanOrEqual(1);
            expect(res.body.likes).toBeLessThanOrEqual(10);
        });
    });

    describe('GET /api/breaking-news - Get Breaking News', () => {
        test('should return recent articles', async () => {
            const res = await request(app)
                .get('/api/breaking-news');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(Array.isArray(res.body.articles)).toBe(true);
            expect(res.body.articles.length).toBeLessThanOrEqual(5);
        });
    });

    describe('GET /api/trending - Get Trending Articles', () => {
        test('should return trending articles', async () => {
            const res = await request(app)
                .get('/api/trending')
                .query({ limit: 10 });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(Array.isArray(res.body.articles)).toBe(true);
        });

        test('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/trending')
                .query({ limit: 5 });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.length).toBeLessThanOrEqual(5);
        });
    });

    describe('GET /api/slug/:id - Get Article Slug', () => {
        test('should return slug for article with slug', async () => {
            // First generate a slug
            const slugRes = await request(app)
                .post('/api/slug')
                .send({ id: '1', title: 'Test Article' });

            const res = await request(app)
                .get('/api/slug/1');

            // May return 404 if slug not stored, or 200 if stored
            expect([200, 404]).toContain(res.statusCode);
        });

        test('should return 404 for article without slug', async () => {
            const res = await request(app)
                .get('/api/slug/999');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/slug - Generate Article Slug', () => {
        test('should generate slug from title', async () => {
            const res = await request(app)
                .post('/api/slug')
                .send({ id: '1', title: 'Test Article Title' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('id', '1');
            expect(res.body).toHaveProperty('title', 'Test Article Title');
            expect(res.body).toHaveProperty('slug');
            expect(res.body.slug).toBeTruthy();
        });

        test('should require id and title', async () => {
            const res = await request(app)
                .post('/api/slug')
                .send({ id: '1' });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/health - Health Check', () => {
        test('should return health status', async () => {
            const res = await request(app)
                .get('/api/health');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('memory');
            expect(res.body).toHaveProperty('version');
        });

        test('should have valid timestamp format', async () => {
            const res = await request(app)
                .get('/api/health');

            expect(res.statusCode).toBe(200);
            expect(() => new Date(res.body.timestamp)).not.toThrow();
        });
    });

    describe('GET /api/cache/stats - Cache Statistics', () => {
        test('should return cache statistics', async () => {
            const res = await request(app)
                .get('/api/cache/stats');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('backend');
            expect(res.body).toHaveProperty('slugs');
            expect(res.body.backend).toHaveProperty('hits');
            expect(res.body.backend).toHaveProperty('misses');
            expect(res.body.slugs).toHaveProperty('totalSlugs');
        });
    });

    describe('POST /api/cache/clear - Clear Cache', () => {
        test('should return success (placeholder)', async () => {
            const res = await request(app)
                .post('/api/cache/clear');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
        });
    });

    describe('Invalid Parameters Handling', () => {
        test('should handle invalid page parameter', async () => {
            const invalidPages = ['abc', null, undefined, '', '0', '-1', '999999999'];
            
            for (const page of invalidPages) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ page });

                // Should handle gracefully (use default or return error)
                expect([200, 400]).toContain(res.statusCode);
            }
        });

        test('should handle invalid limit parameter', async () => {
            const invalidLimits = ['abc', null, undefined, '', '0', '-1', '999999999'];
            
            for (const limit of invalidLimits) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ limit });

                // Should handle gracefully
                expect([200, 400]).toContain(res.statusCode);
            }
        });

        test('should handle invalid sortBy parameter', async () => {
            const invalidSortBy = ['invalid', 'DROP TABLE', '; DELETE', null, undefined];
            
            for (const sortBy of invalidSortBy) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ sortBy });

                // Should handle gracefully (use default)
                expect([200, 400]).toContain(res.statusCode);
            }
        });

        test('should handle invalid sortOrder parameter', async () => {
            const invalidSortOrder = ['invalid', 'DROP', null, undefined];
            
            for (const sortOrder of invalidSortOrder) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ sortOrder });

                // Should handle gracefully (use default)
                expect([200, 400]).toContain(res.statusCode);
            }
        });

        test('should handle very large limit values', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ limit: 1000000 });

            // Should either cap the limit or return error
            expect([200, 400]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                // If successful, should not return more than reasonable limit
                expect(res.body.articles.length).toBeLessThanOrEqual(10000);
            }
        });
    });

    describe('SQL Injection Protection', () => {
        const { sqlInjectionPayloads } = require('../test-helpers/security-helpers');

        test('should prevent SQL injection in search parameter', async () => {
            for (const payload of sqlInjectionPayloads.slice(0, 5)) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ search: payload });

                // Should not return 500 (database error)
                expect(res.statusCode).not.toBe(500);
                // Should not expose SQL errors
                expect(JSON.stringify(res.body)).not.toContain('SQLITE');
                expect(JSON.stringify(res.body)).not.toContain('syntax error');
            }
        });

        test('should prevent SQL injection in category parameter', async () => {
            for (const payload of sqlInjectionPayloads.slice(0, 5)) {
                const res = await request(app)
                    .get('/api/articles')
                    .query({ category: payload });

                expect(res.statusCode).not.toBe(500);
                expect(JSON.stringify(res.body)).not.toContain('SQLITE');
            }
        });

        test('should prevent SQL injection in article ID', async () => {
            for (const payload of sqlInjectionPayloads.slice(0, 5)) {
                const res = await request(app)
                    .get(`/api/articles/${encodeURIComponent(payload)}`);

                // Should return 404 or 400, not 500
                expect([200, 404, 400]).toContain(res.statusCode);
                expect(res.statusCode).not.toBe(500);
            }
        });
    });

    describe('Large Dataset Handling', () => {
        test('should handle requests with many articles', async () => {
            // Create many articles
            const articles = [];
            for (let i = 0; i < 100; i++) {
                articles.push(createTestArticle({
                    id: `large-${i}`,
                    header: `Article ${i}`,
                    category: 'Gündem',
                    status: 'visible'
                }));
            }

            // Insert articles
            for (const article of articles) {
                insertArticle(testDb, article);
            }

            // Test pagination with large dataset
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 1, limit: 20 });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.length).toBeLessThanOrEqual(20);
            expect(res.body.pagination.total).toBeGreaterThanOrEqual(100);
        });

        test('should handle pagination with large page numbers', async () => {
            // Create many articles
            for (let i = 0; i < 50; i++) {
                insertArticle(testDb, createTestArticle({
                    id: `page-${i}`,
                    header: `Article ${i}`,
                    category: 'Gündem',
                    status: 'visible'
                }));
            }

            // Request high page number
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 100, limit: 10 });

            expect(res.statusCode).toBe(200);
            // Should return empty array or handle gracefully
            expect(Array.isArray(res.body.articles)).toBe(true);
        });

        test('should handle large result sets efficiently', async () => {
            // Create many articles
            for (let i = 0; i < 200; i++) {
                insertArticle(testDb, createTestArticle({
                    id: `perf-${i}`,
                    header: `Article ${i}`,
                    category: 'Gündem',
                    status: 'visible'
                }));
            }

            const startTime = Date.now();
            const res = await request(app)
                .get('/api/articles')
                .query({ limit: 100 });

            const duration = Date.now() - startTime;

            expect(res.statusCode).toBe(200);
            // Should complete in reasonable time (less than 5 seconds)
            expect(duration).toBeLessThan(5000);
        });
    });

    describe('Edge Case Pagination', () => {
        test('should handle page 0', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 0 });

            // Should handle as page 1 or return error
            expect([200, 400]).toContain(res.statusCode);
        });

        test('should handle negative page numbers', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ page: -1 });

            // Should handle as page 1 or return error
            expect([200, 400]).toContain(res.statusCode);
        });

        test('should handle zero limit', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ limit: 0 });

            // Should use default limit or return error
            expect([200, 400]).toContain(res.statusCode);
        });

        test('should handle last page correctly', async () => {
            // Create articles
            for (let i = 0; i < 25; i++) {
                insertArticle(testDb, createTestArticle({
                    id: `last-page-${i}`,
                    header: `Article ${i}`,
                    category: 'Gündem',
                    status: 'visible'
                }));
            }

            // Request last page
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 3, limit: 10 });

            expect(res.statusCode).toBe(200);
            expect(res.body.pagination.page).toBe(3);
            expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
        });

        test('should handle page beyond total pages', async () => {
            const res = await request(app)
                .get('/api/articles')
                .query({ page: 99999, limit: 10 });

            expect(res.statusCode).toBe(200);
            // Should return empty array or last page
            expect(Array.isArray(res.body.articles)).toBe(true);
        });
    });
});

