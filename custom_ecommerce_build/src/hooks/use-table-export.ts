'use client';

// CSV only. Ceviant's PDF exporter was dropped with its branded letterhead —
// a tenant's receipt must carry THEIR logo, so branded PDF lands in M8 with
// per-tenant styling rather than a shared template.

import { useCallback, useState } from 'react';

import { buildCsvFromRows, downloadCsv } from '@/lib/export/csv';
import { buildExportFileName } from '@/lib/export/file-name';
import type { TableExportDefinition } from '@/lib/export/types';

interface UseTableExportOptions<T> {
  rows: T[];
  definition: TableExportDefinition<T>;
}

export function useTableExport<T>({
  rows,
  definition,
}: UseTableExportOptions<T>) {
  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const csv = buildCsvFromRows(rows, definition);
      const fileName = buildExportFileName(definition.baseFileName, 'csv');
      downloadCsv(csv, fileName);
    } finally {
      setIsExporting(false);
    }
  }, [definition, rows]);

  return {
    exportCsv,
    isExporting,
  };
}
