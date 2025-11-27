const DataService = require('./server/services/data-service');
const path = require('path');

// Initialize DataService
const dbPath = path.join(__dirname, 'database.sqlite');
const dataService = new DataService();

console.log('--- Verifying DataService Methods ---');

// Check getCarouselArticles (Manual List)
const manualArticles = dataService.getCarouselArticles();
console.log('getCarouselArticles() type:', Array.isArray(manualArticles) ? 'Array' : typeof manualArticles);
console.log('getCarouselArticles() length:', manualArticles ? manualArticles.length : 'null');
console.log('getCarouselArticles() content:', JSON.stringify(manualArticles, null, 2));

// Check getArticles (Featured List)
const featuredArticles = dataService.getArticles({
    limit: 5,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    targettedView: 'carousel'
});
console.log('\ngetArticles() type:', typeof featuredArticles);
console.log('getArticles().articles type:', Array.isArray(featuredArticles.articles) ? 'Array' : typeof featuredArticles.articles);
console.log('getArticles().articles length:', featuredArticles.articles ? featuredArticles.articles.length : 'null');

console.log('\n--- Logic Verification ---');
let carouselArticlesResult = { articles: [] };
if (manualArticles && manualArticles.length > 0) {
    console.log('Logic would choose: MANUAL list');
    carouselArticlesResult.articles = manualArticles;
} else {
    console.log('Logic would choose: FEATURED list (Fallback)');
    carouselArticlesResult.articles = featuredArticles.articles || [];
}
console.log('Final Result Length:', carouselArticlesResult.articles.length);
