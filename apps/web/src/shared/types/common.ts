/**
 * Common utility type definitions for the Processa AI application
 * 
 * This file contains reusable type definitions that are used across
 * multiple components and modules in the application.
 */

/**
 * Generic API response structure
 */
export interface ApiResponse<T = any> {
  /** Response data */
  data: T;
  /** Success status */
  success: boolean;
  /** Error message if request failed */
  message?: string;
  /** Additional metadata */
  meta?: {
    /** Total number of items (for paginated responses) */
    total?: number;
    /** Current page number */
    page?: number;
    /** Number of items per page */
    limit?: number;
    /** Total number of pages */
    totalPages?: number;
  };
}

/**
 * Loading state for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Error state structure
 */
export interface ErrorState {
  /** Whether an error occurred */
  hasError: boolean;
  /** Error message */
  message: string;
  /** Error code (HTTP status, custom error code, etc.) */
  code?: string | number;
  /** Additional error details */
  details?: Record<string, any>;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Offset for database queries */
  offset?: number;
}

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Generic filter parameters
 */
export interface FilterParams {
  /** Search query string */
  search?: string;
  /** Field to sort by */
  sortBy?: string;
  /** Sort order */
  sortOrder?: SortOrder;
  /** Date range filter */
  dateRange?: {
    start: string;
    end: string;
  };
  /** Category filter */
  category?: string;
  /** Status filter */
  status?: string;
  /** Additional custom filters */
  [key: string]: any;
}

/**
 * Generic form field configuration
 */
export interface FormField<T = any> {
  /** Field name/key */
  name: string;
  /** Field label */
  label: string;
  /** Field type */
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Field validation rules */
  validation?: {
    /** Minimum length */
    minLength?: number;
    /** Maximum length */
    maxLength?: number;
    /** Regular expression pattern */
    pattern?: RegExp;
    /** Custom validation function */
    custom?: (value: T) => string | null;
  };
  /** Options for select fields */
  options?: Array<{
    value: string;
    label: string;
  }>;
  /** Default value */
  defaultValue?: T;
}

/**
 * Generic modal props
 */
export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking outside closes the modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
}

/**
 * Generic table column configuration
 */
export interface TableColumn<T = any> {
  /** Column key */
  key: keyof T;
  /** Column header label */
  label: string;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom render function */
  render?: (value: any, row: T) => React.ReactNode;
  /** Column width */
  width?: string;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Generic notification/toast message
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification type */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Notification title */
  title: string;
  /** Notification message */
  message?: string;
  /** Auto-dismiss duration in milliseconds */
  duration?: number;
  /** Whether the notification can be dismissed */
  dismissible?: boolean;
  /** Additional actions */
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  /** Accepted file types */
  accept: string[];
  /** Maximum file size in bytes */
  maxSize: number;
  /** Maximum number of files */
  maxFiles: number;
  /** Whether multiple files are allowed */
  multiple: boolean;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Item label */
  label: string;
  /** Item URL/path */
  href?: string;
  /** Whether this is the current page */
  current?: boolean;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Theme mode */
  mode: 'light' | 'dark' | 'system';
  /** Primary color */
  primaryColor: string;
  /** Font family */
  fontFamily: string;
  /** Border radius */
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** Environment name */
  NODE_ENV: 'development' | 'production' | 'test';
  /** API base URL */
  API_BASE_URL: string;
  /** Application version */
  APP_VERSION: string;
  /** Feature flags */
  FEATURES: Record<string, boolean>;
}