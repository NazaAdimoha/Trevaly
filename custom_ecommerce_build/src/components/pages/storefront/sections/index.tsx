import type { Section } from '@core/storefront/layout';

import type { StorefrontProductCard } from '@/components/pages/storefront/home';

import { CategoryTilesSection } from './category-tiles';
import { CollectionRowSection } from './collection-row';
import { CountdownSection } from './countdown';
import { FaqSection } from './faq';
import { GallerySection } from './gallery';
import { HeroSection } from './hero';
import { ImageWithTextSection } from './image-with-text';
import { MarqueeSection } from './marquee';
import { NewsletterSection } from './newsletter';
import { PressSection } from './press';
import { PromoTilesSection } from './promo-tiles';
import { RichTextSection } from './rich-text';
import { TabbedProductsSection } from './tabbed-products';
import { TestimonialsSection } from './testimonials';

export type SectionCategory = { id: string; name: string; slug: string };

/**
 * Renders a page's sections, in the order the merchant arranged them.
 *
 * Three rules, all about never showing a shopper a broken shop:
 *
 *  - a section type this build does not know is SKIPPED, not thrown. An app on
 *    a newer release can write a section a deployed storefront has not shipped
 *    yet, and losing that one block is survivable where a white page is not.
 *  - a hidden section renders nothing at all, rather than rendering hidden —
 *    invisible markup still costs images, requests and layout.
 *  - every section reads from the catalogue the PAGE fetched. Eight sections
 *    that each fetch their own products is eight round trips for one page.
 */
export function SectionRenderer({
  sections,
  products,
  categories,
  storeName,
}: {
  sections: Section[];
  products: StorefrontProductCard[];
  categories: SectionCategory[];
  storeName: string;
}) {
  /** Products in a collection, by slug or id — the editor may store either. */
  const inCollection = (collection: unknown): StorefrontProductCard[] => {
    if (typeof collection !== 'string' || !collection) return products;
    const category = categories.find(
      (item) => item.slug === collection || item.id === collection,
    );
    if (!category) return products;
    return products.filter((product) => product.categoryId === category.id);
  };

  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => {
          const settings = section.settings as Record<string, never>;

          switch (section.type) {
            case 'hero':
              return <HeroSection key={section.id} settings={settings} products={products} />;

            case 'collection-row':
              return (
                <CollectionRowSection
                  key={section.id}
                  settings={settings}
                  products={inCollection(section.settings.collection)}
                  storeName={storeName}
                />
              );

            case 'tabbed-products':
              return (
                <TabbedProductsSection
                  key={section.id}
                  settings={settings}
                  productsByTab={(
                    (section.settings.tabs as { collection?: string }[] | undefined) ?? []
                  ).map((tab) => inCollection(tab.collection))}
                  storeName={storeName}
                />
              );

            case 'category-tiles':
              return <CategoryTilesSection key={section.id} settings={settings} />;

            case 'promo-tiles':
              return <PromoTilesSection key={section.id} settings={settings} />;

            case 'countdown':
              return <CountdownSection key={section.id} settings={settings} />;

            case 'marquee':
              return <MarqueeSection key={section.id} settings={settings} />;

            case 'image-with-text':
              return <ImageWithTextSection key={section.id} settings={settings} />;

            case 'rich-text':
              return <RichTextSection key={section.id} settings={settings} />;

            case 'press':
              return <PressSection key={section.id} settings={settings} />;

            case 'testimonials':
              return <TestimonialsSection key={section.id} settings={settings} />;

            case 'gallery':
              return (
                <GallerySection key={section.id} settings={settings} products={products} />
              );

            case 'faq':
              return <FaqSection key={section.id} settings={settings} />;

            case 'newsletter':
              return <NewsletterSection key={section.id} settings={settings} />;

            default:
              return null;
          }
        })}
    </>
  );
}
