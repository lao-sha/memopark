import React, { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false | null | 0)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// Base input props
interface BaseInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  glassmorphism?: boolean;
  fullWidth?: boolean;
}

// Input component props
export interface InputProps extends BaseInputProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
}

// Textarea component props
export interface TextareaProps extends BaseInputProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  resize?: boolean;
}

const getSizeStyles = (size: InputProps['size']): string => {
  switch (size) {
    case 'sm':
      return 'px-3 py-2 text-sm';
    case 'lg':
      return 'px-4 py-3 text-lg';
    case 'md':
    default:
      return 'px-4 py-2.5 text-base';
  }
};

const getBaseInputStyles = (error?: string, glassmorphism?: boolean): string => {
  return classNames(
    // Base styles
    'w-full rounded-lg border transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
    'placeholder:text-gray-400',
    
    // Background and border
    glassmorphism
      ? 'bg-white/5 backdrop-blur-sm border-white/20 text-white'
      : 'bg-gray-800 border-gray-600 text-white',
    
    // Error state
    error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
      : glassmorphism
      ? 'focus:border-blue-400/50'
      : 'focus:border-blue-500',
    
    // Hover state
    !error && (glassmorphism 
      ? 'hover:border-white/30 hover:bg-white/10'
      : 'hover:border-gray-500'
    )
  );
};

// Input component
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  glassmorphism = true,
  fullWidth = true,
  size = 'md',
  className,
  ...props
}, ref) => {
  return (
    <div className={classNames(fullWidth ? 'w-full' : '', 'space-y-1')}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      
      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {leftIcon}
            </div>
          </div>
        )}
        
        {/* Input */}
        <input
          ref={ref}
          className={classNames(
            getBaseInputStyles(error, glassmorphism),
            getSizeStyles(size),
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        
        {/* Right icon */}
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="text-gray-400">
              {rightIcon}
            </div>
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
      
      {/* Hint */}
      {hint && !error && (
        <p className="text-sm text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea component
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  glassmorphism = true,
  fullWidth = true,
  resize = true,
  className,
  ...props
}, ref) => {
  return (
    <div className={classNames(fullWidth ? 'w-full' : '', 'space-y-1')}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      
      {/* Textarea */}
      <textarea
        ref={ref}
        className={classNames(
          getBaseInputStyles(error, glassmorphism),
          'px-4 py-2.5 text-base min-h-[100px]',
          !resize && 'resize-none',
          className
        )}
        {...props}
      />
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
      
      {/* Hint */}
      {hint && !error && (
        <p className="text-sm text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Select component
export interface SelectProps extends BaseInputProps, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  hint,
  glassmorphism = true,
  fullWidth = true,
  size = 'md',
  options,
  placeholder,
  className,
  ...props
}, ref) => {
  return (
    <div className={classNames(fullWidth ? 'w-full' : '', 'space-y-1')}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      
      {/* Select wrapper */}
      <div className="relative">
        <select
          ref={ref}
          className={classNames(
            getBaseInputStyles(error, glassmorphism),
            getSizeStyles(size),
            'pr-10 appearance-none cursor-pointer',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="bg-gray-800 text-white"
            >
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
      
      {/* Hint */}
      {hint && !error && (
        <p className="text-sm text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

// File input component
export interface FileInputProps extends BaseInputProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  accept?: string;
  multiple?: boolean;
  dragAndDrop?: boolean;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(({
  label,
  error,
  hint,
  glassmorphism = true,
  fullWidth = true,
  dragAndDrop = true,
  className,
  ...props
}, ref) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (ref && 'current' in ref && ref.current) {
      ref.current.files = e.dataTransfer.files;
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      ref.current.dispatchEvent(event);
    }
  };

  return (
    <div className={classNames(fullWidth ? 'w-full' : '', 'space-y-1')}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      
      {/* File input area */}
      <div
        className={classNames(
          'relative border-2 border-dashed rounded-lg transition-all duration-200',
          'hover:border-blue-400 focus-within:border-blue-400',
          isDragOver ? 'border-blue-400 bg-blue-500/10' : 'border-gray-600',
          error && 'border-red-500',
          glassmorphism ? 'bg-white/5 backdrop-blur-sm' : 'bg-gray-800',
          className
        )}
        onDragOver={dragAndDrop ? handleDragOver : undefined}
        onDragLeave={dragAndDrop ? handleDragLeave : undefined}
        onDrop={dragAndDrop ? handleDrop : undefined}
      >
        <input
          ref={ref}
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          {...props}
        />
        
        <div className="p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <div className="mt-4">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-blue-400">点击上传</span>
              {dragAndDrop && <span> 或拖拽文件到此处</span>}
            </p>
            {props.accept && (
              <p className="text-xs text-gray-400 mt-1">
                支持格式: {props.accept}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}
      
      {/* Hint */}
      {hint && !error && (
        <p className="text-sm text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
});

FileInput.displayName = 'FileInput';
