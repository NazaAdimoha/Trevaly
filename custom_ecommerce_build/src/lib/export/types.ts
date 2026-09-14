export type ExportFormat = 'csv' | 'pdf';

export type ExportCellValue =
  string | number | boolean | Date | null | undefined;

export type ExportColumnAlign = 'left' | 'center' | 'right';

export interface ExportColumnConfig<T> {
  key: string;
  header: string;
  value: (row: T) => ExportCellValue;
  csvValue?: (row: T) => ExportCellValue;
  pdfValue?: (row: T) => ExportCellValue;
  pdfWidth?: number;
  align?: ExportColumnAlign;
}

export interface TableExportDefinition<T> {
  title: string;
  subtitle?: string;
  baseFileName: string;
  columns: ExportColumnConfig<T>[];
  emptyValue?: string;
}
