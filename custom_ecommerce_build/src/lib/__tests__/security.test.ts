import { describe, expect, it } from 'vitest';

import { isOwnedBy, tenantUploadFolders } from '@core/media/folder';
import { maskEmail } from '@core/validation/store-settings';

describe('maskEmail', () => {
  it('keeps the first and last letter and the whole domain', () => {
    expect(maskEmail('adaobi@gmail.com')).toBe('a•••i@gmail.com');
  });

  it('does not expose a short local part', () => {
    expect(maskEmail('ab@gmail.com')).toBe('a•••@gmail.com');
    expect(maskEmail('a@gmail.com')).toBe('a•••@gmail.com');
  });

  it('never returns anything useful for a malformed address', () => {
    expect(maskEmail('not-an-email')).toBe('•••');
    expect(maskEmail('@gmail.com')).toBe('•••');
  });

  // The whole point: nothing that survives may reconstruct the address.
  it('hides the middle of a long local part', () => {
    const masked = maskEmail('averylongcustomername@example.com');
    expect(masked).not.toContain('verylongcustomernam');
    expect(masked).toBe('a•••e@example.com');
  });
});

describe('upload folder ownership', () => {
  it('accepts both of a store’s own folders', () => {
    for (const folder of tenantUploadFolders('adaobi-store')) {
      expect(isOwnedBy(`${folder}/abc123`, 'adaobi-store')).toBe(true);
    }
  });

  it('rejects another store’s asset', () => {
    expect(isOwnedBy('tenants/chidi-electronics/branding/x', 'adaobi-store')).toBe(
      false,
    );
  });

  // Regression: a prefix check without the trailing separator would let
  // "adaobi-store-evil" pass as "adaobi-store".
  it('is not fooled by a store slug that starts with another', () => {
    expect(isOwnedBy('tenants/adaobi-store-evil/products/x', 'adaobi-store')).toBe(
      false,
    );
  });

  it('rejects a path escaping the tenants root', () => {
    expect(isOwnedBy('../../secrets/key', 'adaobi-store')).toBe(false);
    expect(isOwnedBy('tenants/../adaobi-store/products/x', 'adaobi-store')).toBe(
      false,
    );
  });
});
