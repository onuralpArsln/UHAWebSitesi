const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const nunjucks = require('nunjucks');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

nunjucksEnv.addFilter('formatDate', (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    return dateFormatter.format(date);
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

// Static files
app.use('/static', express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Direct CSS and JS serving
app.use('/css', express.static(path.join(__dirname, '../public/css'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

app.use('/js', express.static(path.join(__dirname, '../public/js'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

app.use('/cms', express.static(path.join(__dirname, '../public/cms'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Routes
app.use('/api', require('./routes/api'));
app.use('/cms', require('./routes/cms'));
app.use('/', require('./routes/pages'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`🚀 UHA News Server running on port ${PORT}`);
  console.log(`📰 Environment: ${process.env.NODE_ENV}`);
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`🌐 Frontend: ${baseUrl}/`);
  console.log(`🛠️ CMS: ${baseUrl}/cms`);
});

module.exports = app;
