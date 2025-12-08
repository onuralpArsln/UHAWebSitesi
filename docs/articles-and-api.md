# Articles + API Cheat Sheet

Use this guide when you need to understand article data, add new content through the API/CMS, or modify CRUD logic.

## 1. Database Schema (SQLite)
Table: `articles` (created in `server/services/data-service.js`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT (PK) | UUID/string id |
| `header` | TEXT | Main title shown on cards |
| `summaryHead` | TEXT | Short subheading |
| `summary` | TEXT | 140–160 char description |
| `category` | TEXT | Category name |
| `tags` | TEXT | JSON array string |
| `body` | TEXT | Full HTML article |
| `images` | TEXT | JSON array string with `{ url, alt, lowRes, highRes }` |
| `writer` | TEXT | Author |
| `creationDate` | TEXT | ISO date string |
| `source` | TEXT | External source |
| `outlinks` | TEXT | JSON array string |
| `targettedViews` | TEXT | JSON array string (homepage, breaking-news, etc.) |
| `updatedAt` | TEXT | Last modified |
| `relatedArticles` | TEXT | JSON array string of article IDs |
| Legacy fields (`title`, `content`, `author`, `publishedAt`, `keywords`) still exist for backward compatibility. |

## 2. Data Service Helpers
Location: `server/services/data-service.js`

- `getArticles(filters)` – fetch list with optional filters such as `category`, `limit`, `featured`.
- `getArticleBySlug(slug)` / `getArticleById(id)` – single article.
- `createArticle(articlePayload)` – inserts new row (handles JSON stringify).
- `updateArticle(id, articlePayload)` – updates row.
- `deleteArticle(id)` – removes row.
- `ensureArticlesTable()` + `generateMockArticles()` – bootstrap mock data for empty DBs.

Whenever you pass arrays/objects, convert them to JSON strings before saving (these helpers already do this if you stick to them).

## 3. CMS/API Routes
File: `server/routes/cms.js`

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /cms/articles` | List articles for the dashboard | Uses `dataService.getArticles()` |
| `POST /cms/articles` | Create article | Body parsed from JSON; server generates slug |
| `PUT /cms/articles/:id` | Update article | Accepts same payload as POST |
| `DELETE /cms/articles/:id` | Delete article | Removes DB row |

Public APIs (`server/routes/api.js`) expose read-only endpoints such as:
- `GET /api/articles` – paginated list.
- `GET /api/breaking-news` – subset flagged for ticker.

## 4. Adding Articles Programmatically
1. Send `POST /cms/articles` with JSON:
   ```json
   {
     "header": "Örnek Haber",
     "summaryHead": "Kısa başlık",
     "summary": "Özet metin",
     "category": "Ekonomi",
     "tags": ["borsa","faiz"],
     "body": "<p>HTML içerik</p>",
     "images": [
       {"url": "/uploads/media/example.jpg", "alt": "Örnek görsel"}
     ],
     "targettedViews": ["homepage","breaking-news"]
   }
   ```
2. Optional fields can be omitted; the route fills defaults and timestamps.
3. Response contains the saved article with `id` and `slug`.

## 5. Editing / Deleting
- `PUT /cms/articles/:id` – send only the fields you need to change; backend merges and updates `updatedAt`.
- `DELETE /cms/articles/:id` – irreversible; no recycle bin.

## 6. How Pages Use Article Data
1. Public routes (`server/routes/pages.js`) call `dataService` helpers with filters.
2. Results flow to `templates/pages/*.njk`.
3. Widgets such as `news-card`, `carousel`, and `related-news` map article fields directly (ensure `images` and `summary` exist to avoid empty spots).

## 7. Troubleshooting
- **Missing images**: check that `images` is JSON string with at least `{ url }`. Empty array is fine but some widgets hide image sections.
- **Slug collisions**: slug generation handled in `server/services/url-slug.js`. If duplicates occur, ensure `header` text changes or pass a unique slug manually.
- **API 500 errors**: inspect server logs; usually caused by invalid JSON (e.g., tags as plain string instead of array).
- **Mock data reappearing**: only happens when DB is empty—confirm you’re editing `data/news.db` and it isn’t deleted between runs.

## Related Docs
- `add-widget.md` – use article fields inside new widgets.
- `widget-rendering.md` – how article data reaches templates.
- `troubleshooting.md` – general fixes for CMS/API issues.

