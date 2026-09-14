/**
 * A drawn storefront, not a screenshot.
 *
 * The brief's strongest instruction about the hero is to show the product on a
 * phone rather than a stock photo. A screenshot would go stale the first time
 * the storefront changes; this is the same markup the real grid uses (square
 * image, name, price, sold-out marker) so it ages with the product instead.
 *
 * The product images are deliberate placeholders — flat silhouettes on tinted
 * grounds. Replace them with real photography from a seeded demo store before
 * this goes in front of a customer; nothing sells a garment like the garment.
 */

type Item = {
  name: string;
  price: string;
  ground: string;
  shape: 'dress' | 'bag' | 'slides' | 'wrap';
  soldOut?: boolean;
};

const ITEMS: Item[] = [
  {
    name: 'Ankara wrap dress',
    price: '₦24,500',
    ground: 'linear-gradient(150deg, #E9E2D8 0%, #DCD3C6 100%)',
    shape: 'dress',
  },
  {
    name: 'Raffia tote bag',
    price: '₦18,000',
    ground: 'linear-gradient(150deg, #DEE6E0 0%, #CDD9D1 100%)',
    shape: 'bag',
  },
  {
    name: 'Beaded slides',
    price: '₦12,000',
    ground: 'linear-gradient(150deg, #E7DFE7 0%, #D8CBD8 100%)',
    shape: 'slides',
  },
  {
    name: 'Silk headwrap',
    price: '₦8,500',
    ground: 'linear-gradient(150deg, #E6E3DA 0%, #D5D1C4 100%)',
    shape: 'wrap',
    soldOut: true,
  },
];

const SHAPES: Record<Item['shape'], React.ReactNode> = {
  dress: (
    <path d='M24 6h24l14 12-8 9-3-3v56H25V24l-3 3-8-9L24 6z' fill='#C9BEAC' />
  ),
  bag: (
    <path
      d='M10 52c6-22 16-34 30-34s24 12 30 34c-8 6-20 9-30 9s-22-3-30-9z'
      fill='#B9C7BE'
    />
  ),
  slides: (
    <path
      d='M8 44c10-4 14-16 22-16s12 8 22 8 14-10 22-10v18H8z'
      fill='#C7B6C7'
    />
  ),
  wrap: <rect x='14' y='10' width='42' height='56' rx='6' fill='#C4BFB0' />,
};

const VIEWBOX: Record<Item['shape'], string> = {
  dress: '0 0 72 86',
  bag: '0 0 80 70',
  slides: '0 0 84 60',
  wrap: '0 0 70 76',
};

export default function StorefrontPreview({
  columns = 4,
}: {
  /** 2 shows the top row only — used inside the narrow hero device frame. */
  columns?: 2 | 4;
}) {
  const items = columns === 2 ? ITEMS.slice(0, 2) : ITEMS;

  return (
    <div className='overflow-hidden rounded-lg bg-white'>
      <div className='border-paper-line flex items-center justify-between border-b px-4 py-3.5'>
        <div className='flex items-center gap-2'>
          <span
            className='flex size-[26px] items-center justify-center rounded-full text-[11px] font-semibold text-white'
            style={{ background: '#7A2E8C' }}
            aria-hidden='true'
          >
            AF
          </span>
          <span className='text-forest-900 text-sm font-semibold'>
            Adaobi Fashion
          </span>
        </div>
        <span className='relative inline-flex'>
          <svg
            width='20'
            height='20'
            viewBox='0 0 20 20'
            fill='none'
            aria-hidden='true'
          >
            <path
              d='M3 4h2l1.6 8.2a1.4 1.4 0 0 0 1.4 1.1h6.4a1.4 1.4 0 0 0 1.4-1.1L17 6.5H5.4'
              stroke='#0F2518'
              strokeWidth='1.4'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
            <circle cx='8.4' cy='16.4' r='1.1' fill='#0F2518' />
            <circle cx='14.4' cy='16.4' r='1.1' fill='#0F2518' />
          </svg>
          <span
            className='animate-soft-pulse absolute -top-1.5 -right-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white'
            style={{ background: '#7A2E8C' }}
          >
            2
          </span>
        </span>
      </div>

      <div className='grid grid-cols-2 gap-3 p-3.5'>
        {items.map((item) => (
          <div key={item.name}>
            <div
              className='relative flex aspect-square items-end justify-center overflow-hidden rounded-lg'
              style={{ background: item.ground }}
            >
              {item.soldOut && (
                <span className='bg-forest-900/80 absolute top-2 left-2 rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-white'>
                  SOLD OUT
                </span>
              )}
              <svg
                width='72'
                height='86'
                viewBox={VIEWBOX[item.shape]}
                fill='none'
                aria-hidden='true'
                className='h-auto w-[62%]'
              >
                {SHAPES[item.shape]}
              </svg>
            </div>
            <p
              className={`mt-2 text-[12.5px] leading-snug font-medium ${item.soldOut ? 'text-grey-500' : 'text-forest-900'}`}
            >
              {item.name}
            </p>
            <p
              className={`mt-0.5 text-[13px] font-semibold ${item.soldOut ? 'text-grey-500' : 'text-forest-900'}`}
            >
              {item.price}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
