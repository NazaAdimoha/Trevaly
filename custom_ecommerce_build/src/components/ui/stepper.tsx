'use client';

import { Check } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

type StepStatus = 'completed' | 'active' | 'pending';

function getStatus(index: number, currentStep: number): StepStatus {
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'active';
  return 'pending';
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((label, index) => {
        const status = getStatus(index, currentStep);
        const isLast = index === steps.length - 1;

        return (
          <li key={label} className='flex'>
            <div className='mr-3 flex flex-col items-center'>
              <div
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  status === 'completed' &&
                    'border-primary bg-primary text-white',
                  status === 'active' && 'border-primary text-primary bg-white',
                  status === 'pending' &&
                    'border-grey-200 text-grey-300 bg-white',
                )}
              >
                {status === 'completed' ? (
                  <Check className='h-4 w-4' strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      'h-full flex-grow rounded-full',
                      status === 'active' && 'bg-primary-50/50',
                      status === 'pending' && 'bg-white',
                    )}
                  />
                )}
              </div>

              {!isLast && <div className='bg-grey-100 h-10 w-0.5 flex-1' />}
            </div>

            <div className={cn('flex flex-col', !isLast && 'pb-6')}>
              <span
                className={cn(
                  'flex items-center text-sm font-normal',
                  status === 'active' && 'text-primary-700 font-medium',
                  status === 'completed' && 'text-grey-600',
                  status === 'pending' && 'text-grey-600',
                )}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
