/**
 * Integration Tests for CMS Routes
 * Based on FeaturesLog.txt test plans
 */
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nunjucks = require('nunjucks');
const config = require('../../server/services/config');
const DataService = require('../../server/services/data-service');
const cmsRoutes = require('../../server/routes/cms');
const {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createTestCategory,
    insertCategory,
    cleanupTestDatabase
} = require('../test-helpers');

// Mock session middleware
const mockSession = (user = null) => {
    return (req, res, next) => {
        if (user) {
            req.session = {
                userId: user.id || 'test-user',
                username: user.username || 'testuser',
                displayName: user.displayName || 'Test User',
                role: user.role || 'editor',
                permissions: user.permissions || [],
                allowedTabs: user.allowedTabs || [],
                isMaster: user.isMaster || false
            };
        }
        next();
    };
};

describe('CMS Routes Integration Tests', () => {
    let app;
    let testDb;
    let uploadDir;

    beforeAll(() => {
        // Create test database
        testDb = createTestDatabase();
        
        // Create DataService instance with test database
        const testDataService = new DataService(testDb);
        
        // Inject test DataService into CMS routes
        cmsRoutes.setDataService(testDataService);
        
        // Create upload directory for branding
        uploadDir = path.join(__dirname, '../../public/uploads/branding');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Create test app
        app = express();
        
        // Configure template engine (nunjucks)
        const paths = config.getPaths();
        nunjucks.configure(paths.templates, {
            autoescape: true,
            express: app,
            noCache: true
        });
        app.set('views', paths.templates);
        app.set('view engine', 'njk');
        
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false
        }));
        app.use('/cms', cmsRoutes);
    });

    beforeEach(() => {
        // Clear database
        testDb.exec('DELETE FROM articles');
        testDb.exec('DELETE FROM categories');
        testDb.exec('DELETE FROM branding');
        testDb.exec('DELETE FROM homepage_layout');
        
        // Insert test data
        insertCategory(testDb, createTestCategory({ name: 'Gündem', slug: 'gundem' }));
        insertArticle(testDb, createTestArticle({ id: '1', category: 'Gündem' }));
    });

    afterAll(() => {
        // Reset DataService to default
        cmsRoutes.resetDataService();
        cleanupTestDatabase(testDb);
        // Clean up upload directory
        if (fs.existsSync(uploadDir)) {
            fs.readdirSync(uploadDir).forEach(file => {
                fs.unlinkSync(path.join(uploadDir, file));
            });
        }
    });

    describe('GET /cms - CMS Dashboard View', () => {
        test('should redirect when not logged in', async () => {
            const res = await request(app)
                .get('/cms');

            expect([302, 401]).toContain(res.statusCode);
        });

        test('should return dashboard when logged in', async () => {
            app.use(mockSession({ role: 'admin', isMaster: true }));
            
            const res = await request(app)
                .get('/cms');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('UHA CMS');
        });
    });

    describe('GET /cms/branding - Get Branding Settings', () => {
        test('should return branding configuration', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .get('/cms/branding');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('branding');
            expect(res.body.branding).toHaveProperty('siteName');
            expect(res.body.branding).toHaveProperty('primaryColor');
        });
    });

    describe('POST /cms/branding - Update Branding Settings', () => {
        test('should update branding colors', async () => {
            app.use(mockSession({ role: 'admin', permissions: ['manage_settings'] }));
            
            const res = await request(app)
                .post('/cms/branding')
                .send({
                    siteName: 'Test Site',
                    primaryColor: '#ff0000',
                    secondaryColor: '#00ff00',
                    accentColor: '#0000ff'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.branding).toHaveProperty('primaryColor', '#ff0000');
        });

        test('should require manage_settings permission', async () => {
            app.use(mockSession({ role: 'editor', permissions: [] }));
            
            const res = await request(app)
                .post('/cms/branding')
                .send({ siteName: 'Test' });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /cms/articles - List Articles', () => {
        test('should return articles with pagination', async () => {
            app.use(mockSession({ role: 'editor' }));
            
            const res = await request(app)
                .get('/cms/articles')
                .query({ page: 1, limit: 20 });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('articles');
            expect(res.body).toHaveProperty('pagination');
        });

        test('should filter by category', async () => {
            app.use(mockSession({ role: 'editor' }));
            
            const res = await request(app)
                .get('/cms/articles')
                .query({ category: 'Gündem' });

            expect(res.statusCode).toBe(200);
            expect(res.body.articles.every(a => a.category === 'Gündem')).toBe(true);
        });
    });

    describe('POST /cms/articles - Create Article', () => {
        test('should create article with valid data', async () => {
            app.use(mockSession({ 
                role: 'editor', 
                username: 'testuser',
                displayName: 'Test User'
            }));
            
            const res = await request(app)
                .post('/cms/articles')
                .send({
                    header: 'New Article',
                    body: '<p>Article content</p>',
                    category: 'Gündem',
                    status: 'visible'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('header', 'New Article');
        });

        test('should reject article without header', async () => {
            app.use(mockSession({ role: 'editor' }));
            
            const res = await request(app)
                .post('/cms/articles')
                .send({
                    body: '<p>Content</p>'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('should enforce writer field for non-admins', async () => {
            app.use(mockSession({ 
                role: 'editor',
                username: 'editor1',
                displayName: 'Editor One'
            }));
            
            const res = await request(app)
                .post('/cms/articles')
                .send({
                    header: 'Test Article',
                    body: '<p>Content</p>',
                    writer: 'Different Writer' // Should be ignored
                });

            expect(res.statusCode).toBe(201);
            // Writer should be set to session displayName or username
            expect(['Editor One', 'editor1']).toContain(res.body.writer);
        });
    });

    describe('PUT /cms/articles/:id - Update Article', () => {
        test('should update article', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .put('/cms/articles/1')
                .send({
                    header: 'Updated Article',
                    body: '<p>Updated content</p>',
                    category: 'Gündem'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('header', 'Updated Article');
        });

        test('should return 404 for non-existent article', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .put('/cms/articles/999')
                .send({
                    header: 'Test',
                    body: '<p>Content</p>'
                });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /cms/articles/:id/status - Update Article Status', () => {
        test('should toggle article status', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .put('/cms/articles/1/status')
                .send({ status: 'hidden' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('status', 'hidden');
        });
    });

    describe('DELETE /cms/articles/:id - Delete Article', () => {
        test('should delete article as admin', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .delete('/cms/articles/1');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });

        test('should allow editor to delete own article', async () => {
            // Create article owned by editor
            insertArticle(testDb, createTestArticle({
                id: '2',
                created_by: 'editor1'
            }));
            
            app.use(mockSession({ 
                role: 'editor',
                username: 'editor1'
            }));
            
            const res = await request(app)
                .delete('/cms/articles/2');

            expect(res.statusCode).toBe(200);
        });

        test('should prevent editor from deleting others article', async () => {
            app.use(mockSession({ 
                role: 'editor',
                username: 'editor2'
            }));
            
            const res = await request(app)
                .delete('/cms/articles/1');

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /cms/categories - List Categories', () => {
        test('should return all categories', async () => {
            app.use(mockSession({ role: 'editor' }));
            
            const res = await request(app)
                .get('/cms/categories');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('categories');
            expect(Array.isArray(res.body.categories)).toBe(true);
        });
    });

    describe('POST /cms/categories - Create Category', () => {
        test('should create category with valid data', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .post('/cms/categories')
                .send({
                    name: 'New Category',
                    description: 'Category description'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('name', 'New Category');
        });

        test('should reject category without name', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .post('/cms/categories')
                .send({
                    description: 'No name'
                });

            expect(res.statusCode).toBe(400);
        });

        test('should reject duplicate category name', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res1 = await request(app)
                .post('/cms/categories')
                .send({ name: 'Duplicate' });
            
            // First request should succeed
            expect(res1.statusCode).toBe(201);
            
            const res2 = await request(app)
                .post('/cms/categories')
                .send({ name: 'Duplicate' });

            // Second request should fail with duplicate error
            expect([409, 400]).toContain(res2.statusCode);
        });
    });

    describe('PUT /cms/categories/:id - Update Category', () => {
        test('should update category', async () => {
            const category = insertCategory(testDb, createTestCategory({ name: 'Test Cat' }));
            
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .put(`/cms/categories/${category.id}`)
                .send({
                    name: 'Updated Category',
                    description: 'Updated description'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name', 'Updated Category');
        });
    });

    describe('DELETE /cms/categories/:id - Delete Category', () => {
        test('should delete category', async () => {
            const category = insertCategory(testDb, createTestCategory({ name: 'To Delete' }));
            
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .delete(`/cms/categories/${category.id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });

    describe('PUT /cms/layouts/homepage - Update Homepage Layout', () => {
        test('should update homepage layout', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const layout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { title: 'Featured' } }
            ];
            
            const res = await request(app)
                .put('/cms/layouts/homepage')
                .send({ layout });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('layout');
        });

        test('should reject invalid layout format', async () => {
            app.use(mockSession({ role: 'admin' }));
            
            const res = await request(app)
                .put('/cms/layouts/homepage')
                .send({ layout: 'not an array' });

            expect(res.statusCode).toBe(400);
        });
    });
});

