const DataService = require('./server/services/data-service');

try {
    const service = new DataService();

    console.log("--- Simulating GET /cms/carousel ---");
    const layout = service.getCarouselLayout();
    console.log("Data returned by getCarouselLayout() (what the API sends):");
    console.log(JSON.stringify(layout, null, 2));

    console.log("\n--- Checking for Populated Data ---");
    const populated = service.getCarouselArticles();
    console.log("Data returned by getCarouselArticles() (what we need):");
    // Log only first item to keep output clean if many
    if (populated.length > 0) {
        console.log(JSON.stringify(populated[0], null, 2));
        console.log(`... and ${populated.length - 1} more items`);
    } else {
        console.log("[] (No articles found in carousel)");
    }

} catch (error) {
    console.error("Error running test:", error);
}
