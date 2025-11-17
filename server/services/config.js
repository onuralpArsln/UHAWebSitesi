/**
 * Self-Configuring Configuration Service
 * Auto-detects all settings from runtime environment, file structure, and requests
 * No .env files or hardcoded values required
 */

const path = require('path');
const os = require('os');

class ConfigService {
  constructor() {
    // Project root directory (assumes this file is in server/services/)
    this.projectRoot = path.join(__dirname, '../..');
    
    // Auto-detect paths
    this.paths = {
      projectRoot: this.projectRoot,
      server: path.join(this.projectRoot, 'server'),
      templates: path.join(this.projectRoot, 'templates'),
      public: path.join(this.projectRoot, 'public'),
      data: path.join(this.projectRoot, 'data'),
      css: path.join(this.projectRoot, 'public/css'),
      js: path.join(this.projectRoot, 'public/js'),
      uploads: path.join(this.projectRoot, 'public/uploads'),
      branding: path.join(this.projectRoot, 'public/uploads/branding'),
      media: path.join(this.projectRoot, 'public/uploads/media'),
      cms: path.join(this.projectRoot, 'public/cms')
    };

    // Server configuration (static, doesn't change per request)
    this.server = {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      basePath: this.normalizeBasePath(process.env.BASE_PATH || ''),
      enableCompression: process.env.ENABLE_COMPRESSION === 'true' || process.env.NODE_ENV === 'production',
      trustProxy: true // Always trust proxy for accurate protocol detection
    };

    // Site defaults (can be overridden per request)
    this.site = {
      name: process.env.SITE_NAME || 'UHA News',
      description: process.env.SITE_DESCRIPTION || 'Son dakika haberleri ve güncel gelişmeler',
      // Site URL will be detected per request
    };

    // Optional features
    this.features = {
      adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
      adsenseSlotId: process.env.ADSENSE_SLOT_ID || ''
    };

    // Cache for request-based configs
    this.requestCache = new Map();
  }

  /**
   * Normalize base path
   */
  normalizeBasePath(rawPath) {
    if (!rawPath) return '';
    const cleaned = rawPath.replace(/^\/+|\/+$/g, '');
    return cleaned ? '/' + cleaned : '';
  }

  /**
   * Get static server configuration
   */
  getServerConfig() {
    return { ...this.server };
  }

  /**
   * Get site defaults
   */
  getSiteDefaults() {
    return { ...this.site };
  }

  /**
   * Get feature flags
   */
  getFeatures() {
    return { ...this.features };
  }

  /**
   * Get all paths
   */
  getPaths() {
    return { ...this.paths };
  }

  /**
   * Get site URL from request (auto-detected)
   * Supports reverse proxies via X-Forwarded-* headers
   */
  getSiteUrl(req) {
    if (!req) {
      // Fallback for non-request contexts
      return `http://localhost:${this.server.port}`;
    }

    // Check cache first (keyed by host)
    const host = req.get('host') || req.headers.host || 'localhost';
    const cacheKey = `${host}-${req.protocol}`;
    
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey);
    }

    // Detect protocol
    let protocol = 'http';
    if (req.secure) {
      protocol = 'https';
    } else if (req.headers['x-forwarded-proto']) {
      protocol = req.headers['x-forwarded-proto'].split(',')[0].trim();
    } else if (req.protocol) {
      protocol = req.protocol;
    }

    // Detect host
    let hostname = host;
    if (req.headers['x-forwarded-host']) {
      hostname = req.headers['x-forwarded-host'].split(',')[0].trim();
    } else if (req.get('host')) {
      hostname = req.get('host');
    }

    // Build URL
    const siteUrl = `${protocol}://${hostname}`;
    
    // Cache for this host/protocol combination
    this.requestCache.set(cacheKey, siteUrl);
    
    return siteUrl;
  }

  /**
   * Get base path (static, from config)
   */
  getBasePath() {
    return this.server.basePath;
  }

  /**
   * Get full URL for a path (request-aware)
   */
  getUrl(req, path = '') {
    const siteUrl = this.getSiteUrl(req);
    const basePath = this.getBasePath();
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${siteUrl}${basePath}${cleanPath}`;
  }

  /**
   * Get asset path (for templates)
   */
  getAssetPath(assetPath) {
    const basePath = this.getBasePath();
    const clean = assetPath.startsWith('/') ? assetPath : '/' + assetPath;
    return basePath + clean;
  }

  /**
   * Check if request is HTTPS
   */
  isHttps(req) {
    if (!req) return false;
    
    if (req.secure) return true;
    if (req.headers['x-forwarded-proto'] === 'https') return true;
    if (req.protocol === 'https') return true;
    
    return false;
  }

  /**
   * Get NODE_ENV
   */
  getNodeEnv() {
    return this.server.nodeEnv;
  }

  /**
   * Check if production mode
   */
  isProduction() {
    return this.server.nodeEnv === 'production';
  }

  /**
   * Get port
   */
  getPort() {
    return this.server.port;
  }

  /**
   * Clear request cache (useful for testing or long-running processes)
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * Get all configuration as object (for debugging)
   */
  getAllConfig(req = null) {
    return {
      server: this.getServerConfig(),
      site: this.getSiteDefaults(),
      features: this.getFeatures(),
      paths: this.getPaths(),
      siteUrl: req ? this.getSiteUrl(req) : null,
      basePath: this.getBasePath(),
      isHttps: req ? this.isHttps(req) : false,
      nodeEnv: this.getNodeEnv(),
      isProduction: this.isProduction()
    };
  }
}

// Export singleton instance
module.exports = new ConfigService();

