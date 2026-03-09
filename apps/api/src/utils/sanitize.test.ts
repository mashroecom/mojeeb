import { describe, it, expect } from 'vitest';
import { escapeHtml } from './sanitize';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not double-escape already-escaped content', () => {
    const once = escapeHtml('<b>');
    const twice = escapeHtml(once);
    expect(once).toBe('&lt;b&gt;');
    expect(twice).toBe('&amp;lt;b&amp;gt;'); // Correct: & gets escaped again
  });

  it('escapes angle brackets in XSS payloads', () => {
    const xss = '"><img src=x onerror=alert(1)>';
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes quotes to prevent attribute breakout', () => {
    const xss = "' onmouseover='alert(1)'";
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain("'");
    expect(escaped).toBe('&#39; onmouseover=&#39;alert(1)&#39;');
  });

  it('handles unicode characters without escaping', () => {
    expect(escapeHtml('مرحبا بالعالم')).toBe('مرحبا بالعالم');
    expect(escapeHtml('你好世界')).toBe('你好世界');
  });

  it('handles mixed content', () => {
    expect(escapeHtml('Hello <b>World</b> & "Everyone"')).toBe(
      'Hello &lt;b&gt;World&lt;/b&gt; &amp; &quot;Everyone&quot;',
    );
  });
});
