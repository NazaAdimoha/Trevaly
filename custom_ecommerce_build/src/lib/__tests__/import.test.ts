import { describe, expect, it } from 'vitest';

import { parseCsv, parseCsvRecords, toCsv } from '@core/csv';
import {
  buildImportPreview,
  parseMoneyToKobo,
  parseVariantSpec,
  slugifyProduct,
} from '@core/validation/import';

describe('csv parsing', () => {
  it('keeps commas inside quoted fields', () => {
    // The bug a naive split produces: this description becomes three columns
    // and every field after it shifts.
    expect(parseCsv('name,description\nDress,"Red, blue, and gold"')).toEqual([
      ['name', 'description'],
      ['Dress', 'Red, blue, and gold'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"She said ""hi"""')).toEqual([
      ['a'],
      ['She said "hi"'],
    ]);
  });

  it('keeps newlines inside quoted fields', () => {
    const rows = parseCsv('name,desc\nWrap,"line one\nline two"');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[1]).toBe('line one\nline two');
  });

  it('handles CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips the BOM Excel writes, so the first header still matches', () => {
    const { records } = parseCsvRecords('\uFEFFname,price\nDress,100');
    expect(records[0]?.name).toBe('Dress');
  });

  it('normalises header casing and spacing', () => {
    const { records } = parseCsvRecords('Product Name,Price (NGN)\nDress,100');
    expect(records[0]?.productname).toBe('Dress');
  });

  it('round-trips through toCsv', () => {
    const rows = [
      ['name', 'desc'],
      ['Dress', 'Red, "bold", and gold'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('money parsing', () => {
  it('accepts the ways a merchant actually types a price', () => {
    expect(parseMoneyToKobo('25000')).toBe(2_500_000);
    expect(parseMoneyToKobo('₦25,000')).toBe(2_500_000);
    expect(parseMoneyToKobo('25,000.50')).toBe(2_500_050);
    expect(parseMoneyToKobo(' 25000 ')).toBe(2_500_000);
  });

  it('rejects anything that is not a positive amount', () => {
    expect(parseMoneyToKobo('')).toBeNull();
    expect(parseMoneyToKobo('free')).toBeNull();
    expect(parseMoneyToKobo('0')).toBeNull();
  });
});

describe('variant spec', () => {
  it('reads value=stock pairs', () => {
    const { variants, error } = parseVariantSpec('S=4;M=6;L=3');
    expect(error).toBeNull();
    expect(variants).toEqual([
      { value: 'S', stock: 4, priceKobo: null },
      { value: 'M', stock: 6, priceKobo: null },
      { value: 'L', stock: 3, priceKobo: null },
    ]);
  });

  it('reads an @price override', () => {
    const { variants } = parseVariantSpec('XL=2@28000');
    expect(variants[0]).toEqual({
      value: 'XL',
      stock: 2,
      priceKobo: 2_800_000,
    });
  });

  it('rejects a duplicated option rather than silently dropping one', () => {
    expect(parseVariantSpec('S=1;s=2').error).toMatch(/twice/i);
  });

  it('rejects a non-integer stock', () => {
    expect(parseVariantSpec('S=2.5').error).toMatch(/whole-number/i);
  });
});

describe('import preview', () => {
  const headers = 'name,price,stock,category,option,variants';

  const preview = (body: string, existing: string[] = []) =>
    buildImportPreview(
      parseCsvRecords(`${headers}\n${body}`).records,
      existing,
    );

  it('maps a plain row', () => {
    const { rows, errors } = preview('Silk Wrap,8500,25,,,');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: 'Silk Wrap',
      slug: 'silk-wrap',
      priceKobo: 850_000,
      stock: 25,
      variants: [],
    });
  });

  it('zeroes product stock when the row has options', () => {
    // Stock lives on the variant once options exist; keeping the column value
    // would leave two numbers disagreeing about the same product.
    const { rows } = preview('Dress,25000,99,Dresses,Size,S=4;M=6');
    expect(rows[0]?.stock).toBe(0);
    expect(rows[0]?.optionName).toBe('Size');
    expect(rows[0]?.variants).toHaveLength(2);
  });

  it('flags options with no option name', () => {
    const { errors } = preview('Dress,25000,,,,S=4;M=6');
    expect(errors[0]?.message).toMatch(/option/i);
  });

  it('reports the row number a human would see', () => {
    // Header is row 1, so the first data row is row 2.
    const { errors } = preview(',25000,,,,');
    expect(errors[0]?.row).toBe(2);
  });

  it('catches two rows that would collide on the same web address', () => {
    const { errors, rows } = preview(
      'Ankara Dress,25000,1,,,\nankara  dress,30000,1,,,',
    );
    expect(rows).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/clashes with row 2/);
  });

  it('lists only categories that do not exist yet', () => {
    const { newCategories } = preview('A,100,1,Dresses,,\nB,100,1,Bags,,', [
      'Dresses',
    ]);
    expect(newCategories).toEqual(['Bags']);
  });

  it('takes only https image links', () => {
    const { records } = parseCsvRecords(
      'name,price,images\nA,100,"https://a.test/1.jpg|http://insecure.test/2.jpg"',
    );
    const { rows } = buildImportPreview(records, []);
    expect(rows[0]?.imageUrls).toEqual(['https://a.test/1.jpg']);
  });

  it('rejects a row with no readable price rather than importing it free', () => {
    const { rows, errors } = preview('Mystery Item,,5,,,');
    expect(rows).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/price/i);
  });
});

describe('product slugs', () => {
  it('strips punctuation and collapses spaces', () => {
    expect(slugifyProduct("Adaobi's  Ankara Dress!")).toBe(
      'adaobi-s-ankara-dress',
    );
  });
});
