const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const nunjucks = require('nunjucks');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const rawBasePath = process.env.BASE_PATH || '';
const BASE_PATH = ('/' + rawBasePath.replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');

// View engine configuration
const templatesPath = path.join(__dirname, '../templates');
const nunjucksEnv = nunjucks.configure(templatesPath, {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production'
});
app.set('views', templatesPath);
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

nunjucksEnv.addGlobal('placeholder_image', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
nunjucksEnv.addGlobal('current_year', new Date().getFullYear());
nunjucksEnv.addGlobal('BASE_PATH', BASE_PATH);
nunjucksEnv.addGlobal('asset', (p) => {
  const s = String(p || '');
  const clean = s.startsWith('/') ? s : '/' + s;
  return (BASE_PATH || '') + clean;
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com"],
      connectSrc: ["'self'", "https://pagead2.googlesyndication.com"],
      frameSrc: ["'self'", "https://googleads.g.doubleclick.net"]
    }
  }
}));

if (process.env.ENABLE_COMPRESSION === 'true') {
  app.use(compression());
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Note: Express automatically decodes URL-encoded route parameters
// Turkish characters in URLs are handled by normalizeSlugFromUrl() in url-slug service

// Static files
function mountStaticBoth(mountPath, dir) {
  const options = {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    index: false, // Don't serve index files
    dotfiles: 'ignore' // Ignore dotfiles
  };
  // Mount static files - these will be served before any routes
  app.use(mountPath, express.static(dir, options));
  if (BASE_PATH) {
    app.use(BASE_PATH + mountPath, express.static(dir, options));
  }
}

// Mount static files - these must come BEFORE routes
mountStaticBoth('/static', path.join(__dirname, '../public'));
mountStaticBoth('/css', path.join(__dirname, '../public/css'));
mountStaticBoth('/js', path.join(__dirname, '../public/js'));
mountStaticBoth('/uploads', path.join(__dirname, '../public/uploads'));
mountStaticBoth('/cms', path.join(__dirname, '../public/cms'));

// Direct style.css for external references (e.g., /style.css)
app.get('/style.css', (req, res) => {
  res.type('text/css');
  res.sendFile(path.join(__dirname, '../public/style.css'));
});
if (BASE_PATH) {
  app.get(BASE_PATH + '/style.css', (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, '../public/style.css'));
  });
}

// Explicit CSS file handlers to ensure they're served
const cssFiles = ['variables.css', 'main.css', 'widgets.css'];
cssFiles.forEach(cssFile => {
  app.get(`/css/${cssFile}`, (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, '../public/css', cssFile));
  });
  if (BASE_PATH) {
    app.get(`${BASE_PATH}/css/${cssFile}`, (req, res) => {
      res.type('text/css');
      res.sendFile(path.join(__dirname, '../public/css', cssFile));
    });
  }
});

// Routes
function mountRoutesBoth(mountPath, router) {
  app.use(mountPath, router);
  if (BASE_PATH) {
    app.use(BASE_PATH + mountPath, router);
  }
}

mountRoutesBoth('/api', require('./routes/api'));
mountRoutesBoth('/cms/media', require('./routes/cms-media'));
mountRoutesBoth('/cms', require('./routes/cms'));
mountRoutesBoth('/', require('./routes/pages'));

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
  console.log(`📰 Environment: ${process.env.NODE_ENV}`);
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`🌐 Frontend: ${baseUrl}/`);
  console.log(`🛠️ CMS: ${baseUrl}/cms`);
});

module.exports = app;
