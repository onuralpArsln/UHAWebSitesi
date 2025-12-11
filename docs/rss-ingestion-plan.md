# DHA RSS → Article Mapping Guide

This document captures how to translate the external DHA RSS feed into our existing SQLite-backed article schema **without modifying any server/service files**. It is derived from the analyzer output produced by `node tests/fetch_rss.js`, which now emits `tests/rss_dump.json`.

## Feed anatomy

Each `<item>` includes the following notable fields:

| RSS field | Notes |
|-----------|-------|
| `newsId` | Unique numeric identifier per story |
| `title` | Headline text (wrapped in CDATA) |
| `description` | HTML paragraphs that form the article body/summary |
| `category` | Turkish category labels (e.g., _Güvenlik_, _Spor_) |
| `link` | Canonical DHA article URL |
| `pubDate` | `YYYY-MM-DD HH:mm:ss` timestamp |
| `author`, `location`, `district` | Sometimes empty |
| `mediaList` | Nested `<media>` entries with `type="IMAGE"` or `type="VIDEO"` and absolute download URLs |

## Article field mapping

| Article field (`DataService`) | Value derived from RSS |
|-------------------------------|------------------------|
| `header` / `title`            | `item.title` (trimmed) |
| `summaryHead`                | First sentence of `description` (plain text) |
| `summary`                    | First ~300 chars of stripped `description` |
| `body` / `content`           | Full HTML from `description` (kept as-is) |
| `category`                   | `item.category`. If it does not exist in `categories`, fall back to `Genel`. |
| `tags` / `keywords`          | `[item.category]` plus `[location, district]` when present |
| `images`                     | Array of `{ url, alt }` built from `mediaList` entries with `type === 'IMAGE'`; `alt` can default to `item.title` |
| `headlineImage`              | First image in `images`, if any |
| `videoUrl`                   | First `mediaList` entry with `type === 'VIDEO'` |
| `writer` / `author`          | `item.author` (defaults to `DHA`) |
| `creationDate` / `publishedAt` | `item.pubDate` converted to ISO string |
| `source`                     | Constant `DHA RSS` |
| `outlinks`                   | `[item.link]` |
| `targettedViews`             | `['flash-news']` when category is `Flaş Haber`, otherwise empty array |
| `status`                     | `visible` |
| `relatedArticles`            | Empty array (can be enriched later) |

## Deduplication approach (no schema changes)

Because we cannot add `externalId` columns, the worker should prevent duplicates by:

1. Building a deterministic content hash such as `sha1(header + creationDate)`.
2. Querying `dataService.getArticles({ search: header, limit: 5 })` and checking for matching `creationDate` to skip existing entries.

If a duplicate is detected, the worker can optionally log and skip, or update via `dataService.updateArticle(id, payload)` when the fetched `pubDate` is newer.

## Category normalization

Create an in-memory map before inserts:

```js
const categoryMap = {
  'Flaş Haber': 'Flaş Haber',
  'Güvenlik': 'Güvenlik',
  'Spor': 'Spor',
  'Gündem': 'Gündem'
};
```

If the RSS feed emits a category not present in the map, keep the raw label and let the CMS show it as-is (it will appear under “Genel” widgets until an editor creates the category manually).

## Analyzer-driven insights

From `tests/rss_dump.json` (current snapshot):

- 15 items fetched in the last run.
- Category distribution: Flaş Haber (3), Güvenlik (4), Spor (6), Gündem (2).
- Media totals: 30 images, 11 videos.
- `mediaList` entries always provide absolute HTTPS URLs suitable for direct consumption.

Use these statistics to sanity-check incoming data before inserts (e.g., skip items without description text).

## Worker checklist

1. Run `node tests/fetch_rss.js` to refresh `dha_rss.xml` and `rss_dump.json`.
2. Load `rss_dump.json` (or fetch fresh XML) inside the worker.
3. Apply the mapping rules in this document to build article payloads.
4. Deduplicate using the hash/lookup strategy.
5. Insert via `dataService.createArticle(payload)` (letting the service assign UUIDs).
6. Log insert counts per category for visibility.

This process keeps the ingestion logic isolated while respecting the “no core code changes” constraint.

## Media policy (legal/operational)

- **Never persist or render DHA-hosted URLs.** All images/videos must be downloaded to `/uploads/media/rss` (or `/uploads/media/rss/videos`), or replaced with a local placeholder.
- **Worker enforcement:** `workers/dha-rss-worker.js` filters out any non-local media, clears `videoUrl` on download failures, and injects a placeholder image when nothing local is available.
- **Rendering enforcement:** Templates render images/videos only when the path starts with `/uploads/`; otherwise they fall back to the placeholder and skip iframes.
- **Cleanup:** Run `node scripts/strip-dha-media.js` to strip existing DHA URLs from the database and backfill placeholders.

