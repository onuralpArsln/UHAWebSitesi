#!/usr/bin/env node

/**
 * Fresh deployment script for UHA News Server
 * - Kills processes on port 3000
 * - Wipes all articles from the database
 * - Clears RSS media (images & videos) and slug cache
 * - Checks CSS files
 * - Starts the server (same as deploy)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const DataService = require('../server/services/data-service');
const urlSlugService = require('../server/services/url-slug');

const PORT = process.env.PORT || 3000;
const PROJECT_DIR = path.join(__dirname, '..');
const CSS_DIR = path.join(PROJECT_DIR, 'public/css');
const REQUIRED_CSS = ['variables.css', 'main.css', 'widgets.css'];
const RSS_MEDIA_DIR = path.join(PROJECT_DIR, 'public/uploads/media/rss');
const RSS_VIDEO_DIR = path.join(RSS_MEDIA_DIR, 'videos');
const SLUG_CACHE = path.join(PROJECT_DIR, 'server/cache/slug-cache.json');

function killProjectProcesses() {
  console.log('🧹 Ensuring no other project node processes are running...');
  try {
    if (process.platform === 'win32') {
      const cmd = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*server\\\\index.js*\' -or $_.CommandLine -like \'*workers\\\\dha-rss-worker.js*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"';
      execSync(cmd, { stdio: 'pipe' });
    } else {
      // Best effort on Unix-like systems
      execSync('pkill -f "server/index.js"', { stdio: 'pipe' });
      execSync('pkill -f "workers/dha-rss-worker.js"', { stdio: 'pipe' });
    }
    console.log('   ✅ Other project node processes stopped');
  } catch (error) {
    console.log('   ⚠️  Could not stop other processes (might be none running):', error.message);
  }
}

console.log('🧹 Starting fresh deploy (cleanup + start)...\n');

function killProcessOnPort(port) {
  try {
    console.log(`📌 Checking for processes on port ${port}...`);

    const methods = [
      `lsof -ti:${port}`,
      `fuser ${port}/tcp 2>/dev/null`,
      `netstat -tlnp 2>/dev/null | grep :${port} | awk '{print $7}' | cut -d'/' -f1`
    ];

    let killed = false;

    for (const method of methods) {
      try {
        const result = execSync(method, { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (result) {
          const pids = result.split('\n').filter(pid => pid && !isNaN(pid));
          if (pids.length > 0) {
            console.log(`⚠️  Found ${pids.length} process(es) using port ${port}, killing them...`);
            pids.forEach(pid => {
              try {
                execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
                console.log(`   ✅ Killed process ${pid}`);
              } catch (err) {
                // ignore
              }
            });
            killed = true;
            break;
          }
        }
      } catch (err) {
        continue;
      }
    }

    if (!killed) {
      console.log(`✅ Port ${port} is already free`);
    } else {
      console.log(`✅ Port ${port} is now free\n`);
      setTimeout(() => {}, 1000);
    }
  } catch (error) {
    console.log(`⚠️  Could not check/kill processes on port ${port}: ${error.message}`);
    console.log('   Continuing anyway...\n');
  }
}

function checkCSSFiles() {
  console.log('🎨 Checking CSS files...');
  const missing = [];
  const found = [];

  REQUIRED_CSS.forEach(cssFile => {
    const filePath = path.join(CSS_DIR, cssFile);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && stats.size > 0) {
        found.push(cssFile);
        console.log(`   ✅ Found CSS file: ${cssFile} (${(stats.size / 1024).toFixed(2)} KB)`);
      } else {
        missing.push(cssFile);
        console.log(`   ❌ CSS file exists but is empty: ${cssFile}`);
      }
    } else {
      missing.push(cssFile);
      console.log(`   ❌ Missing CSS file: ${cssFile}`);
    }
  });

  if (missing.length > 0) {
    console.log(`\n⚠️  Warning: ${missing.length} CSS file(s) are missing or empty:`);
    missing.forEach(file => console.log(`   - ${file}`));
    console.log('   The server will start, but styles may not load correctly.\n');
    return false;
  } else {
    console.log(`\n✅ All required CSS files are present and valid\n`);
    return true;
  }
}

function cleanupDatabaseAndMedia() {
  console.log('🧽 Cleaning database articles and RSS media...');
  const dataService = new DataService();
  try {
    dataService.db.exec('DELETE FROM articles');
    dataService.db.exec('UPDATE categories SET articleCount = 0');
    console.log('   ✅ Articles cleared, category counts reset');
  } catch (error) {
    console.error(`   ❌ Failed to clear articles: ${error.message}`);
  } finally {
    dataService.close();
  }

  // Clear slug cache
  try {
    if (fs.existsSync(SLUG_CACHE)) {
      fs.unlinkSync(SLUG_CACHE);
      console.log('   ✅ Slug cache cleared');
    }
    if (typeof urlSlugService?.loadSlugCache === 'function') {
      urlSlugService.loadSlugCache();
    }
  } catch (error) {
    console.error(`   ⚠️ Failed to clear slug cache: ${error.message}`);
  }

  // Clear RSS media directories
  [RSS_VIDEO_DIR, RSS_MEDIA_DIR].forEach((dir) => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Reset media directory: ${dir}`);
    } catch (error) {
      console.error(`   ⚠️ Failed to reset media dir ${dir}: ${error.message}`);
    }
  });
}

function checkConfiguration() {
  console.log('✅ Configuration check (auto-detecting)...');
  const envPath = path.join(PROJECT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    console.log('   ℹ️  .env file found (optional - system auto-configures)');
  } else {
    console.log('   ✅ No .env file needed - system auto-configures from runtime');
  }

  console.log('   🌐 Auto-configuration enabled:');
  console.log('      - Port: Auto-detected from PORT env or defaults to 3000');
  console.log('      - Protocol: Auto-detected per request (HTTP/HTTPS)');
  console.log('      - Site URL: Auto-detected from request headers');
  console.log('      - Base Path: Auto-detected from BASE_PATH env or empty');
  console.log('      - File paths: Auto-detected from project structure');
  console.log('   ✅ Server supports both HTTP and HTTPS automatically');
  console.log('   ✅ Works on any server without configuration files\n');
}

function startServer() {
  console.log(`🚀 Starting server on port ${PORT}...`);
  console.log(`📁 Project directory: ${PROJECT_DIR}`);
  console.log(`🌐 Auto-configuring system:`);
  console.log(`   - Protocol: Detected per request (HTTP/HTTPS)`);
  console.log(`   - URLs: Auto-detected from request headers`);
  console.log(`   - Paths: Auto-detected from project structure`);
  console.log(`   - No .env file required - fully self-configuring\n`);

  const serverPath = path.join(PROJECT_DIR, 'server/index.js');

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  const server = spawn('node', [serverPath], {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
    env: process.env
  });

  server.on('error', (error) => {
    console.error(`❌ Error starting server: ${error.message}`);
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Server exited with code ${code}`);
      process.exit(code);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    server.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down server...');
    server.kill('SIGTERM');
    process.exit(0);
  });
}

// Run steps
try {
  killProjectProcesses();
  killProcessOnPort(PORT);
  cleanupDatabaseAndMedia();
  const cssOk = checkCSSFiles();
  checkConfiguration();

  if (!cssOk) {
    console.log('⚠️  Starting server despite CSS issues...\n');
  }

  startServer();
} catch (error) {
  console.error(`❌ Fresh deployment failed: ${error.message}`);
  process.exit(1);
}


