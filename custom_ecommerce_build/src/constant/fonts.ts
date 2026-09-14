import localFont from 'next/font/local';

export const overusedGrotesk = localFont({
  src: [
    {
      path: '../app/fonts/OverusedGrotesk-Black.woff2',
      weight: '900',
      style: 'normal',
    },
    {
      path: '../app/fonts/OverusedGrotesk-ExtraBold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../app/fonts/OverusedGrotesk-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../app/fonts/OverusedGrotesk-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../app/fonts/OverusedGrotesk-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    // { path: '../app/fonts/OverusedGrotesk-Regular.woff2', weight: '500', style: 'normal' },
    {
      path: '../app/fonts/OverusedGrotesk-Book.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../app/fonts/OverusedGrotesk-Light.woff2',
      weight: '300',
      style: 'normal',
    },
  ],
  variable: '--font-overused-grotesk',
  display: 'swap',
});

export const nyghtSerif = localFont({
  src: [
    {
      path: '../app/fonts/NyghtSerif-Dark.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../app/fonts/NyghtSerif-Medium.woff',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../app/fonts/NyghtSerif-Regular.woff',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-nyght-serif',
  display: 'swap',
});

export const neueMontreal = localFont({
  src: [
    {
      path: '../app/fonts/NeueMontreal-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-neue-montreal',
  display: 'swap',
});
