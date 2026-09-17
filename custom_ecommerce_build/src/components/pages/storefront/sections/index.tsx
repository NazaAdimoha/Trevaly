import type { Section } from '@core/storefront/layout';

import type { StorefrontProductCard } from '@/components/pages/storefront/home';

import { CollectionRowSection } from './collection-row';
import { RichTextSection } from './rich-text';

/**
 * Renders a page's sections, in the order the merchant arranged them.
 *
 * Two rules, both about never showing a shopper a broken shop:
 *
 *  - a section type this build does not know is SKIPPED, not thrown. An app on
 *    a newer release can write a section a deployed storefront has not shipped
 *    yet, and losing that one block is survivable where a white page is not.
 *  - a hidden section renders nothing at all, rather than rendering hidden —
 *    invisible markup still costs images, requests and layout.
 */
export function SectionRenderer({
  sections,
  products,
  storeName,
}: {
  sections: Section[];
  /** The catalogue the page already fetched; sections filter it, not refetch it. */
  products: StorefrontProductCard[];
  storeName: string;
}) {
  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => {
          switch (section.type) {
            case 'collection-row':
              return (
                <CollectionRowSection
                  key={section.id}
                  settings={section.settings}
                  products={products}
                  storeName={storeName}
                />
              );
            case 'rich-text':
              return <RichTextSection key={section.id} settings={section.settings} />;
            default:
              return null;
          }
        })}
    </>
  );
}
