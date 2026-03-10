/**
 * Formula injection characters that can be exploited in CSV files.
 * These characters at the start of a cell can trigger formula execution
 * in spreadsheet applications (Excel, Google Sheets, LibreOffice Calc).
 */
const FORMULA_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r'];

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          let str = val === null || val === undefined ? '' : String(val);

          // Check if the string starts with a formula injection character
          const startsWithDangerousChar = FORMULA_INJECTION_CHARS.some((char) =>
            str.startsWith(char),
          );

          // If it starts with a dangerous character, prefix with single quote to neutralize
          if (startsWithDangerousChar) {
            str = `'${str}`;
          }

          // Handle CSV special characters: commas, quotes, and newlines
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
