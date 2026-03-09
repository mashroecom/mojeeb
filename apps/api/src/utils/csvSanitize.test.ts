import { describe, it, expect } from 'vitest';
import { csvSanitize } from './csvSanitize';

describe('csvSanitize', () => {
  // -------------------------------------------------------------------------
  // Formula injection protection
  // -------------------------------------------------------------------------
  describe('formula injection protection', () => {
    it('prefixes values starting with equals sign', () => {
      expect(csvSanitize('=1+1')).toBe("'=1+1");
      expect(csvSanitize('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    });

    it('prefixes values starting with plus sign', () => {
      expect(csvSanitize('+1+1')).toBe("'+1+1");
      expect(csvSanitize('+A1')).toBe("'+A1");
    });

    it('prefixes values starting with minus sign', () => {
      expect(csvSanitize('-1+1')).toBe("'-1+1");
      expect(csvSanitize('-A1')).toBe("'-A1");
    });

    it('prefixes values starting with at sign', () => {
      expect(csvSanitize('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    });

    it('prefixes values starting with tab character', () => {
      expect(csvSanitize('\tformula')).toBe("'\tformula");
    });

    it('prefixes values starting with carriage return', () => {
      expect(csvSanitize('\rformula')).toBe("'\rformula");
    });
  });

  // -------------------------------------------------------------------------
  // Real-world CSV injection payloads
  // -------------------------------------------------------------------------
  describe('real-world injection payloads', () => {
    it('neutralizes Excel DDE command execution', () => {
      const payload = '=CMD|"/C calc"!A0';
      const result = csvSanitize(payload);
      // Should be prefixed with ' and wrapped in " because it contains quotes
      expect(result).toBe('"\'=CMD|""/C calc""!A0"');
      // Verify it's neutralized (the ' prefix neutralizes the formula)
      expect(result.includes("'=")).toBe(true);
    });

    it('neutralizes command execution with HYPERLINK', () => {
      const payload = '=HYPERLINK("http://evil.com","Click me")';
      const result = csvSanitize(payload);
      // Should be prefixed with ' and wrapped in " because it contains quotes
      expect(result).toBe('"\'=HYPERLINK(""http://evil.com"",""Click me"")"');
      // Verify it's neutralized (the ' prefix neutralizes the formula)
      expect(result.includes("'=")).toBe(true);
    });

    it('neutralizes formula with cell references', () => {
      const payload = '=A1+B2*C3';
      const result = csvSanitize(payload);
      expect(result).toBe("'=A1+B2*C3");
      expect(result.startsWith("'")).toBe(true);
    });

    it('neutralizes IMPORTXML injection', () => {
      const payload = '=IMPORTXML("http://evil.com/data","//data")';
      const result = csvSanitize(payload);
      // Should be prefixed with ' and wrapped in " because it contains quotes
      expect(result).toBe('"\'=IMPORTXML(""http://evil.com/data"",""//data"")"');
      // Verify it's neutralized (the ' prefix neutralizes the formula)
      expect(result.includes("'=")).toBe(true);
    });

    it('neutralizes concatenation attack', () => {
      const payload = '=1+1+cmd|"/C calc"!A0';
      const result = csvSanitize(payload);
      // Should be prefixed with ' and wrapped in " because it contains quotes
      expect(result).toBe('"\'=1+1+cmd|""/C calc""!A0"');
      // Verify it's neutralized (the ' prefix neutralizes the formula)
      expect(result.includes("'=")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // CSV special characters handling
  // -------------------------------------------------------------------------
  describe('CSV special characters', () => {
    it('wraps values containing commas in double quotes', () => {
      expect(csvSanitize('Hello, World')).toBe('"Hello, World"');
      expect(csvSanitize('a,b,c')).toBe('"a,b,c"');
    });

    it('escapes double quotes by doubling them', () => {
      expect(csvSanitize('say "hello"')).toBe('"say ""hello"""');
      expect(csvSanitize('"quoted"')).toBe('"""quoted"""');
    });

    it('wraps values containing newlines in double quotes', () => {
      expect(csvSanitize('line1\nline2')).toBe('"line1\nline2"');
      expect(csvSanitize('multi\nline\ntext')).toBe('"multi\nline\ntext"');
    });

    it('handles multiple CSV special characters together', () => {
      expect(csvSanitize('text, with "quotes" and\nnewlines')).toBe(
        '"text, with ""quotes"" and\nnewlines"',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Combined formula injection and CSV special characters
  // -------------------------------------------------------------------------
  describe('combined formula injection and CSV special characters', () => {
    it('neutralizes formula with comma and wraps in quotes', () => {
      const payload = '=SUM(A1,B1)';
      const result = csvSanitize(payload);
      expect(result).toBe("\"'=SUM(A1,B1)\"");
      expect(result.startsWith('"')).toBe(true);
      expect(result.includes("'=")).toBe(true);
    });

    it('neutralizes formula with quotes and escapes them', () => {
      const payload = '=HYPERLINK("http://evil.com")';
      const result = csvSanitize(payload);
      expect(result).toBe("\"'=HYPERLINK(\"\"http://evil.com\"\")\"");
      expect(result.startsWith('"')).toBe(true);
      expect(result.includes("'=")).toBe(true);
    });

    it('neutralizes formula with newline and wraps in quotes', () => {
      const payload = '=FORMULA\nWITH\nNEWLINES';
      const result = csvSanitize(payload);
      expect(result).toBe("\"'=FORMULA\nWITH\nNEWLINES\"");
      expect(result.startsWith('"')).toBe(true);
      expect(result.includes("'=")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Safe values (no modification needed)
  // -------------------------------------------------------------------------
  describe('safe values', () => {
    it('does not modify normal text', () => {
      expect(csvSanitize('normal text')).toBe('normal text');
      expect(csvSanitize('Hello World')).toBe('Hello World');
    });

    it('does not modify numbers in the middle of text', () => {
      expect(csvSanitize('value 123')).toBe('value 123');
      expect(csvSanitize('total: 100')).toBe('total: 100');
    });

    it('does not modify text with dangerous characters in the middle', () => {
      expect(csvSanitize('a=b')).toBe('a=b');
      expect(csvSanitize('x+y')).toBe('x+y');
      expect(csvSanitize('a-b')).toBe('a-b');
      expect(csvSanitize('email@example.com')).toBe('email@example.com');
    });

    it('does not modify alphanumeric values', () => {
      expect(csvSanitize('ABC123')).toBe('ABC123');
      expect(csvSanitize('test123test')).toBe('test123test');
    });
  });

  // -------------------------------------------------------------------------
  // Null and undefined handling
  // -------------------------------------------------------------------------
  describe('null and undefined handling', () => {
    it('converts null to empty string', () => {
      expect(csvSanitize(null)).toBe('');
    });

    it('converts undefined to empty string', () => {
      expect(csvSanitize(undefined)).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Number handling
  // -------------------------------------------------------------------------
  describe('number handling', () => {
    it('converts positive numbers to strings', () => {
      expect(csvSanitize(123)).toBe('123');
      expect(csvSanitize(0)).toBe('0');
    });

    it('prefixes negative numbers (start with minus)', () => {
      expect(csvSanitize(-123)).toBe("'-123");
      expect(csvSanitize(-1)).toBe("'-1");
    });

    it('handles floating point numbers', () => {
      expect(csvSanitize(3.14)).toBe('3.14');
      expect(csvSanitize(-3.14)).toBe("'-3.14");
    });

    it('handles large numbers', () => {
      expect(csvSanitize(1000000)).toBe('1000000');
      expect(csvSanitize(-1000000)).toBe("'-1000000");
    });

    it('handles zero', () => {
      expect(csvSanitize(0)).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  // Unicode and emoji handling
  // -------------------------------------------------------------------------
  describe('unicode and emoji handling', () => {
    it('handles Arabic text', () => {
      expect(csvSanitize('مرحبا بالعالم')).toBe('مرحبا بالعالم');
    });

    it('handles Chinese text', () => {
      expect(csvSanitize('你好世界')).toBe('你好世界');
    });

    it('handles emoji', () => {
      expect(csvSanitize('Hello 🌍')).toBe('Hello 🌍');
      expect(csvSanitize('🔐🔑🛡️')).toBe('🔐🔑🛡️');
    });

    it('handles mixed unicode with dangerous characters', () => {
      const result = csvSanitize('=مرحبا');
      expect(result).toBe("'=مرحبا");
      expect(result.startsWith("'")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Empty strings
  // -------------------------------------------------------------------------
  describe('empty strings', () => {
    it('returns empty string as-is', () => {
      expect(csvSanitize('')).toBe('');
    });

    it('does not modify whitespace-only strings', () => {
      expect(csvSanitize('   ')).toBe('   ');
      expect(csvSanitize(' ')).toBe(' ');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles string with only a dangerous character', () => {
      expect(csvSanitize('=')).toBe("'=");
      expect(csvSanitize('+')).toBe("'+");
      expect(csvSanitize('-')).toBe("'-");
      expect(csvSanitize('@')).toBe("'@");
    });

    it('handles very long strings', () => {
      const longString = 'A'.repeat(10000);
      const result = csvSanitize(longString);
      expect(result).toBe(longString);
      expect(result.length).toBe(10000);
    });

    it('handles strings with multiple dangerous characters', () => {
      expect(csvSanitize('=+@-')).toBe("'=+@-");
    });

    it('handles strings that look like formulas but are safe', () => {
      expect(csvSanitize('equals sign = here')).toBe('equals sign = here');
      expect(csvSanitize('plus + here')).toBe('plus + here');
    });

    it('handles mixed whitespace', () => {
      expect(csvSanitize('  text  ')).toBe('  text  ');
      expect(csvSanitize('\n\ntext')).toBe('"\n\ntext"');
    });

    it('does not double-sanitize already prefixed values', () => {
      const alreadySanitized = "'=formula";
      const result = csvSanitize(alreadySanitized);
      // The function doesn't know it's already sanitized, so it should treat the leading ' as safe
      expect(result).toBe("'=formula");
    });
  });

  // -------------------------------------------------------------------------
  // Security-specific tests
  // -------------------------------------------------------------------------
  describe('security verification', () => {
    it('ensures all formula injection characters are neutralized', () => {
      const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];

      dangerousChars.forEach(char => {
        const result = csvSanitize(`${char}payload`);
        expect(result.startsWith("'")).toBe(true);
      });
    });

    it('prevents formula execution in popular spreadsheet applications', () => {
      // Test payloads that would execute in Excel, Google Sheets, LibreOffice
      const payloads = [
        '=1+1',
        '+1+1',
        '-1+1',
        '@SUM(A1:A10)',
        '=cmd|"/C calc"!A0',
        '=HYPERLINK("http://evil.com")',
      ];

      payloads.forEach(payload => {
        const result = csvSanitize(payload);
        // All should be neutralized with single quote prefix
        // Note: some may be wrapped in double quotes if they contain quotes or commas
        expect(result.includes("'=") || result.includes("'+") || result.includes("'-") || result.includes("'@")).toBe(true);
      });
    });

    it('maintains data integrity while preventing injection', () => {
      const input = '=SUM(A1:A10)';
      const result = csvSanitize(input);

      // Should be neutralized but preserve original content
      expect(result).toBe("'=SUM(A1:A10)");
      // Original formula should be readable (minus the prefix)
      expect(result.substring(1)).toBe(input);
    });
  });
});
