<!-- For AI agents and code editors contributing to this repo -->
# agentReadme.md – System Context & Guide

## 1. System Architecture
**Stack**: Node.js (v18+), Express, Nunjucks (SSR), SQLite3 (WAL mode).
**Pattern**: Monolithic SSR with file-backed database. No build step required for SSR.
**Assets**: Static files served from `public/`.

### Key Dependencies
- **`better-sqlite3`**: SQLite database driver with synchronous API.
- **`nunjucks`**: Template engine for SSR.
- **`multer`**: File upload handling for CMS media management.
- **`sharp`**: Image processing and optimization.
- **`node-cache`**: In-memory caching layer.
- **`helmet`**: Security headers (applied for HTTPS requests only).
- **`compression`**: Response compression (gzip).
- **`slugify`**: URL slug generation with Turkish character support.

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
- **`cms-media.js`**: Media upload/management API for CMS.
  - *Endpoints*: `GET /cms/media` (list), `POST /cms/media/upload`, `DELETE /cms/media`, `PUT /cms/media` (rename/move).
  - *Folder Management*: `POST /cms/media/folders`, `PUT /cms/media/folders`, `DELETE /cms/media/folders`.
  - *Storage*: Files stored in `public/uploads/media/`.

### CMS Branding System
**Purpose**: Centralized visual identity control through database-backed color and logo management.

**Key Files**:
- **`public/css/modern-variables.css`**: Maps custom CSS variables to CMS branding variables.
  - `--color-bg-secondary` → `var(--primary-color)` (header/footer backgrounds)
  - `--color-accent` → `var(--accent-color)` (links, badges, buttons)
- **`templates/layouts/base.njk`**: Injects branding CSS variables from database.
### Templates (`templates/`)
- **`layouts/`**: Base HTML wrappers (`base.njk`).
- **`pages/`**: Public views (`home.njk`, `article.njk`, `category.njk`, `search.njk`).
- **`widgets/`**: Reusable macros:
  - `site-header.njk` - Global header with navigation
  - `footer.njk` - Global footer
  - `news-card.njk` - Article card component
  - `carousel.njk` - Hero carousel
  - `flashNews.njk` - Breaking news ticker
  - `ad-placeholder.njk` - Ad placeholder
  - `article-view.njk` - Article detail view
  - `comment-section.njk` - Comments section
  - `related-news.njk` - Related articles
  - `carouselSetSize.njk` - Carousel with size variants
- **`cms/`**: Admin views. Heavily relies on client-side JS (`public/cms/js/cms-app.js`).

### Client-Side JavaScript (`public/js/`)
- **`carousel.js`**: Hero carousel auto-rotation, manual controls, and slide transitions.
- **`flash-news.js`**: Breaking news ticker animation with pause-on-hover.
- **`nav.js`**: Mobile navigation toggle and overlay management.
- **`lazy-load.js`**: Image lazy loading with Intersection Observer.
- **`hydration.js`**: Client-side hydration for interactive elements.
- **`ad-refresh.js`**: Ad refresh logic and viewability tracking.
- **`carousel-cls-fix.js`**: Carousel CLS (Cumulative Layout Shift) optimization.

### Nunjucks Filters (defined in `server/index.js`)
- **`formatDate`**: Formats dates in Turkish locale (medium date + short time).
  - *Usage*: `{{ article.publishedAt | formatDate }}`
- **`formatTime`**: Formats time in Turkish locale (HH:MM).
  - *Usage*: `{{ item.creationDate | formatTime }}`
- **`initials`**: Extracts first character (uppercase) from a string.
  - *Usage*: `{{ author.name | initials }}`

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
4. **Branding Colors**: ALWAYS use CSS variables (`--primary-color`, `--accent-color`) or mapped variables (`--color-bg-secondary`, `--color-accent`). Never hardcode color values in CSS.
5. **Safety**:
   - **XSS**: Nunjucks `autoescape: true` is ON. Do not use `| safe` unless content is sanitized HTML (e.g., article body).
   - **SQL**: Use `better-sqlite3` prepared statements (`db.prepare().run()`). NO string concatenation.
6. **Modifications**:
   - **DB**: Additive changes only. Update `initializeDatabase()` and `migrateSchemaIfNeeded()`.
   - **CMS**: Update both `server/routes/cms.js` (backend) and `public/cms/js/cms-app.js` (frontend).
   - **Branding**: To add new branding-controlled elements, use existing CSS variables. Do not create new color variables.

## 5. Extension Workflows
### Adding a New Service
1. Create `server/services/MyService.js`.
2. Instantiate in `server/index.js` or route files.
3. Add to `agentReadme.md`.

### Adding a New Widget
1. Create `templates/widgets/myWidget.njk`.
2. Define macro: `{% macro myWidget(data, options) %}`.
3. Import in page: `{% from "widgets/myWidget.njk" import myWidget %}`.
4. Add corresponding CSS in `public/css/` if needed.
5. Add client-side JS in `public/js/` if interactive behavior is required.

## 6. Verification Checklist
- [ ] Server starts: `npm run dev`.
- [ ] CMS loads: `/cms`.
- [ ] Public pages render: `/`, `/haber/slug`.
- [ ] **Turkish chars** in URLs work (e.g., `/kategori/saglik` matches "Sağlık").
- [ ] `sitemap.xml` generates valid XML.
- [ ] **CMS Branding**: Change colors in `/cms` → Marka Ayarları, verify header/footer/widgets update.
- [ ] **Color Variables**: Inspect `<style id="branding-variables">` in page source, verify CSS variables injected.
