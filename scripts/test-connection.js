#!/usr/bin/env node

/**
 * HTTP Connection Test Script
 * Tests HTTP connection to http://72.61.200.216:3000/ with comprehensive error handling
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const TARGET_URL = process.argv[2] || 'http://72.61.200.216:3000/';
const TIMEOUT = parseInt(process.env.TIMEOUT || '10000', 10); // 10 seconds default

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Get human-readable error message based on error code
 */
function getErrorMessage(error) {
  const errorCode = error.code || error.errno;
  
  const errorMessages = {
    'ECONNREFUSED': 'Connection refused - The server is not running or not accepting connections',
    'ETIMEDOUT': 'Connection timeout - The server did not respond in time',
    'ENOTFOUND': 'DNS resolution failed - Could not resolve the hostname',
    'ECONNRESET': 'Connection reset - The server closed the connection unexpectedly',
    'EHOSTUNREACH': 'Host unreachable - The network cannot reach the host',
    'ENETUNREACH': 'Network unreachable - No network connection available',
    'EAI_AGAIN': 'DNS lookup failed - Temporary DNS resolution failure',
    'EPIPE': 'Broken pipe - Connection was closed before request completed',
    'ECANCELED': 'Request canceled - The request was canceled',
  };

  return errorMessages[errorCode] || `Unknown error: ${error.message || error}`;
}

/**
 * Extract CSS references from HTML
 */
function extractCSSReferences(html, baseUrl) {
  const cssLinks = [];
  const inlineStyles = [];
  
  // Extract <link rel="stylesheet"> tags
  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const linkMatches = html.match(linkRegex) || [];
  
  linkMatches.forEach(linkTag => {
    const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      let cssUrl = hrefMatch[1];
      // Resolve relative URLs
      if (cssUrl.startsWith('/')) {
        try {
          const base = new URL(baseUrl);
          cssUrl = `${base.protocol}//${base.host}${cssUrl}`;
        } catch (e) {
          // Keep as is if URL parsing fails
        }
      } else if (!cssUrl.startsWith('http')) {
        try {
          const base = new URL(baseUrl);
          cssUrl = new URL(cssUrl, baseUrl).href;
        } catch (e) {
          // Keep as is if URL parsing fails
        }
      }
      cssLinks.push(cssUrl);
    }
  });
  
  // Extract <style> tags (inline CSS)
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styleMatches = html.match(styleRegex) || [];
  inlineStyles.push(...styleMatches.map(match => {
    const contentMatch = match.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    return contentMatch ? contentMatch[1].trim() : '';
  }).filter(content => content.length > 0));
  
  return { cssLinks, inlineStyles };
}

/**
 * Test if a CSS file is accessible
 */
function testCSSFile(cssUrl) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(cssUrl);
    } catch (error) {
      resolve({ accessible: false, error: 'Invalid URL' });
      return;
    }

    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'HEAD', // Use HEAD to check if file exists without downloading
      timeout: 5000,
    };

    const req = httpModule.request(options, (res) => {
      resolve({
        accessible: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode,
        contentType: res.headers['content-type'] || '',
      });
    });

    req.on('error', () => {
      resolve({ accessible: false, error: 'Connection failed' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ accessible: false, error: 'Timeout' });
    });

    req.end();
  });
}

/**
 * Test HTTP connection
 */
function testConnection(urlString) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      reject({ type: 'INVALID_URL', error: `Invalid URL: ${error.message}` });
      return;
    }

    // Determine protocol
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Request options
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'UHA-Connection-Test/1.0',
        'Accept': '*/*',
        'Connection': 'close',
      },
    };

    logInfo(`Testing connection to: ${urlString}`);
    logInfo(`Host: ${options.hostname}:${options.port}`);
    logInfo(`Path: ${options.path}`);
    logInfo(`Timeout: ${TIMEOUT}ms`);
    logInfo(`Protocol: ${url.protocol}`);
    console.log('');

    const startTime = Date.now();
    let responseTime = 0;
    let responseData = '';
    let statusCode = null;
    let headers = null;

    // Create request
    const req = httpModule.request(options, (res) => {
      statusCode = res.statusCode;
      headers = res.headers;
      responseTime = Date.now() - startTime;

      logInfo(`Response received: ${statusCode} ${res.statusMessage}`);
      logInfo(`Response time: ${responseTime}ms`);

      // Collect response data
      res.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      res.on('end', () => {
        const responseSize = Buffer.byteLength(responseData, 'utf8');
        
        if (statusCode >= 200 && statusCode < 300) {
          logSuccess(`Request successful!`);
          logInfo(`Status Code: ${statusCode}`);
          logInfo(`Response Time: ${responseTime}ms`);
          logInfo(`Response Size: ${(responseSize / 1024).toFixed(2)} KB`);
          logInfo(`Content-Type: ${headers['content-type'] || 'unknown'}`);
          
          resolve({
            success: true,
            statusCode,
            responseTime,
            responseSize,
            headers,
            dataLength: responseData.length,
            responseData: responseData,
            url: urlString,
          });
        } else if (statusCode >= 400 && statusCode < 500) {
          logError(`HTTP Client Error: ${statusCode} ${res.statusMessage}`);
          logWarning(`The server responded but with an error status code`);
          reject({
            type: 'HTTP_ERROR',
            statusCode,
            statusMessage: res.statusMessage,
            responseTime,
            responseSize: Buffer.byteLength(responseData, 'utf8'),
            headers,
          });
        } else if (statusCode >= 500) {
          logError(`HTTP Server Error: ${statusCode} ${res.statusMessage}`);
          logWarning(`The server encountered an internal error`);
          reject({
            type: 'HTTP_ERROR',
            statusCode,
            statusMessage: res.statusMessage,
            responseTime,
            responseSize: Buffer.byteLength(responseData, 'utf8'),
            headers,
          });
        } else {
          logWarning(`Unexpected status code: ${statusCode}`);
          resolve({
            success: true,
            statusCode,
            responseTime,
            responseSize,
            headers,
            dataLength: responseData.length,
          });
        }
      });
    });

    // Handle request errors
    req.on('error', (error) => {
      responseTime = Date.now() - startTime;
      const errorCode = error.code || error.errno;
      
      logError(`Request failed: ${error.message}`);
      logError(`Error Code: ${errorCode || 'UNKNOWN'}`);
      logError(`Error Details: ${getErrorMessage(error)}`);
      logInfo(`Failed after: ${responseTime}ms`);

      reject({
        type: 'NETWORK_ERROR',
        error: error,
        errorCode,
        errorMessage: error.message,
        errorDescription: getErrorMessage(error),
        responseTime,
      });
    });

    // Handle timeout
    req.on('timeout', () => {
      responseTime = Date.now() - startTime;
      req.destroy();
      logError(`Request timeout after ${TIMEOUT}ms`);
      logError(`The server did not respond within the timeout period`);
      
      reject({
        type: 'TIMEOUT',
        timeout: TIMEOUT,
        responseTime,
      });
    });

    // Handle socket errors
    req.on('socket', (socket) => {
      socket.on('error', (error) => {
        responseTime = Date.now() - startTime;
        const errorCode = error.code || error.errno;
        
        logError(`Socket error: ${error.message}`);
        logError(`Error Code: ${errorCode || 'UNKNOWN'}`);
        logError(`Error Details: ${getErrorMessage(error)}`);
        
        reject({
          type: 'NETWORK_ERROR',
          error: error,
          errorCode,
          errorMessage: error.message,
          errorDescription: getErrorMessage(error),
          responseTime,
        });
      });
    });

    // Send request
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('');
  log('═══════════════════════════════════════════════════════════', 'blue');
  log('  HTTP Connection Test Script', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');
  console.log('');

  try {
    const result = await testConnection(TARGET_URL);
    
    // Analyze CSS if HTML response
    if (result.headers['content-type'] && result.headers['content-type'].includes('text/html') && result.responseData) {
      console.log('');
      log('📄 Analyzing CSS References...', 'blue');
      
      const cssInfo = extractCSSReferences(result.responseData, result.url);
      
      if (cssInfo.cssLinks.length > 0) {
        logInfo(`Found ${cssInfo.cssLinks.length} CSS file(s):`);
        cssInfo.cssLinks.forEach((cssUrl, index) => {
          logInfo(`  ${index + 1}. ${cssUrl}`);
        });
        
        // Test CSS file accessibility
        console.log('');
        logInfo('Testing CSS file accessibility...');
        const cssTests = await Promise.all(cssInfo.cssLinks.map(cssUrl => testCSSFile(cssUrl)));
        
        cssInfo.cssLinks.forEach((cssUrl, index) => {
          const test = cssTests[index];
          if (test.accessible) {
            logSuccess(`  ✅ ${cssUrl} - Accessible (${test.statusCode})`);
            if (test.contentType) {
              logInfo(`     Content-Type: ${test.contentType}`);
            }
          } else {
            logError(`  ❌ ${cssUrl} - Not accessible`);
            if (test.error) {
              logWarning(`     Error: ${test.error}`);
            } else if (test.statusCode) {
              logWarning(`     Status: ${test.statusCode}`);
            }
          }
        });
      } else {
        logWarning('No external CSS files found in HTML');
      }
      
      if (cssInfo.inlineStyles.length > 0) {
        logInfo(`Found ${cssInfo.inlineStyles.length} inline <style> block(s)`);
        cssInfo.inlineStyles.forEach((style, index) => {
          const size = Buffer.byteLength(style, 'utf8');
          logInfo(`  ${index + 1}. Inline CSS (${(size / 1024).toFixed(2)} KB)`);
        });
      }
      
      if (cssInfo.cssLinks.length === 0 && cssInfo.inlineStyles.length === 0) {
        logWarning('⚠️  No CSS found in the HTML response');
      }
    }
    
    console.log('');
    log('═══════════════════════════════════════════════════════════', 'green');
    log('  Test Result: SUCCESS', 'green');
    log('═══════════════════════════════════════════════════════════', 'green');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.log('');
    log('═══════════════════════════════════════════════════════════', 'red');
    log('  Test Result: FAILED', 'red');
    log('═══════════════════════════════════════════════════════════', 'red');
    console.log('');
    
    // Log detailed error information
    if (error.type === 'INVALID_URL') {
      logError(`Invalid URL: ${error.error}`);
    } else if (error.type === 'TIMEOUT') {
      logError(`Timeout after ${error.timeout}ms`);
    } else if (error.type === 'HTTP_ERROR') {
      logError(`HTTP Error ${error.statusCode}: ${error.statusMessage || 'Unknown'}`);
      if (error.responseSize) {
        logInfo(`Response size: ${(error.responseSize / 1024).toFixed(2)} KB`);
      }
    } else if (error.type === 'NETWORK_ERROR') {
      logError(`Network Error: ${error.errorDescription || error.errorMessage}`);
      if (error.errorCode) {
        logInfo(`Error code: ${error.errorCode}`);
      }
    } else {
      logError(`Unexpected error: ${JSON.stringify(error, null, 2)}`);
    }
    
    console.log('');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

