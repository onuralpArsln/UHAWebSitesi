const DataService = require('./server/services/data-service');

try {
    const service = new DataService();

    console.log("--- Simulating NEW GET /cms/carousel Logic ---");

    // This matches the code we added to server/routes/cms.js
    const articlesResult = service.getArticles({
        targettedView: 'carousel',
        limit: 20,
        sortBy: 'publishedAt',
        sortOrder: 'desc'
    });

    console.log(`Found ${articlesResult.articles.length} articles with targettedView='carousel'`);

    if (articlesResult.articles.length > 0) {
        console.log("First article details:");
        const first = articlesResult.articles[0];
        console.log(`- ID: ${first.id}`);
        console.log(`- Header: ${first.header}`);
        console.log(`- Targetted Views: ${JSON.stringify(first.targettedViews)}`);
        console.log(`- Status: ${first.status}`);
    } else {
        console.log("No articles found. Please add an article with 'Manşet Slider' target to verify.");
    }

} catch (error) {
    console.error("Error running verification:", error);
}
