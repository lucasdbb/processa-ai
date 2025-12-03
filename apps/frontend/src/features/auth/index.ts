/**
 * Auth Feature - Public API
 *
 * Exports all auth-related components, hooks, services, and types
 */

// Components
export { default as LoginModal } from './components/LoginModal';
export { default as UserMenu } from './components/UserMenu';
export { default as LogoutMenu } from './components/LogoutMenu';
export { default as ProfileModal } from './components/ProfileModal';
export { default as SessionTimeoutWarning } from './components/SessionTimeoutWarning';
export { default as EmailConfirmedModal } from './components/EmailConfirmedModal';
export { default as AuthErrorModal } from './components/AuthErrorModal';
export { default as ResetPasswordModal } from './components/ResetPasswordModal';

// Services
export * from './services/auth.service';
export * from './services/supabase.service';

// Types
export type * from './types/auth';
