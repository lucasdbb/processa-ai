/**
 * Reusable error message component for displaying errors consistently across the application
 */

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import type { ErrorState } from '../types/common';

/**
 * Props for the ErrorMessage component
 */
interface ErrorMessageProps {
  /** Error state object */
  error: ErrorState;
  /** Function to retry the failed operation */
  onRetry?: () => void;
  /** Function to dismiss/clear the error */
  onDismiss?: () => void;
  /** Size variant of the error message */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the error inline or as a block */
  inline?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Whether to show error details */
  showDetails?: boolean;
}

/**
 * Size mappings for the error message
 */
const sizeClasses = {
  sm: {
    container: 'p-3 text-sm',
    icon: 'h-4 w-4',
    button: 'px-2 py-1 text-xs'
  },
  md: {
    container: 'p-4 text-base',
    icon: 'h-5 w-5',
    button: 'px-3 py-1.5 text-sm'
  },
  lg: {
    container: 'p-6 text-lg',
    icon: 'h-6 w-6',
    button: 'px-4 py-2 text-base'
  }
} as const;

/**
 * Error message component for displaying errors with optional retry and dismiss actions
 * 
 * @param props - Component props
 * @returns JSX element representing the error message
 * 
 * @example
 * ```tsx
 * // Basic error message
 * <ErrorMessage error={{ hasError: true, message: "Something went wrong" }} />
 * 
 * // Error with retry functionality
 * <ErrorMessage 
 *   error={error} 
 *   onRetry={() => refetch()} 
 *   onDismiss={() => clearError()} 
 * />
 * 
 * // Inline error message
 * <ErrorMessage 
 *   error={error} 
 *   size="sm" 
 *   inline 
 *   showDetails={false}
 * />
 * ```
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  size = 'md',
  inline = false,
  className = '',
  showDetails = false
}) => {
  // Don't render if there's no error
  if (!error.hasError || !error.message) {
    return null;
  }

  const classes = sizeClasses[size];
  
  const containerClasses = [
    'bg-red-50 border border-red-200 rounded-lg',
    classes.container,
    inline ? 'inline-flex items-center gap-2' : 'flex flex-col gap-3',
    className
  ].filter(Boolean).join(' ');

  const iconClasses = [
    'text-red-500 flex-shrink-0',
    classes.icon
  ].join(' ');

  const buttonClasses = [
    'inline-flex items-center gap-1 font-medium rounded transition-colors',
    classes.button
  ].join(' ');

  return (
    <div className={containerClasses} role="alert" aria-live="assertive">
      <div className={inline ? 'flex items-center gap-2' : 'flex items-start gap-3'}>
        <AlertCircle className={iconClasses} aria-hidden="true" />
        
        <div className="flex-1 min-w-0">
          <p className="text-red-800 font-medium">
            {error.message}
          </p>
          
          {showDetails && error.details && (
            <details className="mt-2">
              <summary className="text-red-700 text-sm cursor-pointer hover:text-red-800">
                Show details
              </summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Action buttons */}
        <div className={`flex gap-2 ${inline ? '' : 'flex-shrink-0'}`}>
          {onRetry && (
            <button
              onClick={onRetry}
              className={`${buttonClasses} text-red-700 hover:text-red-800 hover:bg-red-100`}
              aria-label="Retry operation"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`${buttonClasses} text-red-500 hover:text-red-600 hover:bg-red-100`}
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
              {inline ? '' : 'Dismiss'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;