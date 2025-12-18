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

## 8. Article Layout Manager (Makale Düzeni)
- **UI**: `templates/cms/components/article-layout.njk`
- **Client JS**: Same `public/cms/js/cms-app.js` instance (`initializeArticleLayoutManager`, `saveArticleLayout`, etc.).
- **API Route**: `PUT /cms/layouts/article`
- **Database**: `article_layout` table (`getArticleLayout()`, `updateArticleLayout()` in `data-service.js`).

Flow = identical to homepage: drag rows → `saveArticleLayout()` → server logs update → `server/routes/pages.js` uses `getArticleLayout()` when rendering `/haber/:slug`.

Tips:
- Widget types include `article-hero-image`, `article-content`, `related-articles`, `comment-section`, etc. Inputs live in `article-layout.njk`.
- If you add a new article widget, update this config UI, `availableArticleWidgets` in `cms-app.js`, and `templates/widgets/article-widget-renderer.njk` (if present) or direct usage in `pages/article.njk`.

## 9. Carousel Manager (Manşet Düzeni)

The Carousel Manager consists of two sections:
- **Manşet Slider** (Carousel) – main hero carousel
- **Ana Manşet** – secondary headline carousel

### UI Components
- **Template**: `templates/cms/components/headline-layout.njk`
- **Client JS**: `cms-app.js` carousel helpers (`loadHeadlineLayout`, `loadAnaMansetLayout`, `saveHeadlineLayout`, `saveAnaMansetLayout`, etc.)
- **Modals**: Article selection modals for adding articles to carousels

### Adding Articles to Carousels

Each carousel section has a **"Manşete Ekle"** (Add to Carousel) button next to the "Değişiklikleri Kaydet" button:

1. Click **"Manşete Ekle"** to open the article selection modal
2. The modal displays all available articles (excluding those already in the carousel and hidden articles)
3. Use the search input to filter articles by title, category, or summary
4. Click on an article to add it to the carousel
5. The modal closes and the carousel table refreshes automatically

**Features**:
- Duplicate prevention: Articles already in the carousel are automatically filtered out
- Real-time search: Filter articles as you type
- Visual feedback: Article cards show thumbnails, titles, categories, dates, and status
- Modal controls: Close button, backdrop click, or ESC key to dismiss

### API Routes
- `GET /cms/carousel` – fetch manual carousel config + articles
- `PUT /cms/carousel` – save ordering/config
- `POST /cms/carousel/add` – add article id (auto-enforces max)
- `GET /cms/ana-manset` – fetch ana manşet config + articles
- `PUT /cms/ana-manset` – save ana manşet ordering/config
- `POST /cms/ana-manset/add` – add article id to ana manşet

### Database
Handled via `dataService.getCarouselLayout()`, `updateCarouselLayout()`, `getCarouselArticles()`, `getHeadlineListArticles()`, and `addArticleToHeadlineList()`.

### Data Flow
1. Manual source widgets (`carousel` with `config.source === 'manual'`) pull from `carousel_layout` table
2. Featured/automatic carousels rely on `targettedViews` (articles tagged with `targettedView: 'carousel'` or `targettedView: 'ana-manset'`)
3. The CMS "Manşet Düzeni" tab shows articles from the manual layout tables, which editors can reorder via drag-and-drop

## Related Docs
- `add-widget.md` – build the widget you wish to expose.
- `widget-rendering.md` – learn how the renderer consumes layout entries.
- `articles-and-api.md` – know what data widgets can fetch.
- `troubleshooting.md` – layout-saving issues and more.

