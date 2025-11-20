<!-- For AI agents and code editors contributing to this repo -->
# agentReadme.md – System Context & Guide

## 1. System Architecture
**Stack**: Node.js (v18+), Express, Nunjucks (SSR), SQLite3 (WAL mode).
**Pattern**: Monolithic SSR with file-backed database. No build step required for SSR.
**Assets**: Static files served from `public/`.

## 2. Critical File Map
### Core Services (`server/services/`)
- **`data-service.js`**: **PRIMARY DATA LAYER**. Handles SQLite connection, schema init, migrations, and all CRUD.
  - *Schema*: `articles` (JSON-in-TEXT for arrays), `categories`, `branding`.
  - *Key Methods*: `getArticles()`, `getArticleById()`, `createArticle()`, `getBranding()`.
- **`config.js`**: **SINGLE SOURCE OF TRUTH**. Auto-detects env, paths, and URLs.
  - *Usage*: `config.getSiteUrl(req)`, `config.getPaths()`. **DO NOT** use `process.env` directly.
- **`url-slug.js`**: SEO slug management. Handles Turkish char normalization (`ğ`->`g`).
  - *Usage*: `getSlugForArticle(id, title)`, `generateSlug(text)`.
- **`sitemap.js`**: Generates `sitemap.xml`, `news-sitemap.xml`, `robots.txt`.
- **`view-helpers.js`**: Generators for Meta tags (OG/Twitter) and Schema.org JSON-LD.

### Routes (`server/routes/`)
- **`pages.js`**: Public SSR pages (`/`, `/haber/:slug`, `/kategori/:slug`). Injects `branding`, `meta`, `navCategories`.
- **`api.js`**: Public JSON API (`/api/articles`, `/api/breaking-news`).
- **`cms.js`**: Admin panel (`/cms`). Renders `dashboard.njk` with injected `initialState` JSON.

### Templates (`templates/`)
- **`layouts/`**: Base HTML wrappers (`main.njk`, `cms-layout.njk`).
- **`pages/`**: Public views (`home.njk`, `article.njk`).
- **`widgets/`**: Reusable macros (`flashNews.njk`, `articleCard.njk`).
- **`cms/`**: Admin views. Heavily relies on client-side JS (`public/cms/js/cms-app.js`).

## 3. Data Conventions
**Database**: `data/news.db` (SQLite).
**JSON-in-SQL**: Arrays/Objects stored as TEXT.
- *Read*: `JSON.parse(row.field || '[]')`
- *Write*: `JSON.stringify(data)`
- *Fields*: `tags`, `images`, `outlinks`, `targettedViews`, `relatedArticles`.

**Images**:
- Stored in `public/uploads/`.
- Object structure: `{ url, lowRes, highRes, width, height, alt }`.
- Use `view-helpers.optimizeImageData()` before rendering.

## 4. Coding Standards for Agents
1. **Config Access**: ALWAYS use `require('./services/config')`. Never hardcode paths or URLs.
2. **Slugs**: ALWAYS use `urlSlugService` for slug generation/lookup. Never manually slugify.
3. **Turkish Support**: Respect `tr-TR` locale in dates/slugs. Use provided formatters.
4. **Safety**:
   - **XSS**: Nunjucks `autoescape: true` is ON. Do not use `| safe` unless content is sanitized HTML (e.g., article body).
   - **SQL**: Use `better-sqlite3` prepared statements (`db.prepare().run()`). NO string concatenation.
5. **Modifications**:
   - **DB**: Additive changes only. Update `initializeDatabase()` and `migrateSchemaIfNeeded()`.
   - **CMS**: Update both `server/routes/cms.js` (backend) and `public/cms/js/cms-app.js` (frontend).

## 5. Extension Workflows
### Adding a New Service
1. Create `server/services/MyService.js`.
2. Instantiate in `server/index.js` or route files.
3. Add to `agentReadme.md`.

### Adding a New Widget
1. Create `templates/widgets/myWidget.njk`.
2. Define macro: `{% macro myWidget(data, options) %}`.
3. Import in page: `{% from "widgets/myWidget.njk" import myWidget %}`.

## 6. Verification Checklist
- [ ] Server starts: `npm run dev`.
- [ ] CMS loads: `/cms`.
- [ ] Public pages render: `/`, `/haber/slug`.
- [ ] **Turkish chars** in URLs work (e.g., `/kategori/saglik` matches "Sağlık").
- [ ] `sitemap.xml` generates valid XML.
