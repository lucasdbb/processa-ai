"use client";

import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store";
import { authService } from "../services/auth-service";
import type {
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
} from "../types";

/**
 * Custom hook for authentication operations
 * Uses httpOnly cookies - no manual token management needed
 */
export function useAuth() {
  const {
    user,
    isLoading,
    isInitialized,
    setUser,
    setLoading,
    setInitialized,
    logout: clearUser,
  } = useAuthStore();

  // Initialize auth state on mount - check if user is logged in via cookies
  useEffect(() => {
    if (!isInitialized) {
      const initAuth = async () => {
        try {
          // Call /auth/me - if user has valid cookie, backend returns user
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          console.error("Failed to initialize auth:", error);
          setUser(null);
        } finally {
          setLoading(false);
          setInitialized(true);
        }
      };

      initAuth();
    }
  }, [isInitialized, setUser, setLoading, setInitialized]);

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const response = await authService.login(credentials);

      if (!response || !response.user) {
        throw new Error("Invalid login response");
      }

      // Backend sets httpOnly cookies automatically
      // Just update the user state
      setUser(response.user);

      return response.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const response = await authService.register(data);

      if (!response || !response.user) {
        throw new Error("Invalid register response");
      }

      // Backend sets httpOnly cookies automatically
      // Just update the user state
      setUser(response.user);

      return response.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Backend clears httpOnly cookies automatically
      await authService.logout();
      clearUser();
    } catch (error) {
      console.error("Logout failed:", error);
      // Clear user anyway
      clearUser();
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: UpdateProfileData) => {
    setLoading(true);
    try {
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
      return updatedUser;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isAuthor: user?.role === "author" || user?.role === "admin",
    login,
    register,
    logout,
    updateProfile,
  };
}
