# DHA RSS Worker – Runbook

Use this guide to refresh the feed snapshot, ingest articles, and verify results without touching the running Express server.

## 1. Refresh feed artifacts

```powershell
cd E:\Projeler\UHAWebSitesi
node tests\fetch_rss.js
```

This command:

- Downloads the latest RSS XML into `tests/dha_rss.xml`.
- Generates `tests/rss_dump.json` with per-item summaries (counts, categories, media stats).

Review `rss_dump.json` if you need to inspect raw values before importing.

## 2. Run the worker (dry run)

```powershell
node workers\dha-rss-worker.js --dry-run --limit 5
```

- Parses the live RSS feed using the mapping rules documented in `docs/rss-ingestion-plan.md`.
- Prints each candidate article and highlights whether it would be inserted.
- Use `--limit` to constrain processing for spot checks.

## 3. Run the worker (live inserts)

Remove `--dry-run` to perform actual DB inserts:

```powershell
node workers\dha-rss-worker.js --limit 10
```

Optional flags:

| Flag | Description |
|------|-------------|
| `--feed <url>` | Override the default DHA feed URL |
| `--log <path>` | Append logs to a file (timestamps included) |
| `--limit <n>` | Process only the first `n` items |
| `--dry-run` | Force dry-run mode even if `RSS_DEFAULT_DRYRUN` is false |

## 4. Verify new content

1. **SQLite check** – Open the DB and list the latest headers:
   ```powershell
   sqlite3 data/news.db "SELECT header, creationDate FROM articles ORDER BY creationDate DESC LIMIT 5;"
   ```
2. **RSS endpoint** – Start the server (if not already) and hit:
   ```
   http://localhost:3000/rss.xml
   ```
   Confirm the new articles appear near the top of the feed.

3. **CMS dashboard** – Log into `/cms`, filter by category, and ensure the imported stories display correctly (images, summaries, timestamps).

## 5. Common troubleshooting tips

- If the worker reports “duplicate”, it found an article with the same title/creation date; this is expected when running multiple times per hour.
- Network hiccups: rerun `node tests\fetch_rss.js` to confirm connectivity before re-running the worker.
- To increase logging, pass `--log logs/dha-worker.log`; the file will be created automatically.
- To tweak writer name, media limits, fallback category, banned topics, or download limits, edit the `SETTINGS` object at the top of `workers/dha-rss-worker.js` and redeploy.

## 6. Automatic scheduler (optional)

`server/index.js` can run the RSS worker automatically:

| Env var | Description | Default |
|---------|-------------|---------|
| `WORKER_SCHEDULER_ENABLED` | Master toggle for scheduler | `true` |
| `WORKER_RSS_ENABLED` | Enable/disable RSS worker job | `true` |
| `WORKER_RSS_INTERVAL_MS` | Interval between runs (ms) | `240000` (4 min) |
| `WORKER_RSS_CMD` | Command executed for the worker | `node workers/dha-rss-worker.js` |
| `WORKER_RSS_RELOAD_SLUGS` | Reload slug cache after each successful run | `true` |

Behavior:
- When the server boots, the RSS worker runs once immediately (if enabled).
- Subsequent runs occur every `WORKER_RSS_INTERVAL_MS`.
- Logs appear in the main server output, and the scheduler skips runs if the previous instance is still running.

### Adding additional scheduled workers

The scheduler is intentionally small; to register another job:

1. Extend the `workerSchedulerConfig` object inside `server/index.js` with a new block (e.g., `someWorker: { enabled, intervalMs, command, reloadSlugs }`).
2. Update `setupWorkerScheduler()` to call `startWorker()` for the new config (mirroring the RSS block: immediate run + `setInterval`).
3. Provide environment variables (e.g., `WORKER_SOME_ENABLED`, `WORKER_SOME_CMD`, `WORKER_SOME_INTERVAL_MS`) so ops can control it without code changes.

All workers share the same guardrails—only one instance per label runs at a time, and logs are piped to the main process.

Following these steps keeps ingestion self-contained and reversible without needing any server restarts or schema changes.

