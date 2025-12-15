# Agent Quickstart (for Low-Context Agents)

Use this file first. It links to everything else you need.

## 1. Run & Access
- Install deps: `npm install`
- Dev server: `npm run dev` → http://localhost:3000
- CMS: http://localhost:3000/cms (session-based auth handled server-side)
- DB: SQLite file `data/news.db` (auto-created; back it up before edits)

## 2. Key Paths
| Area | Path | Why it matters |
|------|------|----------------|
| Server entry | `server/index.js` | Express setup, Nunjucks filters, route mounting |
| Services | `server/services/` | Database (`data-service`), slugs, branding config |
| Public routes | `server/routes/pages.js` | Home/article/category rendering + data prep |
| CMS / API | `server/routes/cms.js`, `server/routes/api.js` | CRUD endpoints, layout saves, carousel helpers |
| Templates | `templates/` | Layouts, pages, widgets, CMS components |
| Frontend assets | `public/css`, `public/js` | Styling + interactivity |

## 3. Core Flows
1. **Data fetch** – `data-service.js` reads SQLite; arrays stored as JSON strings (always `JSON.stringify` before saving).
2. **Routes** – e.g. `pages.js` builds `layout` entries and injects branding/meta/nav data.
3. **Templates** – `templates/pages/*.njk` iterate over `layout` and call widget macros (`templates/widgets/*.njk`).
4. **CMS** – `public/cms/js/cms-app.js` handles drag/drop + forms, talks to `server/routes/cms.js`, which persists via `data-service.js`.
5. **Branding** – `/cms` → Marka Ayarları writes to `branding` table, `templates/layouts/base.njk` injects CSS variables (never hardcode colors).

## 4. Do / Don’t
- ✅ Use `require('./services/config')` for URLs/paths (`config.getSiteUrl(req)`, `config.getAssetPath()`).
- ✅ Use `urlSlugService` for slugs (`getSlugForArticle`, `updateSlug`).
- ✅ Touch BOTH `server/routes/cms.js` and `public/cms/js/cms-app.js` when adding CMS features.
- ✅ Update schema via `initializeDatabase()` + migration helpers; keep changes additive.
- ❌ Don’t hardcode colors or asset paths.
- ❌ Don’t bypass prepared statements (`db.prepare().run(...)` only).
- ❌ Don’t use `| safe` in Nunjucks unless content is sanitized HTML (article body already is).

## 5. Common Tasks
| Task | Where to look |
|------|---------------|
| Add widget | `docs/add-widget.md`, `templates/widgets/`, `public/css/widgets.css` |
| Adjust layout order | `docs/layout-manager.md`, `public/cms/js/cms-app.js` |
| Update branding | `docs/branding.md`, `templates/layouts/base.njk` |
| CRUD articles via API | `docs/articles-and-api.md`, `server/routes/cms.js` |
| Understand widget data | `docs/widget-data-flow.md`, `server/routes/pages.js` |

## 6. Smoke Checklist
- [ ] `npm run dev` boots without DB errors.
- [ ] `/` renders (carousel + flash news populated).
- [ ] `/cms` loads; layout drag/drop saves (check `layout-changes.log`).
- [ ] Branding form changes colors/logos on `/`.
- [ ] API sample: `curl http://localhost:3000/api/articles` works.

## 7. Helpful References
- `docs/widget-rendering.md` – overview of layout → macro pipeline.
- `docs/layout-manager.md` – homepage + article layout + carousel control.
- `docs/widget-data-flow.md` – detailed fetch/config steps.
- Legacy deep dives (`agentic*.md`) now live under `docs/` for topic-specific context.










