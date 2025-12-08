# Homepage Layout Manager (CMS Guide)

Use this when you must change the drag-and-drop “Sayfa Düzeni” tab or add new layout-controlled widgets.

## 0. Components
- **CMS UI**: `templates/cms/components/layout-list.njk`
- **Client JS**: `public/cms/js/cms-app.js` (`CMSDashboard` methods)
- **API Route**: `server/routes/cms.js` `PUT /cms/layouts/homepage`
- **Database**: `homepage_layout` table via `server/services/data-service.js`

## 1. How Saving Works
1. Editor drags rows → DOM order changes.
2. Save button runs `saveLayout()` in `cms-app.js`.
3. JS collects rows, builds a `layout` array, and sends it to `/cms/layouts/homepage`.
4. Route validates + logs + writes JSON to SQLite.
5. Public homepage route (`server/routes/pages.js`) reads the saved layout and renders widgets in that order.

## 2. Add a Widget Type to the Layout Manager
1. **availableWidgets**: In `cms-app.js`, append an entry:
   ```javascript
   {
     type: 'my-widget',
     title: 'Yeni Widget',
     defaults: { limit: 4 }
   }
   ```
2. **Config Inputs**: Update `templates/cms/components/layout-list.njk` to show form controls (select, checkbox, etc.) when `widget.type == 'my-widget'`.
3. **Renderer Support**: Ensure `templates/widgets/widget-renderer.njk` knows how to render `my-widget`.
4. **Homepage Data**: `server/routes/pages.js` must fetch any special data and pass it into the renderer.

## 3. Category Dropdown Safety
- `cms-app.js` and `layout-list.njk` both read `widget.config.categorySlug` **or** `widget.config.slug`.
- Keep this dual check to avoid breaking older layout entries.

## 4. Default Layout
- Defined in `ensureHomepageLayoutDefaults()` inside `data-service.js`.
- Update this array if you need new installs to start with your widget.

## 5. Logging
- Every save appends a summary to `layout-changes.log` (repo root).
- Terminal also prints widget orders to help debugging.

## 6. Common Tasks
| Task | Steps |
|------|-------|
| Reorder widgets | Use drag handles → Save → Refresh homepage |
| Add config field | Update `layout-list.njk` inputs + `updateWidgetConfig()` in `cms-app.js` |
| Force category refresh | Call `updateLayoutCategorySelects()` after modifying `state.categories` |
| New layout page | Duplicate the pattern: new API route, new DB key, new CMS section |

## 7. Troubleshooting
- If saving fails, check server logs for validation errors (look for `/cms/layouts/homepage`).
- If dropdowns show wrong categories, ensure `updateLayoutCategorySelects()` runs when switching to the layout tab.
- If widgets render empty, confirm the homepage route is still mapping config → data before calling the renderer.

## Related Docs
- `add-widget.md` – build the widget you wish to expose.
- `widget-rendering.md` – learn how the renderer consumes layout entries.
- `articles-and-api.md` – know what data widgets can fetch.
- `troubleshooting.md` – layout-saving issues and more.

