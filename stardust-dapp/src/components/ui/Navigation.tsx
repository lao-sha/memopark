import React, { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { WalletConnection } from './WalletConnection';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
  badge?: string | number;
  active?: boolean;
}

export interface NavigationProps {
  items: NavigationItem[];
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
  className?: string;
  logo?: ReactNode;
  glassmorphism?: boolean;
}

export const Navigation: FC<NavigationProps> = ({
  items,
  activeItem,
  onItemClick,
  className,
  logo,
  glassmorphism = true,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleItemClick = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
    
    onItemClick?.(item.id);
    setIsMobileMenuOpen(false); // Close mobile menu on item click
  };

  return (
    <nav
      className={classNames(
        'sticky top-0 z-40 w-full border-b transition-all duration-300',
        glassmorphism
          ? 'bg-gray-900/80 backdrop-blur-xl border-white/10'
          : 'bg-gray-900 border-gray-700',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            {logo || (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="text-xl font-bold text-white">Memopark</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={classNames(
                    'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    (item.active || activeItem === item.id)
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Connection & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <WalletConnection />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    (item.active || activeItem === item.id)
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  )}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// Sidebar Navigation Component
export const SidebarNavigation: FC<NavigationProps & { isOpen?: boolean; onToggle?: () => void }> = ({
  items,
  activeItem,
  onItemClick,
  className,
  logo,
  glassmorphism = true,
  isOpen = true,
  onToggle,
}) => {
  const handleItemClick = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
    
    onItemClick?.(item.id);
  };

  return (
    <div
      className={classNames(
        'flex flex-col h-full border-r transition-all duration-300',
        glassmorphism
          ? 'bg-gray-900/80 backdrop-blur-xl border-white/10'
          : 'bg-gray-900 border-gray-700',
        isOpen ? 'w-64' : 'w-16',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {isOpen && (
          logo || (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="text-xl font-bold text-white">Memopark</span>
            </div>
          )
        )}
        
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"}
              />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={classNames(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                (item.active || activeItem === item.id)
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'text-gray-300 hover:text-white hover:bg-white/10',
                !isOpen && 'justify-center'
              )}
              title={!isOpen ? item.label : undefined}
            >
              {item.icon}
              {isOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet Connection at Bottom */}
      {isOpen && (
        <div className="p-4 border-t border-white/10">
          <WalletConnection />
        </div>
      )}
    </div>
  );
};
