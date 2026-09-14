'use client';

import { ArrowLeft } from 'lucide-react';
import React from 'react';

/**
 * Client, purely so the icon stays on this side of the boundary.
 *
 * `IconLink` is a client component, so a Server Component rendering
 * `<IconLink icon={ArrowLeft} />` tries to serialize a function and throws.
 * Marking this file client means `ArrowLeft` is created here and never
 * crosses — server parents still pass only strings.
 */
import { cn } from '@/lib/utils';

import IconLink from '@/components/links/IconLink';

interface IPageHeaderProps {
  title: string;
  description?: string;
  url?: string;
}
const PageHeader = ({ title, description, url }: IPageHeaderProps) => {
  return (
    <div className='flex flex-col'>
      <div className='flex items-center'>
        {url && (
          <IconLink
            icon={ArrowLeft}
            href={url}
            variant='plain'
            size='plain'
            className='mr-2 text-2xl font-medium'
          />
        )}
        <h1 className='text-dark-100 text-2xl font-semibold'>{title}</h1>
      </div>
      {description && (
        <p className={cn('text-grey-500 text-sm', url && 'ml-8')}>
          {description}
        </p>
      )}
    </div>
  );
};
export default PageHeader;
