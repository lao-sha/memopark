import React from 'react';
import type { FC, ReactNode, SVGProps } from 'react';
import { theme } from './theme';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

type ButtonVariant = 'primary' | 'secondary' | 'memorial' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: FC<SVGProps<SVGSVGElement>>;
  iconLeft?: FC<SVGProps<SVGSVGElement>>;
  iconRight?: FC<SVGProps<SVGSVGElement>>;
  children?: ReactNode;
  glassmorphism?: boolean;
}

const getVariantStyles = (variant: ButtonVariant, disabled: boolean, glassmorphism: boolean): string => {
  if (disabled) {
    return classNames(
      'bg-gray-600 text-gray-400 cursor-not-allowed',
      'border border-gray-600'
    );
  }

  const baseGlass = glassmorphism ? 'backdrop-blur-md border' : '';

  switch (variant) {
    case 'primary':
      return classNames(
        glassmorphism 
          ? 'bg-blue-500/20 border-blue-400/30 text-blue-100 hover:bg-blue-500/30 hover:border-blue-400/50'
          : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
        'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        baseGlass
      );
    
    case 'memorial':
      return classNames(
        glassmorphism
          ? 'bg-purple-500/20 border-purple-400/30 text-purple-100 hover:bg-purple-500/30 hover:border-purple-400/50'
          : 'bg-purple-600 hover:bg-purple-700 text-white border-transparent',
        'focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        baseGlass
      );
    
    case 'secondary':
      return classNames(
        glassmorphism
          ? 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30'
          : 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600',
        'focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        baseGlass
      );
    
    case 'ghost':
      return classNames(
        glassmorphism
          ? 'bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/30'
          : 'bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white',
        'focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        'border'
      );
    
    case 'danger':
      return classNames(
        glassmorphism
          ? 'bg-red-500/20 border-red-400/30 text-red-100 hover:bg-red-500/30 hover:border-red-400/50'
          : 'bg-red-600 hover:bg-red-700 text-white border-transparent',
        'focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        baseGlass
      );
    
    default:
      return '';
  }
};

const getSizeStyles = (size: ButtonSize): string => {
  switch (size) {
    case 'sm':
      return 'px-3 py-1.5 text-sm gap-1.5';
    case 'lg':
      return 'px-6 py-3 text-lg gap-3';
    case 'md':
    default:
      return 'px-4 py-2 text-base gap-2';
  }
};

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconLeft: IconLeft,
  iconRight: IconRight,
  children,
  className,
  glassmorphism = false,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={classNames(
        // Base styles
        'inline-flex items-center justify-center',
        'font-medium rounded-lg border',
        'transition-all duration-200 ease-in-out',
        'focus:outline-none active:scale-95',
        
        // Size styles
        getSizeStyles(size),
        
        // Variant styles
        getVariantStyles(variant, isDisabled, glassmorphism),
        
        // Width
        fullWidth ? 'w-full' : '',
        
        // Custom className
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {IconLeft && !loading && <IconLeft className="w-5 h-5" />}
      {Icon && !IconLeft && !loading && <Icon className="w-5 h-5" />}
      
      {children && <span>{children}</span>}
      
      {IconRight && <IconRight className="w-5 h-5" />}
    </button>
  );
};

// Specialized button variants for common use cases
export const ConnectWalletButton: FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" glassmorphism {...props} />
);

export const MemorialButton: FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="memorial" glassmorphism {...props} />
);

export const PrimaryButton: FC<ButtonProps> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: FC<ButtonProps> = (props) => (
  <Button variant="secondary" {...props} />
);

export const DangerButton: FC<ButtonProps> = (props) => (
  <Button variant="danger" {...props} />
);
