# HTML Rendering Analysis Report - Article Generation and Display

## Executive Summary

This report analyzes how HTML content is handled in the article generation and display system. The codebase currently supports HTML rendering in article bodies, but **no sanitization is performed** before storing or displaying content. HTML is rendered directly using Nunjucks' `| safe` filter, which bypasses auto-escaping.

---

## 1. Article Content Storage

### 1.1 Database Schema
- **Primary Field**: `body` (TEXT column in SQLite)
- **Legacy Field**: `content` (for backward compatibility)
- Both fields store raw HTML strings without any processing or sanitization

### 1.2 Data Flow - Article Creation

#### CMS Article Creation (`server/routes/cms.js`)
- **Location**: Lines 655-676
- **Process**: 
  - User input from `<textarea name="body">` is stored directly
  - No HTML sanitization or validation
  - Content is stored as-is: `body: articleData.body`
- **CMS Editor Hint**: 
  - Template explicitly mentions HTML support: `"HTML etiketleri desteklenir"`
  - Suggests using `<h2>` for headers

#### RSS Worker Article Creation (`workers/dha-rss-worker.js`)
- **Location**: Lines 387-456
- **Process**:
  - Extracts `descriptionHtml` from RSS feed (line 388)
  - Stores raw HTML directly: `body: descriptionHtml` (line 442)
  - Only strips HTML for text summaries (using `stripHtml()` function)
  - **No sanitization** of the HTML content before storage

### 1.3 Data Retrieval (`server/services/data-service.js`)

#### `parseArticle()` Method
- **Location**: Lines 1245-1291
- **Process**:
  - Maps `row.body` or `row.content` directly to article object
  - No transformation or sanitization
  - Both `body` and `content` fields are populated for backward compatibility:
    ```javascript
    body: body,  // Line 1269
    content: body,  // Line 1285 (legacy)
    ```

---

## 2. Article Content Rendering

### 2.1 Template Rendering System

#### Nunjucks Configuration (`server/index.js`)
- **Location**: Lines 45-49
- **Auto-escaping**: Enabled by default (`autoescape: true`)
- **Safe Filter**: Used to bypass auto-escaping for HTML content

#### Primary Rendering Points

##### A. Article Detail Page (`templates/pages/article.njk`)
- **Location**: Line 105
- **Rendering**: `{{ article.content | safe }}`
- **Context**: Fallback template when no custom layout is configured
- **Behavior**: Renders raw HTML without escaping

##### B. Article Content Widget (`templates/widgets/article-content.njk`)
- **Location**: Line 4
- **Rendering**: `{{ article.content | safe }}`
- **Context**: Used in widget-based article layouts
- **Behavior**: Renders raw HTML without escaping

##### C. Widget Renderer System (`templates/widgets/article-widget-renderer.njk`)
- **Location**: Line 34
- **Process**: Routes to `articleContentWidget.articleContent(article)`
- **Behavior**: Delegates to widget macro which uses `| safe` filter

### 2.2 Content Field Mapping

The system uses a dual-field approach:
- **`article.body`**: Primary field (new structure)
- **`article.content`**: Legacy field (backward compatibility)

Both contain the same HTML content, and templates use `article.content` for rendering.

---

## 3. HTML Processing Functions

### 3.1 `stripHtml()` Function (`workers/dha-rss-worker.js`)
- **Location**: Line 106
- **Purpose**: Removes HTML tags for text-only summaries
- **Implementation**: 
  ```javascript
  const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  ```
- **Usage**: 
  - Used for `summaryHead` and `summary` fields (lines 438-439)
  - Used for image alt/title attributes (lines 240-241)
  - **NOT used** for article body content

### 3.2 No Sanitization Functions
- **No HTML sanitization library** (e.g., DOMPurify, sanitize-html)
- **No allowlist/blocklist** for HTML tags
- **No XSS protection** for stored HTML

---

## 4. Current HTML Support

### 4.1 Supported HTML Elements (Based on CMS Hints)
- **Headers**: `<h2>` explicitly mentioned in CMS editor
- **Paragraphs**: Implied (textarea with line breaks)
- **Other HTML**: No restrictions mentioned

### 4.2 Image Handling
- **Separate System**: Images are NOT embedded in article body HTML
- **Storage**: Images stored in separate `images` array (JSON)
- **Rendering**: Images rendered via dedicated widgets/templates
- **Location**: `templates/widgets/article-image.njk`, `article-hero-image.njk`

### 4.3 Video Handling
- **Separate System**: Videos stored in `videoUrl` field
- **Rendering**: Dedicated `<video>` tag in templates
- **Location**: `templates/pages/article.njk` lines 92-102

---

## 5. Security Analysis

### 5.1 XSS Vulnerability
- **Risk Level**: **HIGH**
- **Issue**: Raw HTML from RSS feeds and CMS is rendered without sanitization
- **Attack Vector**: 
  - Malicious HTML in RSS feed descriptions
  - Malicious HTML pasted into CMS editor
  - Script injection via `<script>` tags or event handlers
- **Current Protection**: 
  - Nunjucks auto-escaping is bypassed with `| safe`
  - No Content Security Policy (CSP) restrictions on inline scripts
  - No HTML sanitization on input or output

### 5.2 Documented Security Concern
- **Location**: `agentic.txt` lines 148-158
- **Status**: Identified but not resolved
- **Recommendation**: Implement HTML sanitization using allowlist-based sanitizer

---

## 6. Rendering Architecture

### 6.1 Widget-Based Layout System
- **Primary System**: Custom article layouts via widget configuration
- **Fallback**: Default template when no layout configured
- **Widget Types**:
  - `article-content`: Renders HTML body
  - `article-header`: Renders title/header
  - `article-image`: Renders images
  - `article-summary`: Renders summary text (escaped)
  - `article-meta`: Renders metadata
  - `article-tags`: Renders tags
  - `article-citation`: Renders source info

### 6.2 Content Rendering Flow

```
Database (body/content) 
  → dataService.parseArticle() 
  → server/routes/pages.js (article object)
  → Template (article.njk or widget)
  → Nunjucks render with | safe filter
  → Raw HTML output to browser
```

---

## 7. Recommendations for HTML Enhancement

### 7.1 To Support Rich HTML Formatting

#### Option A: Client-Side Rich Text Editor
- **Implement**: WYSIWYG editor (e.g., TinyMCE, Quill, CKEditor)
- **Location**: `templates/cms/components/article-editor.njk` line 43
- **Benefits**: 
  - User-friendly HTML generation
  - Built-in sanitization options
  - Visual formatting

#### Option B: Markdown Support
- **Implement**: Markdown parser (e.g., marked, markdown-it)
- **Process**: Store Markdown, convert to HTML on render
- **Benefits**: 
  - Simpler input format
  - Automatic HTML generation
  - Built-in sanitization

#### Option C: HTML Sanitization Library
- **Implement**: DOMPurify (server-side) or sanitize-html
- **Location**: 
  - Input: `server/routes/cms.js` (article creation/update)
  - Input: `workers/dha-rss-worker.js` (RSS ingestion)
- **Benefits**: 
  - Allowlist-based sanitization
  - XSS protection
  - Configurable allowed tags/attributes

### 7.2 Recommended Allowed HTML Tags
Based on typical article formatting needs:
- **Text Formatting**: `<p>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<u>`
- **Headers**: `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>`
- **Lists**: `<ul>`, `<ol>`, `<li>`
- **Links**: `<a>` (with `href`, `target`, `rel` attributes)
- **Line Breaks**: `<br>`, `<hr>`
- **Blockquotes**: `<blockquote>`
- **Code**: `<code>`, `<pre>`
- **Images**: `<img>` (with `src`, `alt` attributes) - if inline images desired

### 7.3 Implementation Strategy

#### Phase 1: Sanitization (Security)
1. Add HTML sanitization library (DOMPurify or sanitize-html)
2. Sanitize on input (CMS save, RSS ingestion)
3. Configure allowlist of safe HTML tags/attributes
4. Test with malicious HTML samples

#### Phase 2: Enhancement (UX)
1. Add rich text editor to CMS
2. Provide formatting toolbar (bold, italic, headers, lists)
3. Add preview functionality
4. Update documentation

#### Phase 3: Optimization
1. Cache sanitized HTML (if needed)
2. Add HTML validation warnings in CMS
3. Implement HTML minification (optional)

---

## 8. Current Limitations

### 8.1 No HTML Validation
- Invalid HTML may break rendering
- No validation on input or output

### 8.2 No Formatting Tools
- Users must write HTML manually
- No visual editor or formatting buttons
- No preview before saving

### 8.3 No Image Embedding in Body
- Images must be uploaded separately
- Cannot embed images inline in article text
- Images rendered via separate widgets only

### 8.4 No Link Formatting
- Links can be added via HTML but no editor support
- No automatic link detection/formatting

---

## 9. File Locations Summary

### Article Storage & Retrieval
- `server/services/data-service.js`: Database operations, `parseArticle()` method
- `server/routes/cms.js`: CMS article creation/update endpoints
- `workers/dha-rss-worker.js`: RSS feed ingestion

### Article Rendering
- `templates/pages/article.njk`: Main article detail page template
- `templates/widgets/article-content.njk`: Article content widget
- `templates/widgets/article-widget-renderer.njk`: Widget routing system
- `server/routes/pages.js`: Article detail route handler

### Article Editing
- `templates/cms/components/article-editor.njk`: CMS article editor form
- `public/cms/js/cms-app.js`: CMS JavaScript (form handling)

### Configuration
- `server/index.js`: Nunjucks configuration with auto-escaping

---

## 10. Conclusion

The current system **supports HTML rendering** in article bodies but:
- ✅ HTML is stored and rendered as-is
- ✅ Uses Nunjucks `| safe` filter to bypass auto-escaping
- ❌ **No HTML sanitization** (security risk)
- ❌ **No rich text editor** (poor UX)
- ❌ **No HTML validation**

**To enable proper HTML formatting with security:**
1. Implement HTML sanitization library (DOMPurify/sanitize-html)
2. Add rich text editor to CMS
3. Configure allowlist of safe HTML tags
4. Sanitize on both input (save) and output (render) for defense in depth

**Current State**: HTML works but is insecure and user-unfriendly. Enhancement requires both security hardening and UX improvements.

