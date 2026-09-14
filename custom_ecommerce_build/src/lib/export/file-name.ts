import { format } from 'date-fns';

import type { ExportFormat } from './types';

const EXPORT_TIMESTAMP_FORMAT = 'yyyy-MM-dd_HH-mm-ss';

function sanitizeFileName(baseFileName: string): string {
  return baseFileName
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildExportFileName(
  baseFileName: string,
  formatType: ExportFormat,
  date: Date = new Date(),
): string {
  const safeBaseName = sanitizeFileName(baseFileName) || 'export';
  const timestamp = format(date, EXPORT_TIMESTAMP_FORMAT);
  return `${safeBaseName}_${timestamp}.${formatType}`;
}
