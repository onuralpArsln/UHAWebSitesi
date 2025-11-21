# Widget List

This document provides a short explanation for each Nunjucks widget available in the `templates/widgets` directory.

## 1. Ad Placeholder
**File:** `ad-placeholder.njk`  
**Macro:** `adPlaceholder(slot='main', label='Reklam Alanı', size='300x250')`

Renders a placeholder box for advertisements. It accepts a slot name, a display label, and dimensions.

---

## 2. Article View
**File:** `article-view.njk`  
**Macro:** `articleView(article)`

Displays a detailed card for a single news article. It includes the article's image, category, title, summary, and publication date. It handles image resolution switching (low/high res).

---

## 3. Carousel
**File:** `carousel.njk`  
**Macro:** `carousel(id, slides)`

Renders a standard image carousel for a list of slides (articles). Features include:
- Navigation buttons (Previous/Next)
- Dot indicators
- Lazy loading for non-active slides

---

## 4. Carousel Set Size
**File:** `carouselSetSize.njk`  
**Macro:** `carouselSetSize(id, slides, config)`

A more advanced carousel with configurable dimensions and behavior.

**Config Options:**
- `size`: Width percentage (default: 100)
- `aspect`: Aspect ratio (default: '16/9')
- `autoScroll`: Boolean to enable auto-scrolling
- `sideClick`: Boolean to enable navigation by clicking sides
- `showTabs`: Boolean to show navigation tabs
- `tabsStyle`: Style of tabs ('numbers' or other)

---

## 5. Category Feed
**File:** `category-feed.njk`  
**Macro:** `categoryFeed(categoryName, slug, articles)`

Renders a section for a specific news category. It includes a header with the category name and a "View All" link, followed by a grid of articles using the `newsCard` widget in compact mode.

---

## 6. Comment Section
**File:** `comment-section.njk`  
**Macro:** `commentSection(articleId, comments=[], hasMore=false)`

Renders a full comment system for an article.

**Features:**
- Comment submission form (Name, Email, Comment)
- List of comments with nested replies
- Like button for comments
- "Load More" functionality
- Empty state handling

---

## 7. Featured News Grid
**File:** `featured-news-grid.njk`  
**Macro:** `featuredNewsGrid(articles, title='Öne Çıkan Haberler')`

Displays a grid of featured news articles. It includes a section title and a responsive grid layout using the `newsCard` widget.

---

## 8. Flash News
**File:** `flashNews.njk`  
**Macro:** `flashNews(id, items, config)`

Displays a breaking news ticker (marquee) at the top of the page.

**Config Options:**
- `speed`: Animation speed
- `pauseDelay`: Delay on pause
- `duplicateCount`: Number of times to duplicate items for smooth scrolling

---

## 9. Footer
**File:** `footer.njk`  
**Macro:** `siteFooter(branding={}, categories=[])`

Renders the global site footer.

**Sections:**
- Branding (Logo/Name) & Social Links
- Categories List
- Corporate Links (About, Contact, Privacy, etc.)
- Contact Information
- Copyright & Credits

---

## 10. Hero Title
**File:** `hero-title.njk`  
**Macro:** `heroTitle(title)`

Renders a simple, styled title section, typically used for the "Son Dakika Haberleri" or similar hero headings.

---

## 11. News Card
**File:** `news-card.njk`  
**Macro:** `newsCard(article, variant='default')`

A reusable component to display a news article summary.

**Variants:**
- `default`: Standard view with image, title, summary, and meta info.
- `compact`: Hides the summary, useful for denser lists.

---

## 12. Related News
**File:** `related-news.njk`  
**Macro:** `relatedNews(articles)`

Displays a section titled "İlgili Haberler" (Related News) containing a grid/list of `related-article` items. Each item shows a thumbnail, title, summary, and date.

---

## 13. Site Header
**File:** `site-header.njk`  
**Macro:** `siteHeader(navCategories, branding)`

Renders the global site header with top bar, logo, and navigation menus (both desktop and mobile). Includes social links, date display, and responsive mobile menu toggle.

---

## 14. Widget Renderer
**File:** `widget-renderer.njk`  
**Macro:** `render(widget)`

Dynamically renders widgets based on their type configuration. Used for the dynamic homepage layout system. Accepts a widget object with `type`, `config`, and `data` properties and delegates to the appropriate widget macro.

**Supported Widget Types:**
- `hero-title`: Renders a hero title section
- `carousel`: Renders a carousel with articles
- `featured-news-grid`: Renders a grid of featured news
- `category-feed`: Renders a category-specific news feed
- `ad-placeholder`: Renders an advertisement placeholder
