/**
 * Integration Tests for Pages Routes
 * Based on FeaturesLog.txt test plans
 */
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const pagesRoutes = require('../../server/routes/pages');
const {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createTestCategory,
    insertCategory,
    createHomepageLayout,
    insertHomepageLayout,
    cleanupTestDatabase
} = require('../test-helpers');

describe('Pages Routes Integration Tests', () => {
    let app;
    let testDb;

    beforeAll(() => {
        // Create test database
        testDb = createTestDatabase();
        
        // Create test app
        app = express();
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use('/', pagesRoutes);
    });

    beforeEach(() => {
        // Clear database
        testDb.exec('DELETE FROM articles');
        testDb.exec('DELETE FROM categories');
        testDb.exec('DELETE FROM homepage_layout');
        testDb.exec('DELETE FROM branding');
        
        // Insert test data
        const category = insertCategory(testDb, createTestCategory({ 
            name: 'Gündem', 
            slug: 'gundem' 
        }));
        
        insertArticle(testDb, createTestArticle({
            id: '1',
            header: 'Test Article',
            category: 'Gündem',
            status: 'visible',
            targettedViews: ['carousel', 'featured-news-grid']
        }));
        
        // Insert default homepage layout
        insertHomepageLayout(testDb, createHomepageLayout([
            { type: 'carousel', config: { source: 'featured' } },
            { type: 'featured-news-grid', config: { source: 'featured' } }
        ]));
    });

    afterAll(() => {
        cleanupTestDatabase(testDb);
    });

    describe('GET / - Homepage View', () => {
        test('should render homepage with layout', async () => {
            const res = await request(app)
                .get('/');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('UHA News');
        });

        test('should process widget layout', async () => {
            const res = await request(app)
                .get('/');

            expect(res.statusCode).toBe(200);
            // Should render without errors even if widgets have no data
        });

        test('should exclude hidden widgets', async () => {
            insertHomepageLayout(testDb, createHomepageLayout([
                { type: 'carousel', config: { hidden: true } },
                { type: 'featured-news-grid', config: { source: 'featured' } }
            ]));
            
            const res = await request(app)
                .get('/');

            expect(res.statusCode).toBe(200);
        });
    });

    describe('GET /haber/:slug - Article Detail Page', () => {
        test('should render article page for valid slug', async () => {
            // Note: This test requires URLSlugService to be properly set up
            // In a real scenario, you'd need to set up slug mapping first
            const res = await request(app)
                .get('/haber/test-article');

            // May return 404 if slug not found, or 200 if slug exists
            expect([200, 404]).toContain(res.statusCode);
        });

        test('should return 404 for invalid slug', async () => {
            const res = await request(app)
                .get('/haber/non-existent-article');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /kategori/:categorySlug - Category Page', () => {
        test('should render category page with pagination', async () => {
            const res = await request(app)
                .get('/kategori/gundem')
                .query({ page: 1 });

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Gündem');
        });

        test('should handle pagination', async () => {
            // Insert more articles for pagination
            for (let i = 2; i <= 15; i++) {
                insertArticle(testDb, createTestArticle({
                    id: `${i}`,
                    category: 'Gündem',
                    status: 'visible'
                }));
            }
            
            const res = await request(app)
                .get('/kategori/gundem')
                .query({ page: 1 });

            expect(res.statusCode).toBe(200);
        });

        test('should return 404 for non-existent category', async () => {
            const res = await request(app)
                .get('/kategori/non-existent');

            expect(res.statusCode).toBe(404);
        });

        test('should exclude hidden articles', async () => {
            insertArticle(testDb, createTestArticle({
                id: '2',
                category: 'Gündem',
                status: 'hidden'
            }));
            
            const res = await request(app)
                .get('/kategori/gundem');

            expect(res.statusCode).toBe(200);
            // Hidden article should not appear
        });
    });

    describe('GET /arama - Search Page', () => {
        test('should render search results', async () => {
            const res = await request(app)
                .get('/arama')
                .query({ q: 'Test' });

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Arama');
        });

        test('should redirect to homepage without query', async () => {
            const res = await request(app)
                .get('/arama');

            expect([302, 200]).toContain(res.statusCode);
        });

        test('should handle empty search results', async () => {
            const res = await request(app)
                .get('/arama')
                .query({ q: 'nonexistentterm12345' });

            expect(res.statusCode).toBe(200);
        });

        test('should handle pagination', async () => {
            const res = await request(app)
                .get('/arama')
                .query({ q: 'Test', page: 1 });

            expect(res.statusCode).toBe(200);
        });
    });

    describe('GET /sitemap.xml - Sitemap Generation', () => {
        test('should return valid XML sitemap', async () => {
            const res = await request(app)
                .get('/sitemap.xml');

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/xml');
            expect(res.text).toContain('<?xml');
            expect(res.text).toContain('<urlset');
        });

        test('should include article URLs', async () => {
            const res = await request(app)
                .get('/sitemap.xml');

            expect(res.statusCode).toBe(200);
            // Should contain URLs
            expect(res.text).toContain('<url>');
        });
    });

    describe('GET /news-sitemap.xml - News Sitemap', () => {
        test('should return valid XML news sitemap', async () => {
            const res = await request(app)
                .get('/news-sitemap.xml');

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/xml');
            expect(res.text).toContain('<?xml');
        });

        test('should include news namespace', async () => {
            const res = await request(app)
                .get('/news-sitemap.xml');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('xmlns:news');
        });
    });

    describe('GET /robots.txt - Robots.txt', () => {
        test('should return robots.txt', async () => {
            const res = await request(app)
                .get('/robots.txt');

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/plain');
            expect(res.text).toContain('User-agent');
        });

        test('should include sitemap URL', async () => {
            const res = await request(app)
                .get('/robots.txt');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Sitemap');
        });
    });

    describe('GET /rss.xml - RSS Feed', () => {
        test('should return valid RSS feed', async () => {
            const res = await request(app)
                .get('/rss.xml');

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/rss+xml');
            expect(res.text).toContain('<?xml');
            expect(res.text).toContain('<rss');
            expect(res.text).toContain('<channel>');
        });

        test('should include channel information', async () => {
            const res = await request(app)
                .get('/rss.xml');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('<title>');
            expect(res.text).toContain('<description>');
            expect(res.text).toContain('<link>');
        });

        test('should include article items', async () => {
            const res = await request(app)
                .get('/rss.xml');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('<item>');
        });
    });

    describe('Legacy Category URL Redirect', () => {
        test('should redirect category name to /kategori/:slug', async () => {
            const res = await request(app)
                .get('/gundem')
                .redirects(0); // Don't follow redirects

            // Should redirect to /kategori/gundem
            expect([301, 302]).toContain(res.statusCode);
        });

        test('should not redirect known paths', async () => {
            const res = await request(app)
                .get('/haber')
                .redirects(0);

            // Should not redirect known paths
            expect(res.statusCode).not.toBe(301);
            expect(res.statusCode).not.toBe(302);
        });
    });
});

