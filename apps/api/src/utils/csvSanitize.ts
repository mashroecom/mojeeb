/**
 * Formula injection characters that can be exploited in CSV files.
 * These characters at the start of a cell can trigger formula execution
 * in spreadsheet applications (Excel, Google Sheets, LibreOffice Calc).
 */
const FORMULA_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitize a value for safe CSV export by preventing formula injection attacks.
 *
 * This function protects against CSV formula injection by:
 * 1. Detecting dangerous characters (=, +, -, @, tab, carriage return) at the start of values
 * 2. Prefixing dangerous values with a single quote (') to neutralize formulas
 * 3. Handling CSV special characters (commas, quotes, newlines)
 * 4. Properly handling null/undefined values
 *
 * @param value - The value to sanitize (can be string, number, null, or undefined)
 * @returns A sanitized string safe for CSV export
 *
 * @example
 * csvSanitize('=CMD|"/C calc"!A0') // Returns "'=CMD|"/C calc"!A0"
 * csvSanitize('normal text') // Returns "normal text"
 * csvSanitize('text, with comma') // Returns '"text, with comma"'
 * csvSanitize(null) // Returns ""
 */
export function csvSanitize(value: string | number | null | undefined): string {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string if it's a number
  let str = String(value);

  // Check if the string starts with a formula injection character
  const startsWithDangerousChar = FORMULA_INJECTION_CHARS.some((char) => str.startsWith(char));

  // If it starts with a dangerous character, prefix with single quote to neutralize
  if (startsWithDangerousChar) {
    str = `'${str}`;
  }

  // Handle CSV special characters: commas, quotes, and newlines
  // If the string contains any of these, wrap it in double quotes
  // and escape any existing double quotes by doubling them
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    // Escape existing double quotes by doubling them
    str = str.replace(/"/g, '""');
    // Wrap in double quotes
    str = `"${str}"`;
  }

  return str;
}
