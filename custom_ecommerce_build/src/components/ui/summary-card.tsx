'use client';

import React, { useId, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface SummaryCardItem {
  label: React.ReactNode;
  value: React.ReactNode;
}

interface SummaryCardProps {
  title: React.ReactNode;
  headerAction?: React.ReactNode;
  items?: SummaryCardItem[];
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  collapsibleId?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function SummaryCard({
  title,
  headerAction,
  items,
  children,
  collapsible = false,
  defaultOpen = true,
  collapsibleId,
  className,
  headerClassName,
  contentClassName,
  labelClassName,
  valueClassName,
}: SummaryCardProps) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const hasContent = hasItems || Boolean(children);
  const generatedAccordionId = useId();
  const accordionValue = collapsibleId || generatedAccordionId;
  const [openValue, setOpenValue] = useState<string | undefined>(
    defaultOpen ? accordionValue : undefined,
  );
  const isOpen = openValue === accordionValue;

  const content = (
    <>
      {hasItems ? (
        <div
          className={cn('grid grid-cols-5 gap-3 p-4 text-sm', contentClassName)}
        >
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <p className={cn('text-grey-700 col-span-2', labelClassName)}>
                {item.label}:
              </p>
              <div
                className={cn(
                  'text-dark-100 col-span-3 font-medium',
                  valueClassName,
                )}
              >
                {item.value}
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {children ? (
        <div className={cn('col-span-5 p-4', contentClassName)}>{children}</div>
      ) : null}
    </>
  );

  if (!collapsible || !hasContent) {
    return (
      <section
        className={cn(
          'rounded-base border-grey-100 border bg-white',
          className,
        )}
      >
        <div
          className={cn(
            'bg-grey-50/35 p-4',
            headerAction && 'flex flex-wrap items-center justify-between gap-3',
            headerClassName,
          )}
        >
          <p className='text-grey-700 text-xs font-medium uppercase'>{title}</p>
          {headerAction ? <div>{headerAction}</div> : null}
        </div>

        {content}
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-base border-grey-100 border bg-white',
        isOpen ? 'self-stretch' : 'self-start',
        className,
      )}
    >
      <Accordion
        type='single'
        collapsible
        value={openValue}
        onValueChange={(value) => setOpenValue(value || undefined)}
      >
        <AccordionItem value={accordionValue} className='border-b-0'>
          <AccordionTrigger
            className={cn(
              'bg-grey-50/35 text-grey-700 [&>svg]:text-grey-500 p-4 text-left text-xs font-medium uppercase hover:no-underline',
              headerClassName,
            )}
          >
            {title}
          </AccordionTrigger>
          <AccordionContent className='p-0'>{content}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
