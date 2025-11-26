/**
 * Unit Tests for DataService - Article Filtering
 * 
 * These tests specifically verify the targettedView filtering logic
 * that was broken by the SQL LIKE pattern bug.
 */
const Database = require('better-sqlite3');
const {
    createTestDatabase,
    createTestArticle,
    insertArticle,
    createTestCategory,
    insertCategory,
    cleanupTestDatabase
} = require('../test-helpers');

// Mock DataService class with just the methods we need to test
class TestDataService {
    constructor(db) {
        this.db = db;
    }

    parseArticle(row) {
        if (!row) return null;

        const header = row.header || row.title || '';
        const body = row.body || row.content || '';
        const writer = row.writer || row.author || '';
        const creationDate = row.creationDate || row.publishedAt || '';
        const tags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [];
        const status = row.status ? row.status.toLowerCase() : 'visible';

        return {
            id: row.id,
            header: header,
            summaryHead: row.summaryHead || '',
            summary: row.summary || '',
            category: row.category || '',
            tags: tags,
            body: body,
            images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : [],
            videoUrl: row.videoUrl || row.video || '',
            writer: writer,
            creationDate: creationDate,
            source: row.source || '',
            outlinks: row.outlinks ? (typeof row.outlinks === 'string' ? JSON.parse(row.outlinks) : row.outlinks) : [],
            targettedViews: row.targettedViews ? (typeof row.targettedViews === 'string' ? JSON.parse(row.targettedViews) : row.targettedViews) : [],
            updatedAt: row.updatedAt || '',
            relatedArticles: row.relatedArticles ? (typeof row.relatedArticles === 'string' ? JSON.parse(row.relatedArticles) : row.relatedArticles) : [],
            status: status === 'hidden' ? 'hidden' : 'visible',
            pressAnnouncementId: row.pressAnnouncementId || '',
            created_by: row.created_by || null,
            title: header,
            content: body,
            author: writer,
            publishedAt: creationDate,
            video: row.videoUrl || row.video || '',
            keywords: tags
        };
    }

    getArticles(options = {}) {
        const {
            page = 1,
            limit = 20,
            category = null,
            search = null,
            status = null,
            sortBy = 'publishedAt',
            sortOrder = 'desc'
        } = options;

        let query = 'SELECT * FROM articles WHERE 1=1';
        const params = [];

        // Filter by status
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        // Filter by category
        if (category) {
            query += ' AND LOWER(category) = LOWER(?)';
            params.push(category);
        }

        // Filter by search
        if (search) {
            query += ' AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(summary) LIKE ?)';
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Filter by targetted view - THIS IS THE CRITICAL PART WE'RE TESTING
        if (options.targettedView) {
            query += ' AND targettedViews LIKE ?';
            params.push(`%"${options.targettedView}"%`); // ✅ Fixed pattern without spaces
        }

        // Sort
        const validSortBy = ['publishedAt', 'updatedAt', 'title', 'category'].includes(sortBy)
            ? sortBy
            : 'publishedAt';
        const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${validSortBy} ${validSortOrder}`;

        // Get total count for pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params);
        const total = countResult.count;

        // Add pagination
        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        // Execute query
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
}

describe('DataService - Article Filtering', () => {
    let db;
    let dataService;

    beforeEach(() => {
        // Create fresh in-memory database for each test
        db = createTestDatabase();
        dataService = new TestDataService(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    describe('TargettedView Filtering', () => {
        test('should filter articles by targettedView: carousel', () => {
            // Create articles with different targettedViews
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Carousel Article 1',
                targettedViews: ['carousel', 'homepage']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Carousel Article 2',
                targettedViews: ['carousel']
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                header: 'Grid Article',
                targettedViews: ['featured-news-grid']
            }));

            // Query for carousel articles
            const result = dataService.getArticles({
                targettedView: 'carousel',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(2);
            const headers = result.articles.map(a => a.header);
            expect(headers).toContain('Carousel Article 1');
            expect(headers).toContain('Carousel Article 2');
        });

        test('should filter articles by targettedView: featured-news-grid', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Grid Article 1',
                targettedViews: ['featured-news-grid']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Grid Article 2',
                targettedViews: ['homepage', 'featured-news-grid']
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                header: 'Carousel Article',
                targettedViews: ['carousel']
            }));

            const result = dataService.getArticles({
                targettedView: 'featured-news-grid',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(2);
            expect(result.articles.every(a => a.targettedViews.includes('featured-news-grid'))).toBe(true);
        });

        test('should filter articles by targettedView: category-feed', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Category Feed Article',
                targettedViews: ['category-feed']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Other Article',
                targettedViews: ['carousel']
            }));

            const result = dataService.getArticles({
                targettedView: 'category-feed',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].header).toBe('Category Feed Article');
        });

        test('should filter articles by targettedView: flash-news', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Flash News Article',
                targettedViews: ['flash-news']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Regular Article',
                targettedViews: ['homepage']
            }));

            const result = dataService.getArticles({
                targettedView: 'flash-news',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].header).toBe('Flash News Article');
        });

        test('should handle articles with multiple targettedViews', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Multi-target Article',
                targettedViews: ['carousel', 'featured-news-grid', 'homepage']
            }));

            // Should appear in carousel results
            const carouselResult = dataService.getArticles({ targettedView: 'carousel' });
            expect(carouselResult.articles).toHaveLength(1);

            // Should also appear in featured-news-grid results
            const gridResult = dataService.getArticles({ targettedView: 'featured-news-grid' });
            expect(gridResult.articles).toHaveLength(1);
        });

        test('should return empty array when no articles match targettedView', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Carousel Only',
                targettedViews: ['carousel']
            }));

            const result = dataService.getArticles({
                targettedView: 'flash-news',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });

        test('should match compact JSON format without spaces', () => {
            // This is the critical test - verifying the SQL pattern matches compact JSON
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Test Article',
                targettedViews: ['carousel', 'featured-news-grid'] // Stored as: ["carousel","featured-news-grid"]
            }));

            const result = dataService.getArticles({ targettedView: 'carousel' });

            // The pattern %"carousel"% should match ["carousel","featured-news-grid"]
            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].targettedViews).toEqual(['carousel', 'featured-news-grid']);
        });
    });

    describe('Status Filtering', () => {
        test('should filter visible articles only', () => {
            insertArticle(db, createTestArticle({ id: '1', status: 'visible', header: 'Visible Article' }));
            insertArticle(db, createTestArticle({ id: '2', status: 'hidden', header: 'Hidden Article' }));

            const result = dataService.getArticles({ status: 'visible' });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].status).toBe('visible');
        });

        test('should filter hidden articles only', () => {
            insertArticle(db, createTestArticle({ id: '1', status: 'visible' }));
            insertArticle(db, createTestArticle({ id: '2', status: 'hidden' }));

            const result = dataService.getArticles({ status: 'hidden' });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].status).toBe('hidden');
        });

        test('should exclude hidden articles from widget queries', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                status: 'visible',
                targettedViews: ['carousel']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                status: 'hidden',
                targettedViews: ['carousel']
            }));

            const result = dataService.getArticles({
                targettedView: 'carousel',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].status).toBe('visible');
        });
    });

    describe('Category Filtering', () => {
        test('should filter articles by category', () => {
            insertArticle(db, createTestArticle({ id: '1', category: 'Ekonomi' }));
            insertArticle(db, createTestArticle({ id: '2', category: 'Spor' }));
            insertArticle(db, createTestArticle({ id: '3', category: 'Ekonomi' }));

            const result = dataService.getArticles({ category: 'Ekonomi' });

            expect(result.articles).toHaveLength(2);
            expect(result.articles.every(a => a.category === 'Ekonomi')).toBe(true);
        });

        test('should combine category and targettedView filtering', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                category: 'Ekonomi',
                targettedViews: ['category-feed']
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                category: 'Spor',
                targettedViews: ['category-feed']
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                category: 'Ekonomi',
                targettedViews: ['carousel']
            }));

            const result = dataService.getArticles({
                category: 'Ekonomi',
                targettedView: 'category-feed',
                status: 'visible'
            });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].category).toBe('Ekonomi');
            expect(result.articles[0].targettedViews).toContain('category-feed');
        });
    });

    describe('Pagination', () => {
        beforeEach(() => {
            // Insert 25 articles for pagination tests
            for (let i = 1; i <= 25; i++) {
                insertArticle(db, createTestArticle({
                    id: `article-${i}`,
                    header: `Article ${i}`,
                    creationDate: new Date(Date.now() - i * 1000).toISOString()
                }));
            }
        });

        test('should return correct pagination metadata', () => {
            const result = dataService.getArticles({ page: 1, limit: 10 });

            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 25,
                totalPages: 3
            });
        });

        test('should paginate results correctly', () => {
            const page1 = dataService.getArticles({ page: 1, limit: 10 });
            const page2 = dataService.getArticles({ page: 2, limit: 10 });
            const page3 = dataService.getArticles({ page: 3, limit: 10 });

            expect(page1.articles).toHaveLength(10);
            expect(page2.articles).toHaveLength(10);
            expect(page3.articles).toHaveLength(5);
        });

        test('should handle empty results', () => {
            const result = dataService.getArticles({ targettedView: 'nonexistent' });

            expect(result.articles).toHaveLength(0);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            });
        });
    });

    describe('Search Filtering', () => {
        test('should search articles by content', () => {
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Article about Economy',
                summary: 'Economic news'
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Sports News',
                summary: 'Football match'
            }));

            const result = dataService.getArticles({ search: 'economy' });

            expect(result.articles).toHaveLength(1);
            expect(result.articles[0].header).toContain('Economy');
        });
    });

    describe('Sorting', () => {
        test('should sort by publishedAt descending by default', () => {
            const now = Date.now();
            insertArticle(db, createTestArticle({
                id: '1',
                header: 'Oldest',
                creationDate: new Date(now - 3000).toISOString()
            }));
            insertArticle(db, createTestArticle({
                id: '2',
                header: 'Newest',
                creationDate: new Date(now).toISOString()
            }));
            insertArticle(db, createTestArticle({
                id: '3',
                header: 'Middle',
                creationDate: new Date(now - 1000).toISOString()
            }));

            const result = dataService.getArticles({ sortBy: 'publishedAt', sortOrder: 'desc' });

            expect(result.articles[0].header).toBe('Newest');
            expect(result.articles[1].header).toBe('Middle');
            expect(result.articles[2].header).toBe('Oldest');
        });
    });
});
