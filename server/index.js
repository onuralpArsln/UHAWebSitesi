const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const nunjucks = require('nunjucks');
const { spawn } = require('child_process');
// Import Helmet middleware only for HTTPS
const helmet = require('helmet');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');
const { requireAuth } = require('./middleware/auth');
// Optional: Load .env if it exists (not required - system auto-configures)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available or .env doesn't exist - that's fine
}
const config = require('./services/config');

const app = express();
const serverConfig = config.getServerConfig();
const paths = config.getPaths();
const PORT = serverConfig.port;
const BASE_PATH = serverConfig.basePath;
const workerSchedulerConfig = {
  enabled: process.env.WORKER_SCHEDULER_ENABLED !== 'false',
  rssWorker: {
    enabled: process.env.WORKER_RSS_ENABLED !== 'false',
    intervalMs: parseInt(process.env.WORKER_RSS_INTERVAL_MS || '', 10) || 4 * 60 * 1000,
    command: process.env.WORKER_RSS_CMD || `node ${path.join(__dirname, '../workers/dha-rss-worker.js')}`,
    reloadSlugs: process.env.WORKER_RSS_RELOAD_SLUGS !== 'false'
  }
};
const childProcesses = [];
const workerIntervals = [];
const activeWorkers = new Map();
let slugServiceInstance = null;

// Trust proxy for accurate protocol detection (important for reverse proxies like nginx)
// This allows req.secure and req.protocol to work correctly when behind a proxy
app.set('trust proxy', serverConfig.trustProxy);

// View engine configuration
const nunjucksEnv = nunjucks.configure(paths.templates, {
  autoescape: true,
  express: app,
  noCache: !config.isProduction()
});
app.set('views', paths.templates);
app.set('view engine', 'njk');

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short'
});
const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit'
});

nunjucksEnv.addFilter('formatDate', (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    return dateFormatter.format(date);
  } catch (error) {
    return value;
  }
});

nunjucksEnv.addFilter('formatTime', (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    return timeFormatter.format(date);
  } catch (error) {
    return value;
  }
});

nunjucksEnv.addFilter('initials', (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().charAt(0).toUpperCase();
});

nunjucksEnv.addFilter('urlencode', (value) => {
  if (!value) return '';
  try {
    return encodeURIComponent(String(value));
  } catch (error) {
    return value;
  }
});

nunjucksEnv.addGlobal('placeholder_image', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
nunjucksEnv.addGlobal('current_year', new Date().getFullYear());
nunjucksEnv.addGlobal('BASE_PATH', BASE_PATH);
nunjucksEnv.addGlobal('asset', (p) => {
  return config.getAssetPath(p);
});
// Add config service to templates for request-aware URL generation
nunjucksEnv.addGlobal('config', config);

// Security and performance middleware
// Support both HTTP and HTTPS - detect protocol per request
// This allows the server to work with or without SSL certificate

// Base CSP directives (shared for both HTTP and HTTPS)
const baseCSPDirectives = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:", "http:"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com"],
  connectSrc: ["'self'", "https://pagead2.googlesyndication.com"],
  frameSrc: ["'self'", "https://googleads.g.doubleclick.net"]
};

// Middleware to dynamically configure security headers based on request protocol
app.use((req, res, next) => {
  const isHttps = config.isHttps(req);

  if (isHttps) {
    // For HTTPS: Use Helmet with full security headers
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...baseCSPDirectives,
          upgradeInsecureRequests: []
        }
      },
      strictTransportSecurity: {
        maxAge: 15552000,
        includeSubDomains: true
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      originAgentCluster: true
    })(req, res, next);
  } else {
    // For HTTP: Set headers manually (NO Helmet to avoid defaults)
    // Build CSP header manually
    const cspParts = [];
    Object.entries(baseCSPDirectives).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        const headerKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        cspParts.push(`${headerKey} ${value.join(' ')}`);
      }
    });
    const cspHeader = cspParts.join('; ');

    // Intercept response to set headers at the very last moment
    const originalEnd = res.end;
    const originalWriteHead = res.writeHead;

    res.writeHead = function (...args) {
      // Remove any existing problematic headers first
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.removeHeader('Cross-Origin-Resource-Policy');
      res.removeHeader('Origin-Agent-Cluster');
      res.removeHeader('Strict-Transport-Security');

      // Set our clean headers
      res.setHeader('Content-Security-Policy', cspHeader);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '0');

      return originalWriteHead.apply(this, args);
    };

    res.end = function (...args) {
      // Only manipulate headers if they haven't been sent yet
      if (!res.headersSent) {
        // Remove any existing problematic headers first
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('Cross-Origin-Opener-Policy');
        res.removeHeader('Cross-Origin-Resource-Policy');
        res.removeHeader('Origin-Agent-Cluster');
        res.removeHeader('Strict-Transport-Security');

        // Set our clean headers
        res.setHeader('Content-Security-Policy', cspHeader);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '0');
      }

      return originalEnd.apply(this, args);
    };

    next();
  }
});

console.log('🌐 Server configured to support both HTTP and HTTPS');
console.log('   - HTTP requests: HTTPS security headers disabled');
console.log('   - HTTPS requests: Full security headers enabled');

if (serverConfig.enableCompression) {
  app.use(compression());
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session Configuration
const dbPath = path.join(__dirname, '../data/news.db');
const db = new Database(dbPath);

app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000 // 15min
    }
  }),
  secret: process.env.SESSION_SECRET || 'uha-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto', // Handle by express-session based on connection security
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Note: Express automatically decodes URL-encoded route parameters
// Turkish characters in URLs are handled by normalizeSlugFromUrl() in url-slug service

// Static files
// Static files
function mountStaticBoth(mountPath, dir, optionsOverride = {}) {
  const options = {
    maxAge: config.isProduction() ? '1d' : 0,
    etag: true,
    index: false, // Don't serve index files
    dotfiles: 'ignore', // Ignore dotfiles
    ...optionsOverride
  };
  // Mount static files - these will be served before any routes
  app.use(mountPath, express.static(dir, options));
  if (BASE_PATH) {
    app.use(BASE_PATH + mountPath, express.static(dir, options));
  }
}

// Mount static files - these must come BEFORE routes
mountStaticBoth('/static', paths.public);
mountStaticBoth('/css', paths.css);
mountStaticBoth('/js', paths.js);
mountStaticBoth('/uploads', paths.uploads);
// CMS assets should not be cached to ensure updates are seen immediately
mountStaticBoth('/cms', paths.cms, { maxAge: 0 });

// Direct style.css for external references (e.g., /style.css)
app.get('/style.css', (req, res) => {
  res.type('text/css');
  res.sendFile(path.join(paths.public, 'style.css'));
});
if (BASE_PATH) {
  app.get(BASE_PATH + '/style.css', (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(paths.public, 'style.css'));
  });
}

// Explicit CSS file handlers to ensure they're served
const cssFiles = ['variables.css', 'main.css', 'widgets.css'];
cssFiles.forEach(cssFile => {
  app.get(`/css/${cssFile}`, (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(paths.css, cssFile));
  });
  if (BASE_PATH) {
    app.get(`${BASE_PATH}/css/${cssFile}`, (req, res) => {
      res.type('text/css');
      res.sendFile(path.join(paths.css, cssFile));
    });
  }
});

// Routes
function mountRoutesBoth(mountPath, ...handlers) {
  app.use(mountPath, ...handlers);
  if (BASE_PATH) {
    app.use(BASE_PATH + mountPath, ...handlers);
  }
}

mountRoutesBoth('/api/auth', require('./routes/auth'));
mountRoutesBoth('/api', require('./routes/api'));
mountRoutesBoth('/cms/media', requireAuth, require('./routes/cms-media'));

// Public CMS routes (Login)
const cmsAuthRouter = express.Router();
cmsAuthRouter.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/cms');
  }
  res.render('cms/pages/login.njk', { pageTitle: 'Giriş Yap - BGrup Yazılım CMS' });
});
mountRoutesBoth('/cms', cmsAuthRouter);

// Protected CMS routes
mountRoutesBoth('/cms', requireAuth, require('./routes/cms'));
mountRoutesBoth('/', require('./routes/pages'));

function startWorker(command, label, { reloadSlugs } = {}) {
  if (!command) {
    return;
  }
  if (activeWorkers.get(label)) {
    console.log(`⏸️ Worker "${label}" is already running. Skipping new launch.`);
    return;
  }

  console.log(`🧵 Starting worker "${label}" with command: ${command}`);
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit'
  });
  childProcesses.push(child);
  activeWorkers.set(label, true);

  child.on('close', (code) => {
    console.log(`🧵 Worker "${label}" exited with code ${code}`);
    activeWorkers.set(label, false);
    const idx = childProcesses.indexOf(child);
    if (idx >= 0) {
      childProcesses.splice(idx, 1);
    }
    if (reloadSlugs && code === 0) {
      try {
        if (!slugServiceInstance) {
          slugServiceInstance = require('./services/url-slug');
        }
        if (typeof slugServiceInstance.loadSlugCache === 'function') {
          slugServiceInstance.loadSlugCache();
          console.log('🔁 Slug cache reloaded after worker run.');
        }
      } catch (error) {
        console.error('❌ Failed to reload slug cache:', error);
      }
    }
  });
}

function setupWorkerScheduler() {
  if (!workerSchedulerConfig.enabled) {
    console.log('🛑 Worker scheduler disabled.');
    return;
  }

  if (workerSchedulerConfig.rssWorker.enabled) {
    const { command, intervalMs, reloadSlugs } = workerSchedulerConfig.rssWorker;

    // Immediate run after startup
    startWorker(command, 'rss-worker', { reloadSlugs });

    const intervalId = setInterval(() => {
      startWorker(command, 'rss-worker', { reloadSlugs });
    }, intervalMs);

    workerIntervals.push(intervalId);
    console.log(`⏱️ RSS worker scheduled every ${intervalMs / 1000}s.`);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sayfa Bulunamadı</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #e53e3e; }
        a { color: #3182ce; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Sayfa Bulunamadı</h1>
      <p>Aradığınız sayfa mevcut değil.</p>
      <a href="${BASE_PATH || ''}/">Ana Sayfaya Dön</a>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 UHA News Server running on port ${PORT}`);
  console.log(`📰 Environment: ${config.getNodeEnv()}`);
  console.log(`🌐 Auto-configuring: Protocol and URLs detected from requests`);
  console.log(`   - Base Path: ${BASE_PATH || '(root)'}`);
  console.log(`   - Frontend: http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`   - CMS: http://localhost:${PORT}${BASE_PATH}/cms`);

  setupWorkerScheduler();
});

module.exports = app;

function shutdownScheduler() {
  workerIntervals.forEach((intervalId) => clearInterval(intervalId));
  workerIntervals.length = 0;

  childProcesses.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
}

process.on('SIGINT', () => {
  console.log('🔻 SIGINT received, shutting down worker scheduler...');
  shutdownScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔻 SIGTERM received, shutting down worker scheduler...');
  shutdownScheduler();
  process.exit(0);
});
