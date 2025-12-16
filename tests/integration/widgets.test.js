/**
 * Integration Tests for Widget Data Fetching
 * 
 * Tests the end-to-end widget data processing as it happens in the homepage route.
 * Verifies that widgets correctly fetch articles based on their configuration.
 */
const {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createHomepageLayout,
    insertHomepageLayout,
    createTestCategory,
    insertCategory,
    cleanupTestDatabase
} = require('../test-helpers');

// Mock URLSlugService
const mockUrlSlugService = {
    getSlugById: jest.fn((id) => `article-${id}`),
    generateSlug: jest.fn((title) => title.toLowerCase().replace(/\s+/g, '-'))
};

// Simplified DataService for testing widgets
class TestDataService {
    constructor(db) {
        this.db = db;
    }

    parseArticle(row) {
        if (!row) return null;

        return {
            id: row.id,
            header: row.header || '',
            summary: row.summary || '',
            category: row.category || '',
            images: row.images ? JSON.parse(row.images) : [],
            writer: row.writer || '',
            creationDate: row.creationDate || '',
            targettedViews: row.targettedViews ? JSON.parse(row.targettedViews) : [],
            status: row.status || 'visible',
            title: row.header || '',
            publishedAt: row.creationDate || ''
        };
    }

    getArticles(options = {}) {
        const {
            page = 1,
            limit = 20,
            category = null,
            status = null,
            sortBy = 'publishedAt',
            sortOrder = 'desc'
        } = options;

        let query = 'SELECT * FROM articles WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (category) {
            query += ' AND LOWER(category) = LOWER(?)';
            params.push(category);
        }

        // Critical: targettedView filtering
        if (options.targettedView) {
            query += ' AND targettedViews LIKE ?';
            params.push(`%"${options.targettedView}"%`);
        }

        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params);
        const total = countResult.count;

        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = this.db.prepare(query).all(...params);
        const articles = rows.map(row => this.parseArticle(row));

        return {
            articles,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    getHomepageLayout() {
        const row = this.db.prepare('SELECT * FROM homepage_layout WHERE id = ?').get('homepage');
        if (!row) {
            return { layout: [], updatedAt: new Date().toISOString() };
        }

        return {
            layout: JSON.parse(row.layout),
            updatedAt: row.updatedAt || new Date().toISOString()
        };
    }

    getCategories() {
        const rows = this.db.prepare('SELECT * FROM categories ORDER BY name').all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            slug: row.slug
        }));
    }
}

// Helper to process widgets like the homepage route does
function processWidgets(layout, dataService) {
    const visibleLayout = layout.filter(widget => !widget.config?.hidden);

    return visibleLayout.map(widget => {
        const widgetData = { ...widget, data: {} };

        switch (widget.type) {
            case 'carousel':
            case 'featured-news-grid':
                if (widget.config.source === 'featured') {
                    const defaultLimit = widget.type === 'carousel' ? 8 : 6;
                    const limit = parseInt(widget.config.limit) || defaultLimit;

                    const featuredArticles = dataService.getArticles({
                        limit: limit,
                        sortBy: 'publishedAt',
                        sortOrder: 'desc',
                        targettedView: widget.type,
                        status: 'visible'
                    });

                    widgetData.data.articles = featuredArticles.articles.map(article => ({
                        ...article,
                        slug: mockUrlSlugService.getSlugById(article.id)
                    }));
                }
                break;

            case 'category-feed':
                const categoryName = widget.config.categoryName || widget.config.category;
                const rawLimit = parseInt(widget.config.limit, 10);
                const limit = Number.isFinite(rawLimit) && rawLimit > 0
                    ? Math.min(rawLimit, 20)
                    : 4;

                if (categoryName) {
                    const categoryArticles = dataService.getArticles({
                        category: categoryName,
                        limit,
                        sortBy: 'publishedAt',
                        sortOrder: 'desc',
                        targettedView: 'category-feed',
                        status: 'visible'
                    });

                    widgetData.data.articles = categoryArticles.articles.map(article => ({
                        ...article,
                        slug: mockUrlSlugService.getSlugById(article.id)
                    }));
                }
                break;

            case 'flash-news':
                const flashNewsLimit = parseInt(widget.config.limit) || 10;
                const flashNewsArticles = dataService.getArticles({
                    limit: flashNewsLimit,
                    sortBy: 'publishedAt',
                    sortOrder: 'desc',
                    targettedView: 'flash-news',
                    status: 'visible'
                });

                widgetData.data.articles = flashNewsArticles.articles.map(article => ({
                    ...article,
                    slug: mockUrlSlugService.getSlugById(article.id)
                }));
                break;

            default:
                break;
        }

        return widgetData;
    });
}

describe('Widget Data Fetching Integration', () => {
    let db;
    let dataService;

    beforeEach(() => {
        db = createTestDatabase();
        dataService = new TestDataService(db);
        jest.clearAllMocks();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    describe('Carousel Widget', () => {
        test('should fetch articles tagged with carousel', () => {
            // Insert test articles
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Carousel Article 1',
                targettedViews: ['carousel'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Carousel Article 2',
                targettedViews: ['carousel', 'homepage'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                header: 'Other Article',
                targettedViews: ['featured-news-grid'],
                status: 'visible'
            }));

            // Create layout with carousel widget
            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured',
                        id: 'main-carousel',
                        limit: 8
                    }
                }
            ];

            insertHomepageLayout(db, createHomepageLayout(layout));

            // Process widgets
            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout).toHaveLength(1);
            expect(processedLayout[0].data.articles).toHaveLength(2);
            const headers = processedLayout[0].data.articles.map(a => a.header);
            expect(headers).toContain('Carousel Article 1');
            expect(headers).toContain('Carousel Article 2');
        });

        test('should respect custom limit configuration', () => {
            // Insert 10 carousel articles
            for (let i = 1; i <= 10; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    header: `Carousel Article ${i}`,
                    targettedViews: ['carousel'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured',
                        id: 'main-carousel',
                        limit: 5
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(5);
        });

        test('should use default limit of 8 when not specified', () => {
            // Insert 10 articles
            for (let i = 1; i <= 10; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    targettedViews: ['carousel'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured',
                        id: 'main-carousel'
                        // No limit specified
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(8);
        });
    });

    describe('Featured News Grid Widget', () => {
        test('should fetch articles tagged with featured-news-grid', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Featured Article 1',
                targettedViews: ['featured-news-grid'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Featured Article 2',
                targettedViews: ['featured-news-grid', 'homepage'],
                status: 'visible'
            }));

            const layout = [
                {
                    type: 'featured-news-grid',
                    config: {
                        source: 'featured'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(2);
            expect(processedLayout[0].data.articles.every(a =>
                a.targettedViews.includes('featured-news-grid')
            )).toBe(true);
        });

        test('should use default limit of 6', () => {
            for (let i = 1; i <= 10; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    targettedViews: ['featured-news-grid'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'featured-news-grid',
                    config: {
                        source: 'featured'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(6);
        });
    });

    describe('Category Feed Widget', () => {
        test('should fetch articles by category and targettedView', () => {
            insertCategory(db, createTestCategory({
                id: '1',
                name: 'Ekonomi',
                slug: 'ekonomi'
            }));

            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Ekonomi Article 1',
                category: 'Ekonomi',
                targettedViews: ['category-feed'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Ekonomi Article 2',
                category: 'Ekonomi',
                targettedViews: ['category-feed'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                header: 'Spor Article',
                category: 'Spor',
                targettedViews: ['category-feed'],
                status: 'visible'
            }));

            const layout = [
                {
                    type: 'category-feed',
                    config: {
                        categoryName: 'Ekonomi',
                        categorySlug: 'ekonomi'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(2);
            expect(processedLayout[0].data.articles.every(a => a.category === 'Ekonomi')).toBe(true);
        });

        test('should limit to 4 articles', () => {
            for (let i = 1; i <= 10; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    category: 'Ekonomi',
                    targettedViews: ['category-feed'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'category-feed',
                    config: {
                        categoryName: 'Ekonomi'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(4);
        });
    });

    describe('Flash News Widget', () => {
        test('should fetch articles tagged with flash-news', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Breaking News 1',
                targettedViews: ['flash-news'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Breaking News 2',
                targettedViews: ['flash-news'],
                status: 'visible'
            }));

            const layout = [
                {
                    type: 'flash-news',
                    config: {
                        id: 'breaking-news',
                        speed: 50
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(2);
        });

        test('should respect custom limit', () => {
            for (let i = 1; i <= 15; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    targettedViews: ['flash-news'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'flash-news',
                    config: {
                        id: 'breaking-news',
                        limit: 5
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(5);
        });

        test('should use default limit of 10', () => {
            for (let i = 1; i <= 15; i++) {
                insertArticle(db, createTestArticle({
                    id: `${i}`,
                    targettedViews: ['flash-news'],
                    status: 'visible'
                }));
            }

            const layout = [
                {
                    type: 'flash-news',
                    config: {
                        id: 'breaking-news'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(10);
        });
    });

    describe('Hidden Widget Filtering', () => {
        test('should exclude widgets with hidden: true', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                targettedViews: ['carousel'],
                status: 'visible'
            }));

            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured',
                        hidden: true
                    }
                },
                {
                    type: 'featured-news-grid',
                    config: {
                        source: 'featured',
                        hidden: false
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout).toHaveLength(1);
            expect(processedLayout[0].type).toBe('featured-news-grid');
        });
    });

    describe('Empty Widget State', () => {
        test('should handle widgets with no matching articles', () => {
            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(0);
        });
    });

    describe('Hidden Articles', () => {
        test('should exclude hidden articles from all widgets', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Visible Article',
                targettedViews: ['carousel'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Hidden Article',
                targettedViews: ['carousel'],
                status: 'hidden'
            }));

            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured'
                    }
                }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout[0].data.articles).toHaveLength(1);
            expect(processedLayout[0].data.articles[0].header).toBe('Visible Article');
        });
    });

    describe('Multi-Widget Layout', () => {
        test('should process multiple widget types correctly', () => {
            // Create articles for different widgets
            insertArticle(db, createTestArticle({
                id: '1',
                targettedViews: ['carousel'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                targettedViews: ['featured-news-grid'],
                status: 'visible'
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                category: 'Ekonomi',
                targettedViews: ['category-feed'],
                status: 'visible'
            }));

            const layout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { source: 'featured' } },
                { type: 'category-feed', config: { categoryName: 'Ekonomi' } }
            ];

            const processedLayout = processWidgets(layout, dataService);

            expect(processedLayout).toHaveLength(3);
            expect(processedLayout[0].data.articles).toHaveLength(1);
            expect(processedLayout[1].data.articles).toHaveLength(1);
            expect(processedLayout[2].data.articles).toHaveLength(1);
        });
    });
});
