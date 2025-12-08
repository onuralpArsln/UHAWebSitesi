# Agentic Mock Data Documentation

## Quick Use
- Read this when a fresh checkout boots with pre-filled stories.
- Flow: `new DataService()` → `migrateMockDataIfNeeded()` → bulk inserts articles and categories when `articles` is empty.
- Tip: keep `data/news.db`; deleting it forces the migration to rerun on the next boot.

This document now reflects the current (expanded) seed set.

## Source
- File: `server/services/data-service.js`
- Relevant functions: `migrateMockDataIfNeeded()`, `generateMockArticles()`, `generateMockCategories()`

## How It Works

### 1. Trigger
```javascript
const articleCount = this.db.prepare('SELECT COUNT(*) as count FROM articles').get();

if (articleCount.count === 0) {
  console.log('📦 Migrating mock data to database...');
  const mockArticles = this.generateMockArticles();
  const mockCategories = this.generateMockCategories();
  ...
}
```
This runs during service construction (both for injected DBs and the default `data/news.db`). As soon as a single article exists, the migration is skipped.

### 2. Categories
`generateMockCategories()` still seeds six canonical categories (`Gündem`, `Ekonomi`, `Spor`, `Teknoloji`, `Sağlık`, `Eğitim`). They are inserted before articles so the foreign key-style references resolve.

### 3. Articles (Current Set)
`generateMockArticles()` now returns a **two-dozen item array** that touches every major category and tests multiple widget targets. Highlights:

| Example ID | Category | Header | Targeted Views |
|------------|----------|--------|----------------|
| `1` | Gündem | İzmir'de 5.2 Büyüklüğünde Deprem Oldu | `homepage`, `flash-news`, `carousel` |
| `2` | Gündem | Meclis Yeni Yasama Yılına Başladı | `homepage`, `featured-news-grid` |
| `5` | Ekonomi | Türkiye Ekonomisinde Büyüme Rakamları Açıklandı | `homepage`, `carousel`, `category-feed` |
| `8` | Spor | Anadolu Efes EuroLeague'de Galip | `category-feed`, `flash-news` |
| `12` | Teknoloji | Yerli Otonom Araç Test Edildi | `featured-news-grid`, `flash-news` |
| `17` | Sağlık | Yeni Sağlık Bakanı Açıklamalarda Bulundu | `category-feed`, `featured-news-grid` |

Patterns:
- Every article stores structured media (`images`, optional `headlineImage`) and metadata so widgets render complete cards.
- `targettedViews` focus on the live widgets (`carousel`, `featured-news-grid`, `category-feed`, `flash-news`). Legacy values like `breaking-news`/`category` are no longer emitted.
- Multiple stories hit `carousel` so both manual + dynamic Manşet demos have data immediately.

Because the list is sizable (20+ entries), you can safely test pagination, category feeds, and limited widgets right after the first boot.

### 4. Regenerating Mock Data
1. Stop the dev server.
2. Delete `data/news.db` (or move it aside).
3. Restart (`npm run dev`). The database is recreated, tables are initialized, and the mock migration logs `📦 Migrating mock data...`.
4. Verify via `/cms` or `sqlite3 data/news.db 'select count(*) from articles;'`.

## When to Modify
- Add/remove seed stories only when you need new demo targets (e.g., a brand-new widget type that expects a specific `targettedView`).
- Keep IDs stable if possible; QA scripts (`tests/setup.js`) sometimes assume the deterministic ordering.
- If you update the seed schema (add columns, change defaults), mirror those updates inside `generateMockArticles()` so new installs remain coherent.

## Related References
- `docs/layout-manager.md` — uses these seeds to illustrate widget order/state.
- `docs/widget-data-flow.md` — explains how the seeded `targettedViews` drive homepage widgets.
- `tests/integration/pages.test.js` — relies on mock data to assert widget rendering.
