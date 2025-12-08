# Widget Rendering (Data Flow Map)

Goal: explain how a widget receives data and shows up on the site. Follow this order every time you debug or add a widget.

## 1. Data Source
1. `server/services/data-service.js` fetches SQLite rows (articles, categories, branding).
2. Each public route (in `server/routes/pages.js`) calls the service and prepares plain JS objects.

## 2. Route to Template
1. The route passes data into `res.render('<page>.njk', pageData)`.
2. Common keys:
   - `articles`, `featuredArticles`, `flashNewsItems`
   - `branding`
   - `layoutWidgets` (homepage layout array)

## 3. Layout Wrapper
1. All pages extend `templates/layouts/base.njk`.
2. Base layout injects branding CSS variables and global assets (`public/css`, `public/js`).

## 4. Page Templates
1. Example: `templates/pages/home.njk`.
2. Imports required widgets via Nunjucks:
   ```nunjucks
   {% from "widgets/news-card.njk" import newsCard %}
   ```
3. Loops through data and renders widget macros:
   ```nunjucks
   {% for widget in layoutWidgets %}
     {{ render(widget) }}
   {% endfor %}
   ```

## 5. Widget Macros
1. Stored under `templates/widgets/`.
2. Each file defines a macro that receives data/config from the page.
3. Keep macros pure—no DB calls, only formatting.

## 6. Widget Renderer
1. `templates/widgets/widget-renderer.njk` routes a layout item to the correct macro using `widget.type`.
2. Supported types are documented in `agenticWidgetlist.md`.
3. Add a new branch there whenever you introduce a widget that should be selectable from the CMS layout.

## 7. Styling & Scripts
1. CSS lives in `public/css/`; widgets usually rely on `widgets.css`, `main.css`, or a dedicated file.
2. JavaScript lives in `public/js/` (e.g., `carousel.js`, `flash-news.js`).
3. Base layout loads these assets, so widgets just need the right data attributes/classes.

## 8. Debugging Tips
- Verify the route sends the data you expect (`console.log` in `pages.js` if needed).
- Ensure the widget macro is imported (missing import = blank output).
- If CMS layout isn’t updating, confirm the widget type exists in the renderer and layout manager config.

## Related Docs
- `add-widget.md` – create new widgets safely.
- `layout-manager.md` – how CMS chooses which widget renders.
- `articles-and-api.md` – understand article payloads.
- `troubleshooting.md` – common symptoms/fixes.

