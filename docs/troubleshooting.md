# Troubleshooting Cheat Sheet

Short answers for the most common issues. Follow the “If X → Do Y” rows.

| Symptom | Fix |
|---------|-----|
| Widget shows nothing | Ensure the macro is imported in the page template and the data array is not empty. Log the data in `server/routes/pages.js` if unsure. |
| Colors do not change after saving branding | View page source and look for `<style id="branding-variables">`. If values are old, confirm POST `/cms/branding` succeeded (check server logs) and that you refreshed the public page, not just the CMS. |
| Category dropdown in CMS shows wrong value | Update both `widget.config.categorySlug` and `widget.config.slug`. Call `updateLayoutCategorySelects()` after categories load. |
| Layout manager save fails | Check terminal/log for `PUT /cms/layouts/homepage` errors. Usually caused by invalid JSON or missing `type` field. |
| Carousel looks broken on load | Verify `public/js/carousel.js` is loaded (network tab) and that slides include at least one image with width/height attributes to avoid CLS. |
| "Manşete Ekle" modal shows no articles | Ensure you have articles with `status: 'visible'` that aren't already in the carousel. Hidden articles are automatically excluded. |
| Article doesn't appear after clicking in modal | Check browser console for errors. Verify the API endpoint (`/cms/carousel/add` or `/cms/ana-manset/add`) returned success. The table should refresh automatically. |
| Articles API returns 500 | Payload must be JSON. Ensure arrays (`tags`, `images`, `targettedViews`) are arrays, not comma-separated strings. |
| Uploaded logo not showing | Confirm file saved under `public/uploads/branding/` and that the page references it via `branding.headerLogo` / `branding.footerLogo`. If path looks like `C:\\`, convert to web path `/uploads/...` using `formatBranding()`. |
| Mock data keeps coming back | The database file `data/news.db` might be deleted between runs. Keep it in place or copy your backup over after mock migration. |
| CMS layout list empty | `initialState.homepageLayout` might be `null`. Ensure `data-service.js` `ensureHomepageLayoutDefaults()` runs (call server once) and the API `/cms/layouts/homepage` returns an array. |
| Widget styles missing | Verify the relevant CSS file is imported in `templates/layouts/base.njk`. For new files under `public/css/`, add a `<link>` tag there. |

Need a deeper dive? Check `agentReadme.md` for architecture or the doc that matches your task.

## Related Docs
- `docs/README.md` – overview of everything in this folder.
- `add-widget.md` / `widget-rendering.md` – creation + data flow.
- `layout-manager.md` – CMS drag-and-drop issues.
- `branding.md` – color/logo specifics.
- `articles-and-api.md` – CRUD operations.

