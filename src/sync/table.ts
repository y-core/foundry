export type TableRow = Record<string, string>;

// Renders a column-aligned ASCII table from an array of row objects.
// Column order follows the key order of the first row.
export function renderTable(rows: TableRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const widths: number[] = headers.map((h) => h.length);

  for (const row of rows) {
    for (let i = 0; i < headers.length; i++) {
      const val = row[headers[i]] ?? "";
      if (val.length > widths[i]) widths[i] = val.length;
    }
  }

  const pad = (s: string, w: number) => s.padEnd(w);
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  const header = headers.map((h, i) => pad(h, widths[i])).join("  ");

  const lines: string[] = [header, separator];
  for (const row of rows) {
    lines.push(headers.map((h, i) => pad(row[h] ?? "", widths[i])).join("  "));
  }

  return lines.join("\n");
}
