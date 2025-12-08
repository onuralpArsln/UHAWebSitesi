# Branding Controls (Color + Logo Guide)

This explains how editors change site visuals through the CMS and how the code uses those values.

## 1. CMS Form
- Location: `/cms` → “Marka Ayarları”.
- Template: `templates/cms/components/branding-form.njk`.
- Fields: site name, primary/secondary/accent colors, logo text color, nav colors, header/footer logos.
- JS: `public/cms/js/cms-app.js` (`handleBrandingColorInput`, `handleBrandingFileInput`, `saveBranding`).

## 2. Save Flow
1. Form builds a `FormData` payload (color hexes + optional files).
2. POST `/cms/branding` (handled in `server/routes/cms.js`).
3. Route validates, stores colors in the `branding` table, saves uploaded logos to `public/uploads/branding/`, deletes old files, and returns the updated branding object.

## 3. Database
- Table: `branding` (singleton row with id `branding`).
- Managed by `server/services/data-service.js` (`getBranding`, `updateBranding`, `ensureBrandingDefaults`).
- Default colors and empty logo paths are injected if the table is missing data.

## 4. Frontend Usage
1. Every public route calls `formatBranding()` before rendering (`server/routes/pages.js`).
2. `templates/layouts/base.njk` outputs CSS variables:
   ```css
   :root {
     --primary-color: {{ brand.primaryColor }};
     --secondary-color: {{ brand.secondaryColor }};
     --accent-color: {{ brand.accentColor }};
     --nav-background-color: {{ brand.navBackgroundColor }};
     --nav-text-color: {{ brand.navTextColor }};
     --logo-text-color: {{ brand.logoTextColor }};
   }
   ```
3. CSS files (e.g., `public/css/header.css`, `public/css/footer.css`, `public/css/widgets.css`) reference those variables everywhere, so you never hardcode hex values.
4. Header/footer templates show uploaded logos if paths exist (and respect `branding.headerLogoHeight`), otherwise fall back to the site name text.
5. If a favicon is uploaded it’s injected into `<link rel="icon" …>` so browsers pick it up automatically.

## 5. Quick Tasks
| Need | Action |
|------|--------|
| Change colors | Adjust hex inputs in CMS → Save → check `/` |
| Update logos | Upload new header/footer files (PNG/JPG/WEBP/SVG) → Save |
| Adjust header logo height | Set “Logo yüksekliği” (stored as `headerLogoHeight`) and verify the header respects it |
| Add another branding-controlled color | Extend `branding` table, update form + CMS JS, inject new CSS variable in `base.njk`, and use it in CSS |

## 6. Safety Tips
- Never hardcode colors in CSS—always use variables.
- File uploads overwrite previous logos; no version history.
- If colors look unchanged, view page source and search for `<style id="branding-variables">` to confirm values updated.

## Related Docs
- `docs/README.md` – navigation guide for this folder.
- `layout-manager.md` – if you need branding-aware widgets in CMS layouts.
- `troubleshooting.md` – quick fixes for branding issues.

