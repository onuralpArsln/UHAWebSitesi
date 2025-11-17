#!/usr/bin/env node

/**
 * Deployment script for UHA News Server
 * - Kills processes on port 3000
 * - Checks CSS files exist
 * - Starts the server
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PROJECT_DIR = path.join(__dirname, '..');
const CSS_DIR = path.join(PROJECT_DIR, 'public/css');
const REQUIRED_CSS = ['variables.css', 'main.css', 'widgets.css'];

console.log('🚀 Starting deployment process...\n');

// Step 1: Kill processes on port 3000
function killProcessOnPort(port) {
  try {
    console.log(`📌 Checking for processes on port ${port}...`);
    
    // Try different methods to find and kill processes
    const methods = [
      // Linux/Unix: lsof
      `lsof -ti:${port}`,
      // Alternative: fuser (if lsof not available)
      `fuser ${port}/tcp 2>/dev/null`,
      // Using netstat and kill
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
                // Process might already be dead
              }
            });
            killed = true;
            break;
          }
        }
      } catch (err) {
        // Method not available or no process found, try next
        continue;
      }
    }

    if (!killed) {
      console.log(`✅ Port ${port} is already free`);
    } else {
      console.log(`✅ Port ${port} is now free\n`);
      // Wait a moment for port to be released
      setTimeout(() => {}, 1000);
    }
  } catch (error) {
    console.log(`⚠️  Could not check/kill processes on port ${port}: ${error.message}`);
    console.log('   Continuing anyway...\n');
  }
}

// Step 2: Check CSS files
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

// Step 3: Check .env file
function checkEnvFile() {
  const envPath = path.join(PROJECT_DIR, '.env');
  const envExamplePath = path.join(PROJECT_DIR, 'env.example');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  Warning: .env file not found');
    if (fs.existsSync(envExamplePath)) {
      console.log('   You can copy env.example to .env and configure it:');
      console.log('   cp env.example .env\n');
    }
  } else {
    console.log('✅ .env file found\n');
  }
}

// Step 4: Start the server
function startServer() {
  console.log(`🚀 Starting server on port ${PORT}...`);
  console.log(`📁 Project directory: ${PROJECT_DIR}\n`);
  
  const serverPath = path.join(PROJECT_DIR, 'server/index.js');
  
  // Set NODE_ENV if not set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Start the server
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

  // Handle termination signals
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

// Run deployment steps
try {
  killProcessOnPort(PORT);
  const cssOk = checkCSSFiles();
  checkEnvFile();
  
  if (!cssOk) {
    console.log('⚠️  Starting server despite CSS issues...\n');
  }
  
  startServer();
} catch (error) {
  console.error(`❌ Deployment failed: ${error.message}`);
  process.exit(1);
}

