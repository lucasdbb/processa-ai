/**
 * Authentication-related type definitions for the Processa AI application
 */

/**
 * User authentication modes
 */
export type AuthMode = 'login' | 'register';

/**
 * User role types in the system
 */
export type UserRole = 'user' | 'admin' | 'premium';

/**
 * User authentication status
 */
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';

/**
 * Form data structure for authentication forms
 */
export interface AuthFormData {
  /** User's full name (required for registration) */
  name: string;
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Password confirmation (required for registration) */
  confirmPassword: string;
}

/**
 * Form validation errors structure
 */
export interface AuthFormErrors {
  /** Name field validation error */
  name?: string;
  /** Email field validation error */
  email?: string;
  /** Password field validation error */
  password?: string;
  /** Confirm password field validation error */
  confirmPassword?: string;
  /** General form error (e.g., server errors) */
  general?: string;
}

/**
 * User profile information
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** User's role in the system */
  role: UserRole;
  /** Account creation timestamp */
  createdAt: string;
  /** Last login timestamp */
  lastLoginAt?: string;
  /** Whether the user's email is verified */
  emailVerified: boolean;
  /** User's profile picture URL */
  avatar?: string;
}

/**
 * Authentication context state
 */
export interface AuthContextState {
  /** Current authenticated user */
  user: User | null;
  /** Current authentication status */
  status: AuthStatus;
  /** Whether authentication is in progress */
  loading: boolean;
  /** Authentication error message */
  error: string | null;
}

/**
 * Authentication context actions
 */
export interface AuthContextActions {
  /** Login function */
  login: (email: string, password: string) => Promise<void>;
  /** Registration function */
  register: (userData: Omit<AuthFormData, 'confirmPassword'>) => Promise<void>;
  /** Logout function */
  logout: () => void;
  /** Clear authentication errors */
  clearError: () => void;
  /** Refresh user data */
  refreshUser: () => Promise<void>;
}

/**
 * Complete authentication context interface
 */
export interface AuthContext extends AuthContextState, AuthContextActions {}

/**
 * Props for the LoginModal component
 */
export interface LoginModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Function called when login is successful */
  onLogin: (email: string, password: string) => void;
  /** Initial authentication mode */
  initialMode?: AuthMode;
}

/**
 * Props for authentication form components
 */
export interface AuthFormProps {
  /** Current authentication mode */
  mode: AuthMode;
  /** Form data */
  formData: AuthFormData;
  /** Form validation errors */
  errors: AuthFormErrors;
  /** Whether form submission is in progress */
  loading: boolean;
  /** Function to update form data */
  onChange: (data: Partial<AuthFormData>) => void;
  /** Function to handle form submission */
  onSubmit: (e: React.FormEvent) => void;
  /** Function to toggle between login/register modes */
  onModeToggle: () => void;
}

/**
 * Props for protected route components
 */
export interface ProtectedRouteProps {
  /** Child components to render if authenticated */
  children: React.ReactNode;
  /** Required user role to access the route */
  requiredRole?: UserRole;
  /** Redirect path for unauthenticated users */
  redirectTo?: string;
  /** Custom fallback component for unauthorized access */
  fallback?: React.ComponentType;
}

/**
 * Authentication API response structure
 */
export interface AuthResponse {
  /** Authentication token */
  token: string;
  /** User information */
  user: User;
  /** Token expiration timestamp */
  expiresAt: string;
  /** Refresh token for token renewal */
  refreshToken?: string;
}

/**
 * Password validation requirements
 */
export interface PasswordRequirements {
  /** Minimum password length */
  minLength: number;
  /** Requires uppercase letter */
  requireUppercase: boolean;
  /** Requires lowercase letter */
  requireLowercase: boolean;
  /** Requires numeric character */
  requireNumber: boolean;
  /** Requires special character */
  requireSpecialChar: boolean;
}

/**
 * Email validation result
 */
export interface EmailValidation {
  /** Whether the email format is valid */
  isValid: boolean;
  /** Validation error message if invalid */
  error?: string;
}

/**
 * Password validation result
 */
export interface PasswordValidation {
  /** Whether the password meets requirements */
  isValid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Password strength score (0-100) */
  strength: number;
}