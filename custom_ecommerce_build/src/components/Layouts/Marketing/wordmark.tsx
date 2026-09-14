import { cn } from '@/lib/utils';

import { BRAND } from '@/constant/marketing';

/**
 * The mark is a card reader with a receipt line — the transaction, not a
 * shopping bag. Drawn inline rather than shipped as a file so it recolors with
 * the surface it sits on and costs no request.
 */
export default function Wordmark({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const stroke = tone === 'light' ? '#FFFFFF' : 'currentColor';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5',
        tone === 'light' ? 'text-white' : 'text-forest-900',
        className,
      )}
    >
      <svg
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        aria-hidden='true'
        className='shrink-0'
      >
        <rect
          x='1.5'
          y='6.5'
          width='21'
          height='15'
          rx='2.5'
          stroke={stroke}
          strokeWidth='1.6'
        />
        <path d='M1.5 11.5h21' stroke={stroke} strokeWidth='1.6' />
        <circle cx='17.5' cy='16.5' r='1.6' className='fill-primary' />
      </svg>
      <span className='font-display text-[17px] font-bold tracking-[-0.02em] md:text-[19px]'>
        {BRAND.name}
      </span>
    </span>
  );
}
