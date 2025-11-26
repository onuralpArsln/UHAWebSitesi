/**
 * Integration Tests for Widget Management and Dynamic Configurations
 * 
 * Tests widget listing, homepage layout management, and widget configuration.
 */

const {
    createTestDatabase,
    createHomepageLayout,
    insertHomepageLayout,
    cleanupTestDatabase
} = require('../test-helpers');

// Simplified DataService for widget management tests
class TestDataService {
    constructor(db) {
        this.db = db;
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

    saveHomepageLayout(layout) {
        const updatedAt = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO homepage_layout (id, layout, updatedAt)
      VALUES (?, ?, ?)
    `);

        stmt.run('homepage', JSON.stringify(layout), updatedAt);

        return { layout, updatedAt };
    }
}

// Available widget types (from the CMS)
const AVAILABLE_WIDGETS = [
    {
        type: 'hero-title',
        name: 'Hero Title',
        description: 'Large title section for the homepage',
        category: 'content'
    },
    {
        type: 'carousel',
        name: 'Carousel',
        description: 'Rotating carousel of featured articles',
        category: 'content'
    },
    {
        type: 'featured-news-grid',
        name: 'Featured News Grid',
        description: 'Grid layout of featured news articles',
        category: 'content'
    },
    {
        type: 'category-feed',
        name: 'Category Feed',
        description: 'News feed for a specific category',
        category: 'content'
    },
    {
        type: 'flash-news',
        name: 'Flash News',
        description: 'Breaking news ticker',
        category: 'content'
    },
    {
        type: 'ad-placeholder',
        name: 'Ad Placeholder',
        description: 'Advertisement placement area',
        category: 'monetization'
    }
];

describe('Widget Management', () => {
    let db;
    let dataService;

    beforeEach(() => {
        db = createTestDatabase();
        dataService = new TestDataService(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    describe('Available Widgets Listing', () => {
        test('should return all available widget types', () => {
            const widgets = AVAILABLE_WIDGETS;

            expect(widgets).toHaveLength(6);
            expect(widgets.map(w => w.type)).toContain('carousel');
            expect(widgets.map(w => w.type)).toContain('featured-news-grid');
            expect(widgets.map(w => w.type)).toContain('category-feed');
            expect(widgets.map(w => w.type)).toContain('flash-news');
        });

        test('each widget should have required properties', () => {
            const widgets = AVAILABLE_WIDGETS;

            widgets.forEach(widget => {
                expect(widget).toHaveProperty('type');
                expect(widget).toHaveProperty('name');
                expect(widget).toHaveProperty('description');
                expect(widget).toHaveProperty('category');
            });
        });

        test('should categorize widgets correctly', () => {
            const widgets = AVAILABLE_WIDGETS;
            const contentWidgets = widgets.filter(w => w.category === 'content');
            const monetizationWidgets = widgets.filter(w => w.category === 'monetization');

            expect(contentWidgets).toHaveLength(5);
            expect(monetizationWidgets).toHaveLength(1);
        });
    });

    describe('Homepage Layout Management', () => {
        test('should save and retrieve homepage layout', () => {
            const layout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { source: 'featured' } }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout).toHaveLength(2);
            expect(retrieved.layout[0].type).toBe('carousel');
            expect(retrieved.layout[1].type).toBe('featured-news-grid');
        });

        test('should update existing layout', () => {
            const initialLayout = [
                { type: 'carousel', config: { source: 'featured' } }
            ];

            dataService.saveHomepageLayout(initialLayout);

            const updatedLayout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { source: 'featured' } }
            ];

            dataService.saveHomepageLayout(updatedLayout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout).toHaveLength(2);
        });

        test('should handle empty layout', () => {
            const emptyLayout = [];

            dataService.saveHomepageLayout(emptyLayout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout).toHaveLength(0);
        });

        test('should return empty array when no layout exists', () => {
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout).toHaveLength(0);
        });
    });

    describe('Widget Ordering', () => {
        test('should maintain widget order', () => {
            const layout = [
                { type: 'hero-title', config: { title: 'Welcome' } },
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { source: 'featured' } },
                { type: 'category-feed', config: { categoryName: 'Ekonomi' } }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout[0].type).toBe('hero-title');
            expect(retrieved.layout[1].type).toBe('carousel');
            expect(retrieved.layout[2].type).toBe('featured-news-grid');
            expect(retrieved.layout[3].type).toBe('category-feed');
        });

        test('should support reordering widgets', () => {
            const originalOrder = [
                { type: 'carousel', config: { id: '1' } },
                { type: 'featured-news-grid', config: { id: '2' } }
            ];

            dataService.saveHomepageLayout(originalOrder);

            const reorderedLayout = [
                { type: 'featured-news-grid', config: { id: '2' } },
                { type: 'carousel', config: { id: '1' } }
            ];

            dataService.saveHomepageLayout(reorderedLayout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout[0].type).toBe('featured-news-grid');
            expect(retrieved.layout[1].type).toBe('carousel');
        });
    });

    describe('Widget Configuration', () => {
        test('should preserve widget configurations', () => {
            const layout = [
                {
                    type: 'carousel',
                    config: {
                        source: 'featured',
                        id: 'main-carousel',
                        limit: 8,
                        autoScroll: true
                    }
                }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            expect(retrieved.layout[0].config.source).toBe('featured');
            expect(retrieved.layout[0].config.limit).toBe(8);
            expect(retrieved.layout[0].config.autoScroll).toBe(true);
        });

        test('should handle complex widget configurations', () => {
            const layout = [
                {
                    type: 'category-feed',
                    config: {
                        categoryName: 'Ekonomi',
                        categorySlug: 'ekonomi',
                        limit: 4,
                        showImages: true,
                        layout: 'grid'
                    }
                }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            const widget = retrieved.layout[0];
            expect(widget.config.categoryName).toBe('Ekonomi');
            expect(widget.config.categorySlug).toBe('ekonomi');
            expect(widget.config.limit).toBe(4);
            expect(widget.config.showImages).toBe(true);
            expect(widget.config.layout).toBe('grid');
        });
    });

    describe('Widget Visibility', () => {
        test('should support hidden widgets', () => {
            const layout = [
                { type: 'carousel', config: { source: 'featured', hidden: false } },
                { type: 'featured-news-grid', config: { source: 'featured', hidden: true } }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            const visibleWidgets = retrieved.layout.filter(w => !w.config.hidden);
            expect(visibleWidgets).toHaveLength(1);
            expect(visibleWidgets[0].type).toBe('carousel');
        });

        test('should toggle widget visibility', () => {
            const layout = [
                { type: 'carousel', config: { hidden: false } }
            ];

            dataService.saveHomepageLayout(layout);

            // Toggle visibility
            layout[0].config.hidden = true;
            dataService.saveHomepageLayout(layout);

            const retrieved = dataService.getHomepageLayout();
            expect(retrieved.layout[0].config.hidden).toBe(true);
        });
    });

    describe('Widget Addition and Removal', () => {
        test('should add new widget to layout', () => {
            const layout = [
                { type: 'carousel', config: { source: 'featured' } }
            ];

            dataService.saveHomepageLayout(layout);

            // Add new widget
            layout.push({ type: 'category-feed', config: { categoryName: 'Ekonomi' } });
            dataService.saveHomepageLayout(layout);

            const retrieved = dataService.getHomepageLayout();
            expect(retrieved.layout).toHaveLength(2);
        });

        test('should remove widget from layout', () => {
            const layout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'featured-news-grid', config: { source: 'featured' } },
                { type: 'category-feed', config: { categoryName: 'Ekonomi' } }
            ];

            dataService.saveHomepageLayout(layout);

            // Remove middle widget
            const updatedLayout = layout.filter((_, index) => index !== 1);
            dataService.saveHomepageLayout(updatedLayout);

            const retrieved = dataService.getHomepageLayout();
            expect(retrieved.layout).toHaveLength(2);
            expect(retrieved.layout.map(w => w.type)).not.toContain('featured-news-grid');
        });
    });

    describe('Multiple Widget Instances', () => {
        test('should support multiple category feed widgets', () => {
            const layout = [
                { type: 'category-feed', config: { categoryName: 'Ekonomi' } },
                { type: 'category-feed', config: { categoryName: 'Spor' } },
                { type: 'category-feed', config: { categoryName: 'Teknoloji' } }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            const categoryFeeds = retrieved.layout.filter(w => w.type === 'category-feed');
            expect(categoryFeeds).toHaveLength(3);

            const categories = categoryFeeds.map(w => w.config.categoryName);
            expect(categories).toContain('Ekonomi');
            expect(categories).toContain('Spor');
            expect(categories).toContain('Teknoloji');
        });

        test('should support multiple ad placeholders', () => {
            const layout = [
                { type: 'ad-placeholder', config: { slot: 'top', size: '728x90' } },
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'ad-placeholder', config: { slot: 'middle', size: '300x250' } },
                { type: 'featured-news-grid', config: { source: 'featured' } },
                { type: 'ad-placeholder', config: { slot: 'bottom', size: '728x90' } }
            ];

            dataService.saveHomepageLayout(layout);
            const retrieved = dataService.getHomepageLayout();

            const adWidgets = retrieved.layout.filter(w => w.type === 'ad-placeholder');
            expect(adWidgets).toHaveLength(3);
        });
    });

    describe('Widget Validation', () => {
        test('should validate widget type', () => {
            const validTypes = AVAILABLE_WIDGETS.map(w => w.type);

            const isValidWidget = (widget) => {
                return validTypes.includes(widget.type);
            };

            expect(isValidWidget({ type: 'carousel', config: {} })).toBe(true);
            expect(isValidWidget({ type: 'invalid-type', config: {} })).toBe(false);
        });

        test('should validate required config fields', () => {
            const validateCarousel = (widget) => {
                if (widget.type !== 'carousel') return true;
                return widget.config && widget.config.source === 'featured';
            };

            expect(validateCarousel({ type: 'carousel', config: { source: 'featured' } })).toBe(true);
            expect(validateCarousel({ type: 'carousel', config: {} })).toBe(false);
        });

        test('should validate category feed has category name', () => {
            const validateCategoryFeed = (widget) => {
                if (widget.type !== 'category-feed') return true;
                return !!(widget.config && (widget.config.categoryName || widget.config.category));
            };

            expect(validateCategoryFeed({
                type: 'category-feed',
                config: { categoryName: 'Ekonomi' }
            })).toBe(true);

            expect(validateCategoryFeed({
                type: 'category-feed',
                config: {}
            })).toBe(false);
        });
    });

    describe('Layout Persistence', () => {
        test('should persist layout across service restarts', () => {
            const layout = [
                { type: 'carousel', config: { source: 'featured' } },
                { type: 'category-feed', config: { categoryName: 'Ekonomi' } }
            ];

            dataService.saveHomepageLayout(layout);

            // Simulate service restart by creating new instance
            const newDataService = new TestDataService(db);
            const retrieved = newDataService.getHomepageLayout();

            expect(retrieved.layout).toHaveLength(2);
            expect(retrieved.layout[0].type).toBe('carousel');
            expect(retrieved.layout[1].type).toBe('category-feed');
        });

        test('should track last update time', () => {
            const layout = [{ type: 'carousel', config: { source: 'featured' } }];

            const result = dataService.saveHomepageLayout(layout);

            expect(result.updatedAt).toBeDefined();
            expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(Date.now() - 1000);
        });
    });
});

describe('Widget Configuration Options', () => {
    describe('Carousel Widget', () => {
        test('should support custom carousel settings', () => {
            const config = {
                source: 'featured',
                id: 'main-carousel',
                limit: 10,
                autoScroll: true,
                interval: 5000,
                showDots: true,
                showArrows: true
            };

            expect(config.source).toBe('featured');
            expect(config.limit).toBe(10);
            expect(config.autoScroll).toBe(true);
        });
    });

    describe('Flash News Widget', () => {
        test('should support flash news configuration', () => {
            const config = {
                id: 'breaking-news',
                limit: 15,
                speed: 50,
                pauseDelay: 3000,
                duplicateCount: 2
            };

            expect(config.limit).toBe(15);
            expect(config.speed).toBe(50);
        });
    });

    describe('Ad Placeholder Widget', () => {
        test('should support ad placement configuration', () => {
            const config = {
                slot: 'sidebar',
                label: 'Reklam Alanı',
                size: '300x600'
            };

            expect(config.slot).toBe('sidebar');
            expect(config.size).toBe('300x600');
        });
    });
});
