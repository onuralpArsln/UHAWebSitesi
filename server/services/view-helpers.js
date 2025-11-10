const DEFAULT_OG_IMAGE = process.env.SITE_URL
  ? `${process.env.SITE_URL}/static/images/default-og.jpg`
  : '/static/images/default-og.jpg';

function buildMeta(overrides = {}) {
  const defaults = {
    title: process.env.SITE_NAME || 'UHA News',
    description:
      process.env.SITE_DESCRIPTION || 'Son dakika haberleri ve güncel gelişmeler',
    url: process.env.SITE_URL || 'http://localhost:3000',
    image: DEFAULT_OG_IMAGE,
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

function buildNewsArticleSchema(article = {}) {
  if (!article || !article.title) {
    return null;
  }

  const baseUrl = process.env.SITE_URL || 'http://localhost:3000';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || article.title,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Person',
      name: article.author || 'UHA News'
    },
    publisher: {
      '@type': 'Organization',
      name: process.env.SITE_NAME || 'UHA News',
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

