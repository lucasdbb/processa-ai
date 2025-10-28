import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ValidationErrorProps {
  /** The error message to display */
  error?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Unique identifier for accessibility */
  id?: string;
}

/**
 * ValidationError component for displaying form validation errors
 * with proper accessibility attributes and consistent styling
 */
const ValidationError: React.FC<ValidationErrorProps> = ({ 
  error, 
  className = '', 
  id 
}) => {
  if (!error) return null;

  return (
    <div 
      id={id}
      role="alert"
      aria-live="polite"
      className={`flex items-center space-x-2 text-sm text-red-600 mt-1 ${className}`}
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
};

export default ValidationError;