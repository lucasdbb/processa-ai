/**
 * Reusable loading spinner component with customizable size and styling
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Props for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom className for additional styling */
  className?: string;
  /** Loading message to display */
  message?: string;
  /** Whether to show the spinner inline or as a centered block */
  inline?: boolean;
  /** Color variant of the spinner */
  variant?: 'primary' | 'secondary' | 'white';
}

/**
 * Size mappings for the spinner
 */
const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
} as const;

/**
 * Color variant mappings for the spinner
 */
const variantClasses = {
  primary: 'text-primary-600',
  secondary: 'text-secondary-600',
  white: 'text-white'
} as const;

/**
 * Loading spinner component with customizable appearance and behavior
 * 
 * @param props - Component props
 * @returns JSX element representing the loading spinner
 * 
 * @example
 * ```tsx
 * // Basic spinner
 * <LoadingSpinner />
 * 
 * // Large spinner with message
 * <LoadingSpinner size="lg" message="Loading data..." />
 * 
 * // Inline spinner
 * <LoadingSpinner size="sm" inline />
 * 
 * // Custom styled spinner
 * <LoadingSpinner 
 *   size="md" 
 *   variant="white" 
 *   className="my-4" 
 *   message="Please wait..." 
 * />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size = 'md',
  className = '',
  message,
  inline = false,
  variant = 'primary'
}) => {
  const spinnerClasses = [
    'animate-spin',
    sizeClasses[size],
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ');

  const containerClasses = inline 
    ? 'inline-flex items-center gap-2'
    : 'flex flex-col items-center justify-center gap-3 p-4';

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <Loader2 className={spinnerClasses} aria-hidden="true" />
      {message && (
        <span className={`text-sm ${inline ? 'ml-2' : 'text-center'} text-gray-600`}>
          {message}
        </span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;