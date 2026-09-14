import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { formatCurrency } from '@core/money';

/**
 * `formatCurrency` takes KOBO. Every amount in the system is an integer in the
 * minor unit, and the formatter divides by 100 itself.
 *
 * Two dashboard screens divided by 100 first, so a ₦1,500 delivery fee showed
 * as ₦15.00 and "₦500 off" as "₦5.00 off". The stored values were right; the
 * danger was the merchant "correcting" what they saw — re-entering ₦150,000 and
 * charging every customer that. Worth a guard, because the mistake is the
 * natural one to make and nothing else catches it.
 */
describe('formatCurrency units', () => {
  it('formats kobo as naira', () => {
    expect(formatCurrency(150_000)).toBe('₦1,500.00');
  });

  it('is never called with an amount already divided by 100', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== 'generated' && entry !== '__tests__') walk(path);
        } else if (/\.tsx?$/.test(entry)) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (/formatCurrency\([^)]*\/\s*100\b/.test(line)) {
                offenders.push(`${path}:${i + 1}`);
              }
            });
        }
      }
    };
    walk(join(import.meta.dirname, '..', '..'));

    expect(offenders).toEqual([]);
  });
});
