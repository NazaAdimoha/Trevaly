import { downloadBlob } from './download';
import type { ExportCellValue, TableExportDefinition } from './types';

function normalizeRawValue(value: ExportCellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvFromRows<T>(
  rows: T[],
  definition: TableExportDefinition<T>,
): string {
  const headerLine = definition.columns
    .map((column) => escapeCsvCell(column.header))
    .join(',');

  const dataLines = rows.map((row) =>
    definition.columns
      .map((column) => {
        const resolved = column.csvValue
          ? column.csvValue(row)
          : column.value(row);
        return escapeCsvCell(normalizeRawValue(resolved));
      })
      .join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

export function downloadCsv(csvText: string, fileName: string): void {
  const blob = new Blob([csvText], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, fileName);
}
