<!-- For AI agents and code editors contributing to this repo -->
# agentReadme.md – Guide for AI Code Editors

## Purpose
An information-dense reference so AI agents can safely navigate, edit, and extend this codebase without breaking SSR, CMS, or data integrity.

## System Overview
- Backend: Node.js + Express
- Templating: Nunjucks (SSR, autoescape enabled)
- Database: SQLite3 via better-sqlite3 (file-backed), WAL mode
- Storage: `data/news.db`, uploads under `public/uploads/*`

Key directories and files:
- `server/index.js` – Express, Nunjucks env setup
- `server/routes/pages.js` – Public site pages (home/article/category/search)
- `server/routes/api.js` – Public JSON APIs
- `server/routes/cms.js` – CMS panel + CMS actions
- `server/services/data-service.js` – DB init/schema/migrations/queries
- `templates/layouts/`, `templates/pages/` – Frontend SSR pages
- `templates/widgets/` – Reusable Nunjucks macro widgets
- `templates/cms/**` – CMS layouts/components/pages
- `public/css`, `public/js` – Frontend assets
- `public/cms/css`, `public/cms/js` – CMS assets
- `public/uploads/branding` – Branding asset uploads
- `data/news.db` – SQLite database (gitignored)

## Rendering & Routing
Server-side rendering uses Nunjucks with autoescape on. Routes render templates and inject data.
- Public pages: handled in `server/routes/pages.js`
- Public API endpoints: `server/routes/api.js`
- CMS panel and CMS actions: `server/routes/cms.js`
- Template root: `templates/` with view engine set to `.njk`

Example map (high-level):
- `/` → `templates/pages/home.njk`
- `/article/:slug` → `templates/pages/article.njk`
- `/category/:slug` → `templates/pages/category.njk`
- `/search` → `templates/pages/search.njk` (if present)
- `/api/*` → JSON responses
- `/cms` → `templates/cms/pages/dashboard.njk` (dashboard with injected `initialState`)

## Database & Data Service
SQLite DB located at `data/news.db` (created on first run). Managed by `server/services/data-service.js`.
- Pragmas: `journal_mode = WAL`
- Indices: category, creationDate, targettedViews, etc.
- Migration approach: additive, backward-compatible

Tables (summary):
- `articles` (TEXT primary key `id`; key fields)
  - `header`, `summaryHead`, `summary`, `body` (HTML), `category`, `writer`, `source`
  - `creationDate`, `updatedAt`, `publishedAt` (legacy), `status` (default `'visible'`)
  - JSON-in-TEXT: `tags`, `images`, `outlinks`, `targettedViews`, `relatedArticles`
  - Legacy/back-compat fields: `title`, `content`, `author`, `publishedAt`, `keywords`
- `categories`
  - `id` (TEXT PK), `name` (UNIQUE), `description`, `slug`, `articleCount`
- `branding`
  - `siteName`, `primaryColor`, `secondaryColor`, `accentColor`, `headerLogo`, `footerLogo`, `updatedAt`

JSON-in-TEXT convention:
- When reading: `JSON.parse(field || '[]'/'{}')`
- When writing: `JSON.stringify(value)` and store as TEXT

## Widgets & Nunjucks Conventions
Widgets are Nunjucks macros under `templates/widgets/*`. Import and call:
```njk
{% from "widgets/flashNews.njk" import flashNews %}
{{ flashNews("breaking", items, { limit: 10, showTime: true, className: "is-compact" }) }}
```

Guidelines:
- Keep widgets pure: accept data, return HTML
- Validate presence of required fields; handle optional ones defensively
- Prefer semantic markup and BEM-like classes already in use

flashNews widget (example contract):
- Signature: `{% macro flashNews(id, items, config) %}`
- items[] expected minimal fields:
  - `id` (string)
  - `slug` (string) – used for links
  - `title` or `header` (string) – display text
  - `creationDate` or `publishedAt` (ISO string) – optional time badge
- config (optional):
  - `limit` (number) – max items to render
  - `showTime` (boolean) – show relative/absolute time
  - `className` (string) – extra CSS classes on container

Sample items:
```json
[
  { "id": "a1", "slug": "breaking-1", "title": "Breaking news one", "creationDate": "2025-11-10T08:00:00Z" },
  { "id": "a2", "slug": "breaking-2", "header": "Breaking news two", "publishedAt": "2025-11-10T09:00:00Z" }
]
```

## CMS Panel
- Entry: `/cms` → `templates/cms/pages/dashboard.njk`
- Components under `templates/cms/components/*` (sidebar, topbar, tables, forms, editor)
- Assets: `public/cms/css/cms.css`, `public/cms/js/cms-app.js`
- Branding:
  - Uploads saved to `public/uploads/branding/`
  - Route composes `initialState` in `server/routes/cms.js` and injects `initialStateJson` into the template
- Typical initialState keys: `stats`, `articles`, `categories`, `recentArticles`, `settings`, `targetOptions`, `branding`

## Environment & Running Locally
Requirements:
- Node.js >= 18

Scripts:
```bash
npm install
npm run dev           # start dev server with nodemon
node server/index.js  # start production-style server
```

Example `.env` (placeholders only; do not commit real secrets):
```env
PORT=3000
SITE_URL=https://example.com
SITE_NAME=UHA News
SITE_DESCRIPTION=Latest news and updates
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxx
ADSENSE_SLOT_ID=xxxxxxxxxx
```

## Safe Editing Conventions (for AI)
- Do not hardcode secrets; keep placeholders and read from `process.env`
- Preserve JSON-in-TEXT columns; always parse/stringify safely with try/catch on the edges
- Schema changes must be additive/backward-compatible; retain legacy fields
- Match existing code style, naming, and HTML/CSS class conventions; avoid broad reformatting
- Validate inputs for new endpoints/forms; sanitize/escape as needed; keep SSR autoescape on
- Keep logging minimal and structured; avoid noisy console logs on hot paths
- Prefer small, composable widgets/macros; avoid coupling CMS code with public SSR widgets

## Common Extension Guides
Add a new widget:
1) Create `templates/widgets/MyWidget.njk` with a macro
2) Import in a page: `{% from "widgets/MyWidget.njk" import MyWidget %}`
3) Call with required data; add CSS/JS if needed under `public/`

Add a new article field (end-to-end):
1) DB: Add new TEXT column in `initializeDatabase()` (additive) and any required index
2) Data service: parse/stringify in getters/setters as needed
3) CMS: expose field in editor form macro and in `cms-app.js` handling
4) Frontend: render field in relevant templates/widgets

Add a CMS action:
1) Route in `server/routes/cms.js` with input validation
2) Call appropriate data-service method
3) Update client (if needed) in `public/cms/js/cms-app.js`
4) Reflect state in `initialState` or return JSON for dynamic updates

## Quick Test Checklist
- Start dev server and open `/cms`
- Create or edit an article, verify it appears on `/`
- Check that slugs/pages render and no template errors occur
- Verify branding upload updates header/footer assets
- Confirm JSON fields parse/render correctly (tags/images/outlinks/targettedViews)

---
Use paths mentioned above when referencing files. Keep edits incremental, reversible, and consistent with existing patterns.


