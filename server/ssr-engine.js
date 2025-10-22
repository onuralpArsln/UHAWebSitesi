const fs = require('fs').promises;
const path = require('path');
const NodeCache = require('node-cache');
const cheerio = require('cheerio');

class SSREngine {
  constructor() {
    this.templateCache = new NodeCache({ stdTTL: 300 }); // 5 min cache
    this.templatesPath = path.join(__dirname, '../templates');
  }

  /**
   * Load and cache template
   */
  async loadTemplate(templateName) {
    const cacheKey = `template:${templateName}`;
    let template = this.templateCache.get(cacheKey);
    
    if (!template) {
      const templatePath = path.join(this.templatesPath, templateName);
      try {
        template = await fs.readFile(templatePath, 'utf8');
        this.templateCache.set(cacheKey, template);
      } catch (error) {
        throw new Error(`Template not found: ${templateName}`);
      }
    }
    
    return template;
  }

  /**
   * Render widget with data
   */
  async renderWidget(widgetName, data = {}) {
    const widgetPath = path.join(this.templatesPath, 'widgets', `${widgetName}.html`);
    
    try {
      let widgetTemplate = await fs.readFile(widgetPath, 'utf8');
      
      // Replace variables in widget
      widgetTemplate = this.replaceVariables(widgetTemplate, data);
      
      return widgetTemplate;
    } catch (error) {
      console.error(`Widget not found: ${widgetName}`, error);
      return `<!-- Widget ${widgetName} not found -->`;
    }
  }

  /**
   * Replace variables in template
   */
  replaceVariables(template, data) {
    let result = template;
    
    // Replace {{variable}} patterns
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? String(value) : '';
    });

    // Replace {{#if condition}}...{{/if}} blocks
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      return value ? content : '';
    });

    // Replace {{#each array}}...{{/each}} blocks
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, content) => {
      const array = this.getNestedValue(data, arrayKey.trim());
      if (!Array.isArray(array)) return '';
      
      return array.map(item => this.replaceVariables(content, item)).join('');
    });

    return result;
  }

  /**
   * Get nested object value by key path
   */
  getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Inject widgets into template
   */
  async injectWidgets(template, data) {
    let result = template;
    
    // Find all widget placeholders {{widget:name}}
    const widgetMatches = result.match(/\{\{widget:([^}]+)\}\}/g);
    
    if (widgetMatches) {
      for (const match of widgetMatches) {
        const widgetName = match.replace(/\{\{widget:|\}\}/g, '');
        const widgetHtml = await this.renderWidget(widgetName, data);
        result = result.replace(match, widgetHtml);
      }
    }

    return result;
  }

  /**
   * Generate JSON-LD schema for NewsArticle
   */
  generateNewsArticleSchema(article) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": article.title,
      "description": article.summary || article.title,
      "datePublished": article.publishedAt,
      "dateModified": article.updatedAt || article.publishedAt,
      "author": {
        "@type": "Person",
        "name": article.author || "UHA News"
      },
      "publisher": {
        "@type": "Organization",
        "name": process.env.SITE_NAME || "UHA News",
        "logo": {
          "@type": "ImageObject",
          "url": `${process.env.SITE_URL}/static/images/logo.png`
        }
      }
    };

    if (article.images && article.images.length > 0) {
      schema.image = article.images.map(img => ({
        "@type": "ImageObject",
        "url": img.highRes || img.url,
        "width": img.width,
        "height": img.height
      }));
    }

    if (article.category) {
      schema.articleSection = article.category;
    }

    if (article.keywords) {
      schema.keywords = Array.isArray(article.keywords) ? article.keywords.join(', ') : article.keywords;
    }

    return JSON.stringify(schema, null, 2);
  }

  /**
   * Generate meta tags for SEO
   */
  generateMetaTags(pageData) {
    const meta = {
      title: pageData.title || process.env.SITE_NAME,
      description: pageData.description || process.env.SITE_DESCRIPTION,
      url: pageData.url || process.env.SITE_URL,
      image: pageData.image || `${process.env.SITE_URL}/static/images/default-og.jpg`,
      type: pageData.type || 'website'
    };

    // Ensure description is 140-160 characters
    if (meta.description && meta.description.length > 160) {
      meta.description = meta.description.substring(0, 157) + '...';
    } else if (meta.description && meta.description.length < 140) {
      meta.description = meta.description + ' - ' + (process.env.SITE_NAME || 'UHA News');
    }

    return meta;
  }

  /**
   * Main render method
   */
  async render(templateName, data = {}) {
    try {
      // Load base template
      let template = await this.loadTemplate(templateName);
      
      // Inject widgets
      template = await this.injectWidgets(template, data);
      
      // Replace variables
      template = this.replaceVariables(template, data);
      
      // Add meta tags and JSON-LD if article data exists
      if (data.article) {
        const meta = this.generateMetaTags({
          title: data.article.title,
          description: data.article.summary,
          url: `${process.env.SITE_URL}/haber/${data.article.slug}`,
          image: data.article.images?.[0]?.highRes,
          type: 'article'
        });
        
        // Inject meta tags
        template = template.replace('{{meta.title}}', meta.title);
        template = template.replace('{{meta.description}}', meta.description);
        template = template.replace('{{meta.url}}', meta.url);
        template = template.replace('{{meta.image}}', meta.image);
        template = template.replace('{{meta.type}}', meta.type);
        
        // Inject JSON-LD schema
        const schema = this.generateNewsArticleSchema(data.article);
        template = template.replace('{{json-ld-schema}}', schema);
      } else {
        // Default meta tags
        const meta = this.generateMetaTags(data);
        template = template.replace('{{meta.title}}', meta.title);
        template = template.replace('{{meta.description}}', meta.description);
        template = template.replace('{{meta.url}}', meta.url);
        template = template.replace('{{meta.image}}', meta.image);
        template = template.replace('{{meta.type}}', meta.type);
        template = template.replace('{{json-ld-schema}}', '');
      }

      return template;
    } catch (error) {
      console.error('SSR Render Error:', error);
      throw error;
    }
  }

  /**
   * Optimize images for progressive loading
   */
  optimizeImageData(images) {
    if (!images || !Array.isArray(images)) return [];
    
    return images.map(img => ({
      ...img,
      // Ensure low-res version exists for SSR
      lowRes: img.lowRes || img.url,
      // Add explicit dimensions to prevent CLS
      width: img.width || 800,
      height: img.height || 600,
      // Generate alt text if missing
      alt: img.alt || img.title || 'News image'
    }));
  }
}

module.exports = SSREngine;
