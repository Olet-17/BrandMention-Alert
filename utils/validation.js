/**
 * Input validation & sanitization for search queries.
 */
const SQLI_PATTERNS = [
  /\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|MERGE)\b/i,
  /--|;|\/\*|\*\//,
  /\b(OR|AND)\b\s+\d+=\d+/i
];

function sanitizeKeyword(keyword) {
  let s = (keyword || '').toString().trim();
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ');
  // Remove control characters
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Limit to safe chars (letters, numbers, spaces, basic punctuation)
  s = s.replace(/[^\w\s\-_.#@/:+]/g, '');
  return s;
}

function validateParams({ keyword, limit }) {
  const errors = [];
  if (typeof keyword !== 'string' || keyword.trim().length < 1 || keyword.trim().length > 100) {
    errors.push('`keyword` must be 1-100 characters.');
  }
  const n = Number(limit ?? 20);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    errors.push('`limit` must be an integer between 1 and 100.');
  }
  return { errors, limit: n };
}

function detectSQLi(input) {
  const s = String(input || '');
  return SQLI_PATTERNS.some((re) => re.test(s));
}

module.exports = { sanitizeKeyword, validateParams, detectSQLi };
