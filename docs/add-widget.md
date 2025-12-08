# Add a New Widget (Safe Mode)

Use this file when you must add a frontend widget (Nunjucks macro + styles + optional JS). Every step is bite-sized so a low-context agent can follow along.

## 0. Quick Checklist
1. Duplicate an existing widget file under `templates/widgets/`.
2. Rename the macro and adjust HTML.
3. Add or update styling in `public/css/`.
4. (Optional) Add JS in `public/js/`.
5. Import the widget from the page/template that needs it.
6. If the widget should appear in the homepage layout manager, register it there.

## 1. Create the Template
1. Pick a reference widget similar to what you need (`templates/widgets/news-card.njk` is a good starting point).
2. Copy that file to `templates/widgets/<new-widget>.njk`.
3. Update the macro name:
   ```nunjucks
   {% macro myWidget(data = {}, config = {}) %}
   ...
   {% endmacro %}
   ```
4. Keep props simple: plain objects or arrays coming from routes. Avoid accessing global variables unless necessary.

## 2. Style the Widget
1. Locate the closest CSS file under `public/css/`.
2. If the widget affects the main site, prefer extending `widgets.css` or `main.css`.
3. Use CSS variables instead of hard-coded colors:
   ```css
   background: var(--primary-color);
   color: var(--nav-text-color);
   ```
4. Keep selectors prefixed with a unique class (e.g., `.widget-latest-promo`) to avoid clashes.

## 3. Optional JavaScript
1. Only create JS if the widget needs interaction.
2. Add a new file to `public/js/` or extend an existing one.
3. Wrap code in an IIFE so it runs after DOM load:
   ```javascript
   (function () {
     const widget = document.querySelector('[data-widget="latest-promo"]');
     if (!widget) return;
     // behavior here
   })();
   ```
4. Include the script in `templates/layouts/base.njk` or the specific page template if it should not run globally.

## 4. Render the Widget on a Page
1. Open the page template (e.g., `templates/pages/home.njk`).
2. Import your widget macro near the top:
   ```nunjucks
   {% from "widgets/my-widget.njk" import myWidget %}
   ```
3. Call the macro where you want it to display:
   ```nunjucks
   {{ myWidget({ articles: featuredArticles }, { variant: 'compact' }) }}
   ```

## 5. Hook into the Homepage Layout (Optional)
1. If editors should control the widget via the CMS layout manager:
   - Add a default entry in `server/services/data-service.js` inside `ensureHomepageLayoutDefaults()`.
   - Update `public/cms/js/cms-app.js` `availableWidgets` array with labels, default config, and config form controls.
   - Extend `templates/cms/components/layout-list.njk` to show any widget-specific inputs.
2. Confirm the widget type is handled in `templates/widgets/widget-renderer.njk`.

## 6. Test
- Run `npm run dev`.
- Open `/` and `/cms`.
- Confirm the widget renders, styles apply, and CMS controls (if any) behave correctly.

## Related Docs
- `widget-rendering.md` – data flow details.
- `layout-manager.md` – make the widget selectable in CMS.
- `articles-and-api.md` – know which article fields you can rely on.
- `troubleshooting.md` – quick fixes if something breaks.

