'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  activeVariants,
  hasVariants,
  variantLabel,
  type VariantLike,
  variantPriceKobo,
} from '@core/variants';

import { useCart } from '@/lib/store/cart';
import { useTenant } from '@/lib/tenant-context';
import { cn, formatCurrency } from '@/lib/utils';

import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';
import { themeConfig } from '@/constant/storefront-themes';

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  optionName: string | null;
  imageUrls: string[];
  variants: VariantLike[];
};

export default function ProductDetailView({ product }: { product: Product }) {
  const router = useRouter();
  const tenant = useTenant();
  const theme = themeConfig(tenant.theme);
  const addItem = useCart((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);

  const options = activeVariants(product);
  const sellsByVariant = hasVariants(product);

  // Preselect when there is only one live option — making someone click the
  // single available size to enable a button is friction for nothing.
  const [selectedId, setSelectedId] = useState<string | null>(
    options.length === 1 ? (options[0]?.id ?? null) : null,
  );
  const selected = options.find((v) => v.id === selectedId) ?? null;

  const stock = sellsByVariant ? (selected?.stock ?? 0) : product.stock;
  const priceKobo = variantPriceKobo(product, selected);
  // Every live option is gone, versus one option being gone.
  const everythingSoldOut = sellsByVariant
    ? options.every((v) => v.stock <= 0)
    : product.stock <= 0;
  const mustChoose = sellsByVariant && !selected;
  const outOfStock = everythingSoldOut || (!mustChoose && stock <= 0);
  const [cover] = product.imageUrls;

  const handleAdd = (goToCart: boolean) => {
    addItem(
      {
        productId: product.id,
        variantId: selected?.id ?? null,
        variantLabel: selected
          ? variantLabel(product.optionName, selected.value)
          : null,
        name: product.name,
        slug: product.slug,
        imageUrl: cover ?? null,
        unitPriceKobo: priceKobo,
        maxStock: stock,
      },
      quantity,
    );
    toast.success(
      selected
        ? `${product.name} (${selected.value}) added to cart`
        : `${product.name} added to cart`,
    );
    if (goToCart) router.push(STOREFRONT_ROUTES.cart);
  };

  return (
    <div className='st-section mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2'>
      {/* Same well as the grid, so a portrait garment stays portrait from the
          catalogue through to here rather than changing shape on click. */}
      <div className='st-media'>
        {cover ? (
          <ProductImage
            src={cover}
            alt={product.name}
            sizes={theme.detailImageSizes}
            // Above the fold on the page a shopper lands on from search.
            priority
            className='object-cover'
          />
        ) : null}
      </div>

      <div>
        <h1
          className='text-2xl font-semibold'
          style={{
            textTransform: 'var(--st-name-transform)' as 'none',
            letterSpacing: 'var(--st-name-tracking)',
          }}
        >
          {product.name}
        </h1>
        {theme.showSku && product.sku ? (
          <p className='mt-1 font-mono text-xs text-gray-400'>{product.sku}</p>
        ) : null}
        {/* Deliberately the theme's price colour, not `--brand`: an unreviewed
            tenant hex has to stay legible, and the price is the one number a
            shopper must be able to read on any store. */}
        <p
          className='mt-2 text-xl'
          style={{
            color: 'var(--st-price-color)',
            fontWeight: 'var(--st-price-weight)' as unknown as number,
          }}
        >
          {formatCurrency(priceKobo)}
        </p>

        {sellsByVariant ? (
          <fieldset className='mt-6'>
            <legend className='text-sm font-medium'>
              {product.optionName ?? 'Option'}
              {mustChoose ? (
                <span className='ml-2 text-xs font-normal text-gray-500'>
                  Choose one
                </span>
              ) : null}
            </legend>
            <div className='mt-3 flex flex-wrap gap-2'>
              {options.map((option) => {
                const gone = option.stock <= 0;
                const active = option.id === selectedId;

                return (
                  <button
                    key={option.id}
                    type='button'
                    disabled={gone}
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedId(option.id);
                      setQuantity(1);
                    }}
                    className={cn(
                      'st-control min-h-11 border px-4 py-2 text-sm transition-colors',
                      gone &&
                        'cursor-not-allowed text-gray-400 line-through decoration-gray-300',
                      !gone && active && 'border-transparent text-white',
                      !gone &&
                        !active &&
                        'border-gray-300 hover:border-gray-900',
                    )}
                    style={
                      !gone && active
                        ? { backgroundColor: 'var(--brand)' }
                        : undefined
                    }
                  >
                    {option.value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {everythingSoldOut ? (
          <p className='mt-4 text-sm font-medium text-red-600'>Out of stock</p>
        ) : mustChoose ? null : stock <= 5 ? (
          <p className='mt-4 text-sm text-amber-600'>Only {stock} left</p>
        ) : null}

        {product.description ? (
          <p className='mt-6 text-sm whitespace-pre-wrap text-gray-700'>
            {product.description}
          </p>
        ) : null}

        <div className='mt-8 flex items-center gap-3'>
          <label htmlFor='quantity' className='text-sm'>
            Qty
          </label>
          <input
            id='quantity'
            type='number'
            min={1}
            max={Math.max(stock, 1)}
            value={quantity}
            disabled={outOfStock || mustChoose}
            onChange={(e) =>
              setQuantity(
                Math.max(1, Math.min(Number(e.target.value) || 1, stock)),
              )
            }
            className='st-control w-20 border px-3 py-2 text-sm disabled:bg-gray-100'
          />
        </div>

        <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <button
            type='button'
            disabled={outOfStock || mustChoose}
            onClick={() => handleAdd(false)}
            className='st-control border px-6 py-3 text-sm font-medium disabled:opacity-50'
          >
            Add to cart
          </button>
          <button
            type='button'
            disabled={outOfStock || mustChoose}
            onClick={() => handleAdd(true)}
            className='st-control px-6 py-3 text-sm font-medium text-white disabled:opacity-50'
            style={{ backgroundColor: 'var(--brand)' }}
          >
            Buy now
          </button>
        </div>

        {mustChoose && !everythingSoldOut ? (
          <p className='mt-3 text-sm text-gray-500'>
            Pick a {(product.optionName ?? 'option').toLowerCase()} to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}
