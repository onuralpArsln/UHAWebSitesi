/**
 * DHA RSS HTML sanitizer.
 *
 * Goal:
 * - Remove DHA author/location byline prefixes that appear inside <p> blocks.
 * - Remove trailing "(DHA)" tokens that appear at the end of paragraphs.
 *
 * NOTE: Keep this conservative to avoid deleting real story text.
 */

function sanitizeDhaHtml(html = '') {
  const source = (html || '').toString();
  if (!source.trim()) return source;

  // Only operate on <p> blocks (DHA RSS uses <p> for content).
  const paragraphRegex = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  const paragraphs = source.match(paragraphRegex);
  if (!paragraphs) {
    // Fallback: still remove trailing "(DHA)" if it’s the whole string
    return stripTrailingDhaToken(source);
  }

  const cleaned = paragraphs
    .map((p) => {
      const inner = p
        .replace(/^<p\b[^>]*>/i, '')
        .replace(/<\/p>\s*$/i, '');

      const cleanedText = sanitizeParagraphText(inner);
      if (!cleanedText) return '';

      return `<p>${cleanedText}</p>`;
    })
    .filter(Boolean);

  return cleaned.join('');
}

function sanitizeParagraphText(htmlLike = '') {
  const raw = (htmlLike || '').toString();
  const text = stripInlineTags(raw).trim();
  if (!text) return '';

  // 1) Drop standalone "Haber-Kamera: ..." paragraphs (detect BEFORE trimming "(DHA)")
  if (isStandaloneCameraByline(text)) {
    return '';
  }

  // 2) Remove trailing "(DHA)" token ONLY (keep paragraph text, including punctuation)
  let next = stripTrailingDhaToken(text);

  // 3) Remove byline prefixes like "Name SURNAME/ LOCATION, (DHA)- ..."
  // Keep the remainder of the paragraph.
  const bylinePrefixRegex =
    /^\s*(?:Haber\s*[-–—]\s*Kamera:\s*)?[\p{L}.'’\-–—\s]{2,120}\s*\/\s*[\p{L}0-9()'’.,\-–—\s]{2,160}\s*,?\s*\(DHA\)\s*[-–—]?\s*/u;

  if (bylinePrefixRegex.test(next)) {
    next = next.replace(bylinePrefixRegex, '').trim();
  }

  // If after stripping the byline we have nothing meaningful, drop paragraph.
  if (!next) return '';

  return next;
}

function stripTrailingDhaToken(text = '') {
  // Remove only the "(DHA)" token when it appears at the end,
  // optionally preceded by whitespace and optionally followed by punctuation/whitespace.
  // IMPORTANT: Do not remove punctuation that appears before "(DHA)".
  return (text || '').toString().replace(/\s*\(DHA\)\s*[\.,;:!?]*\s*$/i, '').trim();
}

function isStandaloneCameraByline(text = '') {
  const t = (text || '').toString().trim();
  if (!t) return false;
  // Examples:
  // - "Haber-Kamera: Emre ÖNCEL- Berkay YILDIZ/ SAMSUN, (DHA)-"
  // - "Haber - Kamera: Tunahan KIR/ANTALYA, (DHA)"
  return /^(?:Haber\s*[-–—]\s*Kamera:|Haber-Kamera:)\s*.+\(DHA\)\s*[-–—]?\s*$/i.test(t);
}

function stripInlineTags(value = '') {
  // We expect plain text in <p>, but be defensive.
  return (value || '').toString().replace(/<[^>]*>/g, '');
}

module.exports = {
  sanitizeDhaHtml,
  // exported for unit tests
  sanitizeParagraphText,
  stripTrailingDhaToken
};


