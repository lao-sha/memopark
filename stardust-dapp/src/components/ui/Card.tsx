import React from 'react';
import type { FC, ReactNode } from 'react';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export interface CardProps {
  children: ReactNode;
  className?: string;
  glassmorphism?: boolean;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}

const getPaddingStyles = (padding: CardProps['padding']): string => {
  switch (padding) {
    case 'none':
      return 'p-0';
    case 'sm':
      return 'p-3';
    case 'lg':
      return 'p-8';
    case 'md':
    default:
      return 'p-6';
  }
};

const getRoundedStyles = (rounded: CardProps['rounded']): string => {
  switch (rounded) {
    case 'sm':
      return 'rounded-lg';
    case 'lg':
      return 'rounded-2xl';
    case 'xl':
      return 'rounded-3xl';
    case 'md':
    default:
      return 'rounded-xl';
  }
};

export const Card: FC<CardProps> = ({
  children,
  className,
  glassmorphism = true,
  hoverable = false,
  padding = 'md',
  rounded = 'md',
  onClick,
}) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={classNames(
        // Base styles
        'w-full border transition-all duration-300',
        getRoundedStyles(rounded),
        getPaddingStyles(padding),
        
        // Glass morphism or solid background
        glassmorphism
          ? 'bg-white/10 backdrop-blur-md border-white/20'
          : 'bg-gray-800 border-gray-700',
        
        // Hover effects
        hoverable && 'cursor-pointer',
        hoverable && glassmorphism && 'hover:bg-white/15 hover:border-white/30',
        hoverable && !glassmorphism && 'hover:bg-gray-700 hover:border-gray-600',
        
        // Focus styles for clickable cards
        onClick && 'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        
        className
      )}
    >
      {children}
    </Component>
  );
};

// Specialized card variants
export const MemorialCard: FC<Omit<CardProps, 'glassmorphism'>> = ({ className, ...props }) => (
  <Card
    glassmorphism={true}
    className={classNames(
      'border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20',
      className
    )}
    {...props}
  />
);

export const ProfileCard: FC<CardProps> = ({ className, ...props }) => (
  <Card
    className={classNames(
      'text-center',
      className
    )}
    {...props}
  />
);

export const StatCard: FC<Omit<CardProps, 'children'> & { title: string; value: string | number; subtitle?: string }> = ({
  title,
  value,
  subtitle,
  className,
  ...props
}) => (
  <Card
    className={classNames('text-center', className)}
    {...props}
  >
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <div className="text-2xl font-bold text-white">
        {value}
      </div>
      {subtitle && (
        <p className="text-sm text-gray-300">
          {subtitle}
        </p>
      )}
    </div>
  </Card>
);

// Memorial-specific card with enhanced styling
export const MemorialGalleryCard: FC<{
  title: string;
  description?: string;
  imageUrl?: string;
  date?: string;
  onClick?: () => void;
  className?: string;
}> = ({
  title,
  description,
  imageUrl,
  date,
  onClick,
  className,
}) => (
  <MemorialCard
    onClick={onClick}
    hoverable={!!onClick}
    className={classNames('overflow-hidden', className)}
    padding="none"
  >
    {/* Image */}
    {imageUrl && (
      <div className="aspect-video w-full overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>
    )}
    
    {/* Content */}
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white text-lg leading-tight">
          {title}
        </h3>
        {date && (
          <span className="text-xs text-gray-400 shrink-0">
            {date}
          </span>
        )}
      </div>
      
      {description && (
        <p className="text-gray-300 text-sm line-clamp-2">
          {description}
        </p>
      )}
    </div>
  </MemorialCard>
);

// Transaction/Activity card
export const ActivityCard: FC<{
  title: string;
  description: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  amount?: string;
  onClick?: () => void;
}> = ({
  title,
  description,
  status,
  timestamp,
  amount,
  onClick,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'pending':
      default:
        return 'text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
      case 'pending':
      default:
        return '⏳';
    }
  };

  return (
    <Card
      onClick={onClick}
      hoverable={!!onClick}
      className="flex items-center gap-4"
    >
      <div className={classNames(
        'w-10 h-10 rounded-full flex items-center justify-center',
        'bg-white/10 border border-white/20'
      )}>
        <span className={getStatusColor(status)}>
          {getStatusIcon(status)}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-white truncate">
            {title}
          </h4>
          {amount && (
            <span className="text-sm font-mono text-gray-300">
              {amount}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 truncate">
          {description}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {timestamp}
        </p>
      </div>
    </Card>
  );
};
