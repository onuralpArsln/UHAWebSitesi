const DataService = require('../server/services/data-service');
const URLSlugService = require('../server/services/url-slug');

async function syncSlugs() {
    console.log('🚀 Starting slug synchronization...');

    try {
        const dataService = new DataService();
        const urlSlugService = new URLSlugService();

        // Fetch all articles
        const result = dataService.getArticles({ limit: 1000 });
        const articles = result.articles;

        console.log(`📦 Found ${articles.length} articles in database`);

        let updatedCount = 0;

        for (const article of articles) {
            console.log(`Processing article ${article.id}: ${article.header}`);
            if (article.id && article.header) {
                // This will generate and cache the slug if it doesn't exist
                const slug = await urlSlugService.getSlugForArticle(article.id, article.header);
                console.log(`  -> Slug: ${slug}`);
                updatedCount++;
            } else {
                console.warn(`  -> Skipping article ${article.id}: Missing ID or header`);
            }
        }

        console.log(`✅ Successfully synced ${updatedCount} slugs`);

        // Force save just in case
        await urlSlugService.saveSlugCache();

        console.log('💾 Cache saved to disk');

    } catch (error) {
        console.error('❌ Error syncing slugs:', error);
        process.exit(1);
    }
}

syncSlugs();
