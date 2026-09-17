import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class names, merged so a later Tailwind utility wins over an earlier one.
 *
 * Its own module, not part of `@/lib/utils`, and that is a performance
 * decision rather than tidiness: `utils` also exports date helpers, so it
 * imports `date-fns`. Because a bundler follows the module, every storefront
 * component that wanted `cn` was dragging ~40KB of date formatting into a page
 * that never shows a date. Importing the leaf directly is what keeps it out.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
