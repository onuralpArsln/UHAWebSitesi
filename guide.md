# Manşet Targeting & Dynamic Widget Guide

This document captures how UHA CMS collects targeting metadata during article creation, how the Manşet (carousel) widgets resolve their data dynamically, and how to extend the system with new targets or widgets without touching production logic.

---

## 1. Article Targeting Lifecycle

1. **Options surfaced in CMS UI**  
   The article editor template loops over `targetOptions` to render the “Hedef Alanlar” checkbox grid, so the form auto-updates when the server adds new entries. The source array lives in `server/routes/cms.js` near the dashboard route (`const targetOptions = [...]`); editing that list is the only step needed to expose a new checkbox in the UI.
   - Template hook: `templates/cms/components/article-editor.njk`.

2. **Form defaults and serialization**  
   `public/cms/js/cms-app.js` sets “category-feed” as the default target for new stories and serializes all checked boxes into `payload.targettedViews` before calling `/cms/articles`.

3. **CMS API ingestion**  
   `server/routes/cms.js` normalizes `targettedViews` (via `toArray`) for both POST `/cms/articles` and PUT `/cms/articles/:id`. The same route exposes `/cms/articles/:id/targets` so editors can add/remove targets later.

4. **Storage model**  
   `server/services/data-service.js` persists `targettedViews` as a JSON string inside a `TEXT` column on the `articles` table (`CREATE TABLE` + `INSERT` + `UPDATE` paths all stringify the array). Index `idx_articles_targettedViews` speeds up lookups.

5. **Query semantics**  
   Every widget or API call uses `DataService.getArticles({ targettedView: 'value' })`, which adds a `targettedViews LIKE '%"value"%'` clause. No extra tables are required, and the same code serves all widgets.

---

## 2. How Manşet / Carousel Data Is Resolved

1. **Layout-driven flow**  
   `server/routes/pages.js` reads the persisted `homepage_layout` JSON (`getHomepageLayout()`), filters out hidden widgets, and for each widget type populates `widget.data` before rendering `pages/home.njk`.

2. **Dynamic vs manual Manşet**  
   - `widget.type === 'carousel'` with `widget.config.source === 'featured'`: fetches articles via `getArticles({ targettedView: 'carousel', status: 'visible', sort/pagination config })`.  
   - `widget.config.source === 'manual'`: uses `DataService.getCarouselArticles()` to honor the legacy `carousel_layout` ordering.

3. **CMS preview endpoint**  
   `GET /cms/carousel` now bypasses the manual table and returns `populatedArticles` built from `targettedView: 'carousel'`, while `PUT /cms/carousel` still writes the manual ordering. Editors therefore see dynamic data when viewing the Manşet tab.

4. **Other widgets**  
   `featured-news-grid`, `category-feed`, and `flash-news` reuse the same pattern (switch-case calls `getArticles` with the widget’s type or config), so any new targeted view can be wired in through the same logic.

---

## 3. Extension Strategy

| Layer | Action to add a new targeting option or widget |
| --- | --- |
| CMS UI | Append `{ value, label }` to `targetOptions` in `server/routes/cms.js`; the article editor template updates automatically. |
| Data | No schema work; `targettedViews` already stores arbitrary JSON arrays. Ensure the new value is tagged on articles via the editor or `/cms/articles/:id/targets`. |
| Layout | Use the homepage layout editor (or `PUT /cms/layouts/homepage`) to add/update a widget entry. Set `widget.type` or `widget.config.source` to match the new target’s semantics. |
| Rendering | Extend the switch in `server/routes/pages.js` to recognize the type/source, call `getArticles({ targettedView: 'your-target' })`, and map the data through helpers (`optimizeImageData`, slug generation). |
| Templates | Point the layout entry at an existing widget template in `templates/widgets`, or add a new template if the UI is unique. |
| Flags (optional) | Use extra config keys (e.g., `limit`, `categoryName`, `mode`) to refine queries without changing the core pipeline. |

---

## 4. Developer Workflow: Coding a New Targeted Widget

1. **Declare the target**  
   Pick a unique slug (e.g., `spotlight-hero`) and append `{ value, label }` to the `targetOptions` array inside `server/routes/cms.js`. This ensures editors can tag articles for your widget.
   - _Example_: add `{ value: 'spotlight-hero', label: 'Spotlight Kahraman' }` right under the existing target list.

2. **Create the widget template**  
   Build a dedicated `.njk` under `templates/widgets`. Start from an existing component (e.g., `featured-news-grid.njk`) and adjust markup/styles while assuming you will receive `articles` via `widget.data`.
   - _Example_: create `templates/widgets/spotlight-hero.njk` that renders a four-card grid with hero styling.

3. **Expose the widget in layouts**  
   Decide how the layout references your template. You can:
   - Add a new widget entry to `homepage_layout` via the CMS layout editor or by updating the default JSON in `server/services/data-service.js`.
   - Include config such as `{ type: 'spotlight-hero', config: { title: 'Spotlight', limit: 4 } }`.
   This tells the rendering pipeline to look for a `spotlight-hero` case.

4. **Fetch targeted data**  
   In `server/routes/pages.js`, extend the widget switch:
   - Add a `case 'spotlight-hero':` block.
   - Read configuration (`const limit = widget.config.limit || 4;`).
   - Call `dataService.getArticles({ targettedView: 'spotlight-hero', status: 'visible', limit, sortBy: 'publishedAt', sortOrder: 'desc' })`.
   - Map results to include `slug` and `optimizeImageData`.
   This is where you control article count, ordering, and filters.

5. **Wire the renderer**  
   Ensure your layout entry points to the new template. If the widget type matches the template filename, the shared widget renderer (`templates/widgets/widget-renderer.njk` or page-specific loops) will render it automatically; otherwise, add a branch in the renderer to include your template file.

6. **Tag articles & verify targeting**  
   Editors can now tick “Spotlight Kahraman” when creating articles. Because your page-route case filters by `targettedView: 'spotlight-hero'`, only tagged articles will flow into the widget. Limit/ordering adjustments happen entirely in your switch case, so tweaking `limit` or `sortBy` immediately affects the output.

7. **Test end-to-end**  
   - Use `/cms/articles` to confirm tagging.
   - Visit `/` to ensure the widget renders the newest four tagged articles.
   - Adjust `widget.config.limit` or query arguments to change how many items the widget displays, then reload to verify.

This developer-centric flow keeps all wiring inside version-controlled files while leveraging the existing targeting infrastructure.

Following this guide keeps the targeting logic centralized (single table + `getArticles` filter) while letting editors and layout managers decide where stories surface. No schema migrations, no duplicate tables—just new entries in the existing configuration surfaces.


