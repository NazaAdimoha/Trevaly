'use client';

import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import React from 'react';
import {
  toast as sonnerToast,
  Toaster as SonnerProvider,
  ToasterProps,
} from 'sonner';

export function Toaster(props: ToasterProps) {
  return <SonnerProvider position='bottom-right' gap={8} {...props} />;
}

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Filled button, coloured to match the variant. */
  primaryAction?: ToastAction;
  /** Outlined/ghost button. */
  secondaryAction?: ToastAction;
}

interface VariantConfig {
  accent: string;
  iconBg: string;
  icon: React.ReactNode;
  primaryBtnClass: string;
}

const variantConfig: Record<ToastVariant, VariantConfig> = {
  default: {
    accent: 'border-l-grey-300',
    iconBg: 'bg-grey-100',
    icon: <Info className='text-grey-600 h-4 w-4' />,
    primaryBtnClass: 'bg-grey-700 text-white hover:bg-grey-900',
  },
  success: {
    accent: 'border-l-success-600',
    iconBg: 'bg-success-600',
    icon: <Check className='h-4 w-4 text-white' strokeWidth={2.5} />,
    primaryBtnClass: 'bg-success-600 text-white hover:bg-success-600/90',
  },
  warning: {
    accent: 'border-l-warning-500',
    iconBg: 'bg-warning-500',
    icon: <AlertTriangle className='h-4 w-4 text-white' strokeWidth={2.5} />,
    primaryBtnClass: 'bg-warning-500 text-white hover:bg-warning-500/90',
  },
  error: {
    accent: 'border-l-error-600',
    iconBg: 'bg-error-600',
    icon: <XCircle className='h-4 w-4 text-white' strokeWidth={2.5} />,
    primaryBtnClass: 'bg-error-600 text-white hover:bg-error-600/90',
  },
  info: {
    accent: 'border-l-info-600',
    iconBg: 'bg-info-600',
    icon: <Info className='h-4 w-4 text-white' strokeWidth={2.5} />,
    primaryBtnClass: 'bg-info-600 text-white hover:bg-info-600/90',
  },
};

function ToastCard({
  id,
  title,
  description,
  variant = 'default',
  primaryAction,
  secondaryAction,
}: ToastOptions & { id: string | number }) {
  const { accent, iconBg, icon, primaryBtnClass } = variantConfig[variant];
  const hasActions = !!(primaryAction || secondaryAction);

  return (
    <div
      className={[
        'flex w-full max-w-[400px] min-w-[320px] flex-col',
        'rounded-base border-grey-100 border border-l-4',
        accent,
        'shadow-btn bg-white px-4 py-4',
      ].join(' ')}
    >
      {/* Header row */}
      <div className='flex items-start gap-3'>
        {/* Icon circle */}
        <span
          className={[
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            iconBg,
          ].join(' ')}
        >
          {icon}
        </span>

        {/* Title + description */}
        <div className='flex min-w-0 flex-1 flex-col'>
          <p className='text-dark-100 text-sm font-semibold'>{title}</p>
          {description && (
            <p className='text-grey-600 mt-1 text-sm leading-snug'>
              {description}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          aria-label='Dismiss'
          className='text-grey-400 hover:text-grey-600 mt-0.5 ml-1 shrink-0'
          onClick={() => sonnerToast.dismiss(id)}
        >
          <X className='h-4 w-4' />
        </button>
      </div>

      {/* Action buttons */}
      {hasActions && (
        <div className='mt-4 flex gap-2 pl-10'>
          {primaryAction && (
            <button
              className={[
                'rounded-base px-4 py-1.5 text-sm font-medium transition-colors',
                primaryBtnClass,
              ].join(' ')}
              onClick={() => {
                primaryAction.onClick();
                sonnerToast.dismiss(id);
              }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              className='rounded-base border-grey-200 text-grey-700 hover:bg-grey-50 border bg-white px-4 py-1.5 text-sm font-medium transition-colors'
              onClick={() => {
                secondaryAction.onClick();
                sonnerToast.dismiss(id);
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function createToast(opts: ToastOptions, id?: string | number) {
  return sonnerToast.custom(
    (toastId) => <ToastCard id={toastId} {...opts} />,
    id !== undefined ? { id } : undefined,
  );
}

// ---------------------------------------------------------------------------
// Public API
//
// toast({ title, description?, variant?, primaryAction?, secondaryAction? })
// toast.success(title, { description?, primaryAction?, secondaryAction?, id? })
// toast.error / .warning / .info — same signature
// toast.loading(title, { description? })  — native sonner spinner
// toast.dismiss(id?)
// ---------------------------------------------------------------------------

type ExtraOpts = Omit<ToastOptions, 'title' | 'variant'> & {
  id?: string | number;
};

export const toast = Object.assign((opts: ToastOptions) => createToast(opts), {
  success: (title: string, opts?: ExtraOpts) =>
    createToast({ ...opts, title, variant: 'success' }, opts?.id),

  error: (title: string, opts?: ExtraOpts) =>
    createToast({ ...opts, title, variant: 'error' }, opts?.id),

  warning: (title: string, opts?: ExtraOpts) =>
    createToast({ ...opts, title, variant: 'warning' }, opts?.id),

  info: (title: string, opts?: ExtraOpts) =>
    createToast({ ...opts, title, variant: 'info' }, opts?.id),

  /** Uses the native sonner loading toast with its built-in spinner. */
  loading: (title: string, opts?: { description?: string }) =>
    sonnerToast.loading(title, opts),

  dismiss: sonnerToast.dismiss,
});
