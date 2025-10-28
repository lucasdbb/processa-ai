/**
 * Custom hook for handling async operations with loading states and error handling
 * 
 * This hook provides a standardized way to manage async operations throughout
 * the application, including loading states, error handling, and data management.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LoadingState, ErrorState } from '../types/common';

/**
 * Configuration options for the useAsync hook
 */
interface UseAsyncOptions<T> {
  /** Initial data value */
  initialData?: T;
  /** Whether to execute the async function immediately */
  immediate?: boolean;
  /** Function to call when the async operation succeeds */
  onSuccess?: (data: T) => void;
  /** Function to call when the async operation fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useAsync hook
 */
interface UseAsyncReturn<T> {
  /** Current data */
  data: T | null;
  /** Current loading state */
  loading: LoadingState;
  /** Current error state */
  error: ErrorState;
  /** Function to execute the async operation */
  execute: (...args: any[]) => Promise<T | null>;
  /** Function to reset the state */
  reset: () => void;
  /** Function to set data manually */
  setData: (data: T | null) => void;
  /** Function to clear errors */
  clearError: () => void;
}

/**
 * Custom hook for managing async operations with proper loading and error states
 * 
 * @template T - The type of data returned by the async function
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Object containing data, loading state, error state, and control functions
 * 
 * @example
 * ```typescript
 * const { data, loading, error, execute } = useAsync(
 *   async (userId: string) => {
 *     const response = await fetch(`/api/users/${userId}`);
 *     return response.json();
 *   },
 *   { immediate: false }
 * );
 * 
 * // Execute the async function
 * execute('123');
 * ```
 */
export function useAsync<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T> {
  const {
    initialData = null,
    immediate = false,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    message: ''
  });

  // Keep track of the latest async function to prevent stale closures
  const asyncFunctionRef = useRef(asyncFunction);
  asyncFunctionRef.current = asyncFunction;

  // Keep track of the current execution to prevent race conditions
  const executionIdRef = useRef(0);

  /**
   * Execute the async function with proper error handling and loading states
   */
  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    const currentExecutionId = ++executionIdRef.current;
    
    setLoading('loading');
    setError({ hasError: false, message: '' });

    try {
      const result = await asyncFunctionRef.current(...args);
      
      // Only update state if this is still the latest execution
      if (currentExecutionId === executionIdRef.current) {
        setData(result);
        setLoading('success');
        onSuccess?.(result);
        return result;
      }
      
      return null;
    } catch (err) {
      // Only update state if this is still the latest execution
      if (currentExecutionId === executionIdRef.current) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        const errorState: ErrorState = {
          hasError: true,
          message: error.message,
          details: { originalError: error }
        };
        
        setError(errorState);
        setLoading('error');
        onError?.(error);
      }
      
      return null;
    }
  }, [onSuccess, onError]);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setData(initialData);
    setLoading('idle');
    setError({ hasError: false, message: '' });
    executionIdRef.current = 0;
  }, [initialData]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError({ hasError: false, message: '' });
    if (loading === 'error') {
      setLoading('idle');
    }
  }, [loading]);

  /**
   * Manually set data
   */
  const setDataCallback = useCallback((newData: T | null) => {
    setData(newData);
    setLoading(newData ? 'success' : 'idle');
    setError({ hasError: false, message: '' });
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    setData: setDataCallback,
    clearError
  };
}