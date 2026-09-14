import { cva } from 'class-variance-authority';
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'default'
  | 'ghost'
  | 'destructiveLight';
export const buttonVariants = cva(
  'flex w-fit cursor-pointer font-primary items-center rounded font-medium text-base shadow-btn transition-all duration-200 ease-in focus:outline-none focus-visible:ring focus-visible:ring-primary-500 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white border border-primary hover:bg-primary-600 hover:border-primary-600 disabled:bg-primary-200 disabled:border-primary-200',
        outline:
          'bg-white text-primary border border-primary hover:bg-primary hover:text-white disabled:bg-primary-200 disabled:border-primary-200 disabled:text-primary/50',
        secondary:
          'bg-grey-100 text-grey-600 border border-grey-100 hover:bg-grey-200 hover:border-grey-200 disabled:bg-grey-50 disabled:border-grey-50',
        destructive:
          'bg-error-600 text-white  hover:opacity-75 disabled:bg-error-600/60 disabled:border-error-600/50',
        destructiveLight:
          'bg-error-50 text-error-400 border border-error-200 hover:opacity-75 disabled:bg-white/60 disabled:border-error/50 disabled:text-error/50',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        default:
          'bg-white text-grey-700 border border-grey-100 hover:bg-grey-05 hover:border-grey-100 disabled:bg-white/60 disabled:border-grey-100',
      },
      size: {
        xs: 'px-3 py-1  text-sm h-7',
        s: 'px-3.5 py-2 text-sm h-9',
        m: 'px-4 py-2.5 text-sm h-10',
        l: 'px-4.2 py-2.5 text-base h-11',
        xl: 'px-5 py-3 text-base h-12',
        icon: 'h-9 w-9',
      },
      isLoading: {
        true: 'relative text-transparent hover:text-transparent disabled:cursor-wait',
        false: '',
      },
      fullWidth: {
        true: 'w-full justify-center',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'm',
    },
  },
);

export const iconButtonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center rounded font-medium shadow-btn transition-all duration-200 ease-in focus:outline-none focus-visible:ring focus-visible:ring-primary-500 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white border border-primary hover:bg-primary-600 hover:border-primary-600 disabled:bg-primary-200 disabled:border-primary-200',
        outline:
          'bg-white text-primary border border-primary hover:bg-primary hover:text-white disabled:bg-primary-200 disabled:border-primary-200 disabled:text-primary/50',
        secondary:
          'bg-grey-100 text-grey-600 border border-grey-100 hover:bg-grey-200 hover:border-grey-200 disabled:bg-grey-50 disabled:border-grey-50',
        destructive:
          'bg-error-600 text-white border border-error-600 hover:bg-error-700 hover:border-error-700 disabled:bg-error-600/60 disabled:border-error-600/50',
        default:
          'bg-white text-grey-700 border border-grey-100 hover:bg-grey-05 hover:border-grey-100 disabled:bg-white/60 disabled:border-grey-100',
        plain:
          'bg-transparent text-dark-100 border-none hover:bg-transparent hover:text-primary shadow-none',
      },
      size: {
        xs: 'w-7 h-7 p-1 text-sm',
        s: 'w-9 h-9 p-2 text-sm',
        m: 'w-10 h-10 p-2.5 text-base',
        l: 'w-11 h-11 p-2.5 text-lg',
        xl: 'w-12 h-12 p-3 text-xl',
        plain: 'w-auto h-auto p-0',
      },
      isLoading: {
        true: 'relative text-transparent hover:text-transparent disabled:cursor-wait',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'm',
    },
  },
);

export const buttonLinkVariants = cva(
  'inline-flex cursor-pointer font-primary items-center rounded font-medium shadow-btn transition-all duration-200 ease-in focus:outline-none focus-visible:ring focus-visible:ring-primary-500 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white border border-primary hover:bg-primary-600 hover:border-primary-600 disabled:bg-primary-200 disabled:border-primary-200',
        outline:
          'bg-white text-primary border border-primary hover:bg-primary hover:text-white disabled:bg-primary-200 disabled:border-primary-200 disabled:text-primary/50',
        secondary:
          'bg-grey-100 text-grey-600 border border-grey-100 hover:bg-grey-200 hover:border-grey-200 disabled:bg-grey-50 disabled:border-grey-50',
        destructive:
          'bg-error-600 text-white border border-error-600 hover:bg-error-700 hover:border-error-700 disabled:bg-error-600/60 disabled:border-error-600/50',
        default:
          'bg-white text-grey-700 border border-grey-100 hover:bg-grey-05 hover:border-grey-100 disabled:bg-white/60 disabled:border-grey-100',
      },
      size: {
        xs: 'px-3 py-1  text-sm h-7',
        s: 'px-3.5 py-2 text-sm h-9',
        m: 'px-4 py-2.5 text-sm h-10',
        l: 'px-4.2 py-2.5 text-base h-11',
        xl: 'px-5 py-3 text-base h-12',
      },
      fullWidth: {
        true: 'w-full justify-center',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'm',
    },
  },
);

export type FieldSize = 'sm' | 'lg';
export type FieldState = 'default' | 'error' | 'success';

export const fieldContainerVariants = cva(
  'flex w-full items-center border text-sm transition-colors rounded-xs bg-grey-50/15',
  {
    variants: {
      fieldSize: {
        sm: 'h-10 p-3',
        lg: 'h-16 px-4 py-5',
      },
      state: {
        default:
          'border-grey-50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        error:
          'border-error-200 focus-within:border-error-200 focus-within:ring-2 focus-within:ring-error-600/20',
        success:
          'border-success-200 focus-within:border-success-200 focus-within:ring-2 focus-within:ring-success-600/20',
      },
    },
    defaultVariants: {
      fieldSize: 'sm',
      state: 'default',
    },
  },
);

export const fieldInputVariants = cva(
  'min-w-0 flex-1 border-0 p-0 outline-0 active:outline-none bg-transparent text-sm placeholder:text-sm placeholder:font-normal placeholder:text-grey-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed [&:-webkit-autofill]:shadow-[0_0_0px_1000px_white_inset]',
  {
    variants: {
      fieldSize: {
        sm: '',
        lg: '',
      },
    },
    defaultVariants: { fieldSize: 'sm' },
  },
);

export const iconLinkVariants = cva(
  'inline-flex cursor-pointer items-center justify-center rounded font-medium shadow-btn transition-all duration-200 ease-in focus:outline-none focus-visible:ring focus-visible:ring-primary-500 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white border border-primary hover:bg-primary-600 hover:border-primary-600 disabled:bg-primary-200 disabled:border-primary-200',
        secondary:
          'bg-grey-100 text-grey-600 border border-grey-100 hover:bg-grey-200 hover:border-grey-200 disabled:bg-grey-50 disabled:border-grey-50',
        destructive:
          'bg-error-600 text-white border border-error-600 hover:bg-error-700 hover:border-error-700 disabled:bg-error-600/60 disabled:border-error-600/50',
        default:
          'bg-white text-grey-700 border border-grey-100 hover:bg-grey-05 hover:border-grey-100 disabled:bg-white/60 disabled:border-grey-100',
        plain:
          'bg-transparent text-dark-100 border-none hover:bg-transparent hover:text-primary shadow-none',
      },
      size: {
        xs: 'w-7 h-7 p-1 text-sm',
        s: 'w-9 h-9 p-2 text-sm',
        m: 'w-10 h-10 p-2.5 text-base',
        l: 'w-11 h-11 p-2.5 text-lg',
        xl: 'w-12 h-12 p-3 text-xl',
        plain: 'w-auto h-auto p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'm',
    },
  },
);
