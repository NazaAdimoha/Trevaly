import { Facebook, Instagram, MessageCircle, Music2, Twitter, Youtube } from 'lucide-react';
import type { ComponentType } from 'react';

import type { StorefrontLayout } from '@core/storefront/layout';

/**
 * Social links, in the order the merchant listed them.
 *
 * TikTok has no Lucide icon, so it borrows the music mark — which is what the
 * app already does. An accurate label matters more than an exact glyph here:
 * the accessible name is the platform's real name either way.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  x: Twitter,
  youtube: Youtube,
  whatsapp: MessageCircle,
};

export function SocialIcons({ socials }: { socials: StorefrontLayout['footer']['socials'] }) {
  return (
    <ul className='flex items-center gap-2'>
      {socials.map((social) => {
        const Icon = ICONS[social.platform] ?? MessageCircle;
        return (
          <li key={social.platform + social.href}>
            <a
              href={social.href}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={social.platform}
              className='st-control flex size-9 items-center justify-center transition-opacity hover:opacity-60'
              style={{ border: '1px solid var(--st-line)' }}
            >
              <Icon className='size-4' />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
