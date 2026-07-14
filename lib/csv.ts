function protectSpreadsheetCell(value: string) {
  const normalized = value.replace(/\r\n|\r|\n/g, " ");
  return /^[\u0000-\u0020]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

export function escapeCsvCell(value: string | number) {
  const protectedValue = protectSpreadsheetCell(String(value));
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: Array<Array<string | number>>) {
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}

export function formatCentsForCsv(cents: number) {
  return (cents / 100).toFixed(2);
}
