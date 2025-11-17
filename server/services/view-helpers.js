const config = require('./config');

function buildMeta(overrides = {}, req = null) {
  const siteDefaults = config.getSiteDefaults();
  const siteUrl = req ? config.getSiteUrl(req) : 'http://localhost:3000';
  const defaultOgImage = `${siteUrl}/static/images/default-og.jpg`;
  
  const defaults = {
    title: siteDefaults.name,
    description: siteDefaults.description,
    url: siteUrl,
    image: defaultOgImage,
    type: 'website'
  };

  const meta = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null)
    )
  };

  if (meta.description && meta.description.length > 160) {
    meta.description = `${meta.description.substring(0, 157)}...`;
  } else if (meta.description && meta.description.length < 140) {
    meta.description = `${meta.description} - ${defaults.title}`;
  }

  return meta;
}

function buildNewsArticleSchema(article = {}, req = null) {
  if (!article || !article.title) {
    return null;
  }

  const siteDefaults = config.getSiteDefaults();
  const baseUrl = req ? config.getSiteUrl(req) : 'http://localhost:3000';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || article.title,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Person',
      name: article.author || siteDefaults.name
    },
    publisher: {
      '@type': 'Organization',
      name: siteDefaults.name,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/static/images/logo.png`
      }
    }
  };

  if (article.images && Array.isArray(article.images) && article.images.length > 0) {
    schema.image = article.images.map((img) => ({
      '@type': 'ImageObject',
      url: img.highRes || img.url,
      width: img.width,
      height: img.height
    }));
  }

  if (article.category) {
    schema.articleSection = article.category;
  }

  if (article.keywords) {
    schema.keywords = Array.isArray(article.keywords)
      ? article.keywords.join(', ')
      : article.keywords;
  }

  return JSON.stringify(schema);
}

function optimizeImageData(images) {
  if (!images || !Array.isArray(images)) return [];

  return images.map((img) => ({
    ...img,
    lowRes: img.lowRes || img.url,
    width: img.width || 800,
    height: img.height || 600,
    alt: img.alt || img.title || 'News image'
  }));
}

module.exports = {
  buildMeta,
  buildNewsArticleSchema,
  optimizeImageData
};

