/**
 * A small, correct CSV reader.
 *
 * Written rather than pulled in, per `AGENT.md`'s stance on dependencies: the
 * whole of RFC 4180 that matters here is quoting, escaped quotes and newlines
 * inside quoted fields, which is the ~40 lines below. A split on commas is what
 * people reach for instead, and it corrupts the first product whose description
 * contains a comma — which is most of them.
 *
 * Handles: quoted fields, `""` escapes, commas and newlines inside quotes, CRLF,
 * a UTF-8 BOM (Excel writes one), and ragged rows.
 */

export function parseCsv(input: string): string[][] {
  // Excel prefixes a BOM; left in place it becomes part of the first header,
  // so `name` silently fails to match.
  const text = input.replace(/^\uFEFF/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let started = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Skip rows that are entirely empty — trailing newlines are universal.
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !started) {
      inQuotes = true;
      started = true;
      continue;
    }
    if (char === ",") {
      endField();
      started = false;
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      endRow();
      continue;
    }

    field += char;
    started = true;
  }

  // Whatever is left when the input ends is the final row.
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/**
 * Parse into objects keyed by header.
 *
 * Headers are lower-cased and stripped of spaces and underscores, so
 * `Product Name`, `product_name` and `productname` all resolve the same. A
 * merchant exporting from Excel should not have to match our casing.
 */
export function parseCsvRecords(input: string): {
  headers: string[];
  records: Array<Record<string, string>>;
} {
  const rows = parseCsv(input);
  if (rows.length === 0) return { headers: [], records: [] };

  const [rawHeaders = [], ...body] = rows;
  const headers = rawHeaders.map(normalizeHeader);

  const records = body.map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/** Quote a value for output only when it needs it. */
export function toCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
}
