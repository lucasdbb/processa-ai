import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store";
import type {
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
  UserRole,
  User,
} from "../types";
import { createClient } from "@/lib/supabase/client";
import { analytics } from "@/lib/analytics";
import { useBillingStore } from "@/stores/billing-store";
import { useCreditsStore } from "@/stores/credits-store";
import { useOnboardingStore } from "@/features/onboarding/store";

function syncOnboardingFromProfile(profile: Record<string, unknown>) {
  useOnboardingStore.getState().syncFromServer({
    hasUsedAiTool: !!profile.has_used_ai_tool,
    hasUsedCalculator: !!profile.has_used_calculator,
    isChecklistDismissed: !!profile.checklist_dismissed,
    hasClaimedChecklistBonus: !!profile.checklist_bonus_claimed,
  })
}

function buildUser(id: string, email: string, profile: Record<string, unknown>): User {
  return {
    id,
    email,
    name: profile.name as string,
    role: profile.role as UserRole,
    status: profile.status as User['status'],
    avatar_url: profile.avatar_url as string | undefined,
    created_at: profile.created_at as string,
    welcome_credits_claimed: profile.welcome_credits_claimed as boolean | undefined,
    has_used_ai_tool: profile.has_used_ai_tool as boolean | undefined,
    has_used_calculator: profile.has_used_calculator as boolean | undefined,
    checklist_dismissed: profile.checklist_dismissed as boolean | undefined,
    checklist_bonus_claimed: profile.checklist_bonus_claimed as boolean | undefined,
    cpf: profile.cpf as string | undefined,
    phone: profile.phone as string | undefined,
    phone_verified: profile.phone_verified as boolean | undefined,
    phone_verified_at: profile.phone_verified_at as string | undefined,
    newsletter_opt_in: profile.newsletter_opt_in as boolean | undefined,
  }
}

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

  useEffect(() => {
    if (!isInitialized) {
      const initAuth = async () => {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (profile) {
              // Check status
              if (profile.status === 'suspended' || profile.status === 'deleted') {
                await supabase.auth.signOut();
                setUser(null);
                return;
              }

              // Registrar super properties para todos os eventos futuros
              analytics.register({
                user_role: profile.role,
                user_status: profile.status,
              });

              syncOnboardingFromProfile(profile);
              setUser(buildUser(session.user.id, session.user.email!, profile));
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch {
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
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        if (error.message.includes("banned") || error.message.includes("suspended")) {
          throw new Error("Sua conta foi inativada ou suspensa. Entre em contato com o suporte.");
        }
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("Falha ao carregar usuário após login");
      }

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        throw new Error("Erro ao carregar perfil do usuário");
      }

      // Check status immediately
      if (profile.status === 'suspended' || profile.status === 'deleted') {
        await supabase.auth.signOut();
        throw new Error("Sua conta foi inativada ou suspensa. Entre em contato com o suporte.");
      }

      // Identificar usuário no Analytics
      analytics.identify(data.user.id, {
        email: data.user.email,
        name: profile.name,
        role: profile.role,
        status: profile.status,
      });
      analytics.register({
        user_role: profile.role,
        user_status: profile.status,
      });
      analytics.track('user_logged_in', { method: 'email' });

      syncOnboardingFromProfile(profile);
      const currentUser = buildUser(data.user.id, data.user.email!, profile);

      setUser(currentUser);
      return currentUser;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      // Validação de email descartável (lista básica)
      const disposableDomains = [
        'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'throwawaymail.com',
        'mailinator.com', 'yopmail.com', 'sharklasers.com', 'getnada.com',
        'dispostable.com', 'tempr.email', 'temp-mail.org', 'temp-mail.ru',
        'fake-email.com', 'email-fake.com', 'tempmail.net'
      ];
      
      const emailDomain = data.email.split('@')[1]?.toLowerCase();
      if (emailDomain && disposableDomains.some(d => emailDomain.includes(d))) {
        throw new Error("Por favor, use um endereço de e-mail válido (não descartável).");
      }

      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            newsletter_opt_in: data.newsletter_opt_in,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!authData.user) {
        throw new Error("Falha ao criar usuário");
      }

      // O trigger handle_new_user criará o perfil automaticamente
      // Se o usuário foi criado mas precisa confirmar email, retornar null
      if (authData.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (profile) {
          syncOnboardingFromProfile(profile);
          const currentUser = buildUser(authData.user.id, authData.user.email!, profile);
          setUser(currentUser);
          return currentUser;
        }
      }

      // Email confirmation required
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      analytics.track('user_logged_out');
      analytics.reset();

      // Clear all stores to prevent stale data from previous user
      useCreditsStore.getState().reset();
      useBillingStore.setState({ subscription: null, isLoading: false, error: null });

      clearUser();
    } catch {
      useCreditsStore.getState().reset();
      useBillingStore.setState({ subscription: null, isLoading: false, error: null });
      clearUser();
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: UpdateProfileData) => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile, error } = await supabase
        .from("profiles")
        .update({
          name: data.name,
          avatar_url: data.avatar_url,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedUser = {
        ...user,
        name: profile.name,
        avatar_url: profile.avatar_url,
      };

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
