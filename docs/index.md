# Project Entry Point Guide

This guide helps you navigate the codebase, understand the entry points, and know which docs to read for each subsystem.

## Server application (`server/`)
- **Entry point:** `server/index.js`
  - Sets up Express, Nunjucks templates, security middleware, sessions.
  - Mounts all routes from `server/routes/`.
  - Hosts the worker scheduler (see `docs/worker-scheduler.md`) which periodically triggers background scripts like the RSS importer.
- **Key services:**
  - `server/services/data-service.js` – SQLite data access, article/category helpers.
  - `server/services/url-slug.js` – slug generation and caching logic (see `docs/slug-cache.md`).
  - `server/services/config.js`, `server/services/view-helpers.js` – global config / Nunjucks helpers.
- **Routing:**
  - Public routes: `server/routes/pages.js` (SSR pages), `server/routes/api.js` (public API).
  - CMS/API routes: `server/routes/cms.js`, `server/routes/cms-media.js`, `server/routes/auth.js`.
  - Middleware: `server/middleware/auth.js`.

## Frontend templates (`templates/`)
- Nunjucks templates for pages (`templates/pages/*.njk`), widgets (`templates/widgets/`), and CMS components (`templates/cms/`).
- CSS/JS assets live under `public/` (global styles) and `public/cms/` (CMS assets).

## Workers (`workers/`)
- `workers/dha-rss-worker.js` – RSS ingestion script. Configured via the `SETTINGS` object at the top of the file (writer, media limits, banned topics). Usage documented in `docs/rss-worker-usage.md`.
- Additional workers can be created and plugged into the scheduler described above.

## Docs overview (`docs/`)
- **Getting started:** `docs/guide.md` – general instructions for extending widgets/routes.
- **Articles API/Data model:** `docs/articles-and-api.md` – schema, API endpoints, and CRUD helpers.
- **CMS:** `docs/agent-guide.md`, `docs/agenticCmsVisualControls.md`, `docs/layout-manager.md`.
- **Slug caching:** `docs/slug-cache.md`.
- **RSS worker usage:** `docs/rss-worker-usage.md`.
- **Worker scheduler:** `docs/worker-scheduler.md`.
- **Widgets/layout mapping:** `docs/agenticPageOrder.md`, `docs/agenticWidgetlist.md`, `docs/agenticUImap.md`.
- **Troubleshooting:** `docs/troubleshooting.md`, `docs/FeaturesLog.txt`.

## Data assets (`data/`, `public/uploads/`)
- SQLite DB: `data/news.db`.
- Uploaded media gets stored under `public/uploads/` (e.g., RSS worker saves images/videos in `public/uploads/media/rss/`).

## Scripts (`scripts/`)
- Deployment, kill-port, sync helpers, etc. See `scripts/README` notes and inline comments.

## Testing (`tests/`)
- Unit and integration tests using Jest (see `tests/unit/`, `tests/integration/`).
- RSS diagnostics: `tests/fetch_rss.js`, `tests/test_rss_content.js`.

Use this entry point guide to locate the relevant files and documentation when you need to modify a feature or understand how the system hangs together.***

