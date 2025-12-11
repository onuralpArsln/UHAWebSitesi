# Widget Data Flow (End-to-End)

This doc follows a single widget from stored data → rendered HTML. Use it when debugging “why is this widget empty?” or when adding a new widget type that needs data.

## 1. Layout Entry Comes from CMS
1. Editor arranges widgets in the CMS (homepage or article layout managers).
2. Layout JSON lives in SQLite tables (`homepage_layout`, `article_layout`) via `data-service.js`.
3. Each entry has `{ type, config }` and (after routing) a `data` payload.

## 2. Route Collects Data
1. Public routes (`server/routes/pages.js`) read the saved layout and loop through it.
2. For each widget, routes may fetch extra data:
   - `carousel` → `dataService.getArticles()` or `getCarouselArticles()`.
   - `category-feed` → `getArticles({ category })`.
   - `flash-news` → latest articles sorted by `publishedAt`.
3. Routes enrich the widget object:
   ```javascript
   const widgetData = { ...widget, data: { articles: [...] } };
   processedLayout.push(widgetData);
   ```
4. Final page data includes `layout: processedLayout` (homepage) or the equivalent for article pages.

## 3. Page Template Renders the Layout
1. Example (`templates/pages/home.njk`):
   ```nunjucks
   {% for widget in layout %}
     {{ widgetRenderer.render(widget) }}
   {% endfor %}
   ```
2. The renderer is just another widget macro file (`templates/widgets/widget-renderer.njk`).

## 4. Widget Renderer Picks the Macro
1. `render(widget)` switches on `widget.type`.
2. It calls the correct macro, passing `widget.data` and `widget.config`.
3. If the type is missing here, nothing shows—add a branch whenever you create a new widget type.

## 5. Macro Generates HTML
1. Macro files live in `templates/widgets/*.njk`.
2. They expect plain objects/arrays (`widget.data`) and config booleans/strings.
3. Keep macros dumb: just format and display what they receive—no DB calls.

## 6. Styling & Interaction
1. CSS lives under `public/css/` (mostly `widgets.css`, `main.css`, `header.css`, etc.).
2. JS enhancements use files in `public/js/` (carousel, flash news, nav, etc.).
3. Base layout (`templates/layouts/base.njk`) loads the shared assets, so widgets only need predictable classes/data attributes.

## 7. Debug Checklist
- Confirm CMS layout JSON actually contains the widget (check DB or `layout-changes.log`).
- Log the route data to see if `widget.data` holds what you expect.
- Ensure `widget-renderer.njk` has a branch for the widget type.
- Verify the macro is imported correctly if you render it manually in a page.
- Double-check CSS/JS assets were added to `base.njk` if you introduced new files.

## Related Docs
- `layout-manager.md` – how layout entries are created (homepage, article, carousel).
- `widget-rendering.md` – higher-level rendering summary.
- `add-widget.md` – steps to introduce a new widget.
- `articles-and-api.md` – all fields available when fetching articles.





