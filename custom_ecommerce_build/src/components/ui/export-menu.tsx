'use client';

import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import Button from '@/components/buttons/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportMenuProps {
  /** Omit to hide the PDF option — branded PDF export lands in M8. */
  onExportPdf?: () => Promise<void> | void;
  onExportCsv: () => Promise<void> | void;
  disabled?: boolean;
  isExporting?: boolean;
  label?: string;
}

export function ExportMenu({
  onExportPdf,
  onExportCsv,
  disabled,
  isExporting = false,
  label = 'Export',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const handleExport = async (action: () => Promise<void> | void) => {
    setOpen(false);
    await action();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div>
          <Button
            leftIcon={FileDown}
            size='m'
            disabled={disabled || isExporting}
          >
            {isExporting ? 'Exporting...' : label}
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='bg-white'>
        <DropdownMenuItem
          onClick={() => onExportPdf && void handleExport(onExportPdf)}
          disabled={disabled || isExporting || !onExportPdf}
          hidden={!onExportPdf}
          className='cursor-pointer'
        >
          {isExporting ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <FileDown className='mr-2 h-4 w-4' />
          )}
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleExport(onExportCsv)}
          disabled={disabled || isExporting}
          className='cursor-pointer'
        >
          {isExporting ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <FileSpreadsheet className='mr-2 h-4 w-4' />
          )}
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
