# Worker Scheduler Reference

This document explains how the automatic worker runner inside `server/index.js` is configured, how the RSS worker hooks into it, and how to add additional jobs.

## Overview

- The main Express process (`server/index.js`) now includes a lightweight scheduler.
- When enabled, the scheduler:
  1. Runs the RSS worker immediately after the server starts listening.
  2. Re-runs it every 4 minutes (default) using `setInterval`.
  3. Logs worker output to the main console.
  4. Reloads the slug cache after successful runs so new articles are reachable without restarting.
- Only one instance per worker label runs at a time; if a previous run is still active, the next interval is skipped.

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_SCHEDULER_ENABLED` | `true` | Master toggle for the scheduler. Set `false` to disable all jobs. |
| `WORKER_RSS_ENABLED` | `true` | Toggle the RSS worker job. |
| `WORKER_RSS_CMD` | `node workers/dha-rss-worker.js` | Command the scheduler executes. |
| `WORKER_RSS_INTERVAL_MS` | `240000` (4 minutes) | Interval between runs. |
| `WORKER_RSS_RELOAD_SLUGS` | `true` | If `true`, reloads the slug cache (`urlSlugService.loadSlugCache()`) after each successful run. |

> If you prefer not to use env vars, update the `workerSchedulerConfig` object inside `server/index.js` directly.

## How RSS worker integrates

1. **Immediate run on boot** – once Express starts listening, `setupWorkerScheduler()` triggers the RSS worker. This keeps the site populated even after server restarts.
2. **Recurring runs** – `setInterval` uses the configured interval for subsequent executions.
3. **Slug reload** – after the worker exits with code 0, the scheduler requires the slug service singleton and calls `loadSlugCache()` so newly inserted articles are accessible via `/haber/:slug` immediately.
4. **Graceful cleanup** – `SIGINT`/`SIGTERM` handlers clear the interval and terminate any running worker before the server shuts down.

## Adding new workers

To schedule additional jobs:

1. Edit `server/index.js`:
   ```js
   const workerSchedulerConfig = {
     ...,
     someOtherWorker: {
       enabled: process.env.WORKER_OTHER_ENABLED !== 'false',
       intervalMs: parseInt(process.env.WORKER_OTHER_INTERVAL_MS || '', 10) || 5 * 60 * 1000,
       command: process.env.WORKER_OTHER_CMD || `node workers/another-worker.js`,
       reloadSlugs: false
     }
   };
   ```
2. In `setupWorkerScheduler()`, replicate the existing RSS block for your new worker (immediate run + `setInterval`).
3. Add env vars (if desired) so the job can be toggled or tuned without code changes.

The helper `startWorker(command, label, { reloadSlugs })` already handles logging, overlap prevention, and optional slug reload, so most jobs will only need a new config block.

## Monitoring & troubleshooting

- Scheduler logs appear in the same console as the Express server. Look for `🧵` (start and exit) and `⏱️` messages.
- If a worker fails, the exit code is logged; you can inspect `workers/<worker>.js` for details.
- To temporarily disable the RSS job while leaving the scheduler infrastructure enabled, set `WORKER_RSS_ENABLED=false` (or remove the block).

