import React, { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  glassmorphism?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

const getSizeStyles = (size: ModalProps['size']): string => {
  switch (size) {
    case 'sm':
      return 'max-w-md';
    case 'lg':
      return 'max-w-4xl';
    case 'xl':
      return 'max-w-6xl';
    case 'full':
      return 'max-w-[95vw] max-h-[95vh]';
    case 'md':
    default:
      return 'max-w-2xl';
  }
};

export const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  glassmorphism = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className={classNames(
          'fixed inset-0 transition-opacity duration-300',
          glassmorphism 
            ? 'bg-black/50 backdrop-blur-sm' 
            : 'bg-black/80'
        )}
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className={classNames(
          'relative w-full transform transition-all duration-300',
          'animate-in fade-in-0 zoom-in-95',
          getSizeStyles(size)
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={classNames(
            'w-full max-h-[90vh] overflow-hidden',
            'rounded-2xl border shadow-2xl',
            glassmorphism
              ? 'bg-gray-900/90 backdrop-blur-xl border-white/10'
              : 'bg-gray-900 border-gray-700'
          )}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              {title && (
                <h2 className="text-xl font-semibold text-white">{title}</h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className={classNames(
                    'p-2 rounded-lg transition-colors',
                    'text-gray-400 hover:text-white',
                    'hover:bg-white/10 focus:bg-white/10',
                    'focus:outline-none focus:ring-2 focus:ring-white/20'
                  )}
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto max-h-[70vh]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Specialized modal variants
export const WalletConnectionModal: FC<Omit<ModalProps, 'title'>> = (props) => (
  <Modal title="连接钱包" {...props} />
);

export const TransactionModal: FC<Omit<ModalProps, 'title'>> = (props) => (
  <Modal title="交易确认" {...props} />
);

export const MemorialModal: FC<Omit<ModalProps, 'title' | 'glassmorphism'>> = (props) => (
  <Modal title="纪念馆" glassmorphism={true} {...props} />
);
