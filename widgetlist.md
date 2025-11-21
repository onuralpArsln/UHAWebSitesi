# Widget List

This document provides a short explanation for each Nunjucks widget available in the `templates/widgets` directory.

## 1. Ad Placeholder (`ad-placeholder.njk`)
**Macro:** `adPlaceholder(slot='main', label='Reklam Alanı', size='300x250')`
Renders a placeholder box for advertisements. It accepts a slot name, a display label, and dimensions.

## 2. Article View (`article-view.njk`)
**Macro:** `articleView(article)`
Displays a detailed card for a single news article. It includes the article's image, category, title, summary, and publication date. It handles image resolution switching (low/high res).

## 3. Carousel (`carousel.njk`)
**Macro:** `carousel(id, slides)`
Renders a standard image carousel for a list of slides (articles). Features include:
- Navigation buttons (Previous/Next)
- Dot indicators
- Lazy loading for non-active slides

## 4. Carousel Set Size (`carouselSetSize.njk`)
**Macro:** `carouselSetSize(id, slides, config)`
A more advanced carousel with configurable dimensions and behavior.
**Config Options:**
- `size`: Width percentage (default: 100)
- `aspect`: Aspect ratio (default: '16/9')
- `autoScroll`: Boolean to enable auto-scrolling
- `sideClick`: Boolean to enable navigation by clicking sides
- `showTabs`: Boolean to show navigation tabs
- `tabsStyle`: Style of tabs ('numbers' or other)

## 5. Category Feed (`category-feed.njk`)
**Macro:** `categoryFeed(section)`
Renders a section for a specific news category. It includes a header with the category name and a "View All" link, followed by a grid of articles using the `newsCard` widget in compact mode.

## 6. Comment Section (`comment-section.njk`)
**Macro:** `commentSection(articleId, comments=[], hasMore=false)`
Renders a full comment system for an article.
**Features:**
- Comment submission form (Name, Email, Comment)
- List of comments with nested replies
- Like button for comments
- "Load More" functionality
- Empty state handling

## 7. Featured News Grid (`featured-news-grid.njk`)
**Macro:** `featuredNewsGrid(articles, title='Öne Çıkan Haberler')`
Displays a grid of featured news articles. It includes a section title and a responsive grid layout using the `newsCard` widget.

## 8. Flash News (`flashNews.njk`)
**Macro:** `flashNews(id, items, config)`
Displays a breaking news ticker (marquee) at the top of the page.
**Config Options:**
- `speed`: Animation speed
- `pauseDelay`: Delay on pause
- `duplicateCount`: Number of times to duplicate items for smooth scrolling

## 9. Footer (`footer.njk`)
**Macro:** `siteFooter(branding={}, categories=[])`
Renders the global site footer.
**Sections:**
- Branding (Logo/Name) & Social Links
- Categories List
- Corporate Links (About, Contact, Privacy, etc.)
- Contact Information
- Copyright & Credits

## 10. Hero Title (`hero-title.njk`)
**Macro:** `heroTitle(title)`
Renders a simple, styled title section, typically used for the "Son Dakika Haberleri" or similar hero headings.

## 11. News Card (`news-card.njk`)
**Macro:** `newsCard(article, variant='default')`
A reusable component to display a news article summary.
**Variants:**
- `default`: Standard view with image, title, summary, and meta info.
- `compact`: Hides the summary, useful for denser lists.

## 12. Related News (`related-news.njk`)
**Macro:** `relatedNews(articles)`
Displays a section titled "İlgili Haberler" (Related News) containing a grid/list of `related-article` items. Each item shows a thumbnail, title, summary, and date.

## 13. Site Header (`site-header.njk`)
**Macro:** `siteHeader(branding={}, categories=[])`
Renders the global site header.
**Features:**
- Top Bar: Date and Social Media links
- Main Header: Logo and Mobile Menu Toggle
- Navigation Bar: Desktop menu for categories
- Mobile Navigation Panel: Off-canvas menu for mobile devices
