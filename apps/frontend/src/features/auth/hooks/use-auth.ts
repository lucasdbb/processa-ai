import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store";
import type {
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
} from "../types";
import { createClient } from "@/lib/supabase/client";
import { analytics } from "@/lib/analytics";

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

              setUser({
                id: session.user.id,
                email: session.user.email!,
                name: profile.name,
                role: profile.role,
                status: profile.status,
                avatar_url: profile.avatar_url,
                created_at: profile.created_at,
                welcome_credits_claimed: profile.welcome_credits_claimed,
                cpf: profile.cpf,
                phone: profile.phone,
                newsletter_opt_in: profile.newsletter_opt_in,
              });
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
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
      analytics.track('user_logged_in', { method: 'email' });

      const currentUser = {
        id: data.user.id,
        email: data.user.email!,
        name: profile.name,
        role: profile.role,
        status: profile.status,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        welcome_credits_claimed: profile.welcome_credits_claimed,
        cpf: profile.cpf,
        phone: profile.phone,
        newsletter_opt_in: profile.newsletter_opt_in,
      };

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
          const currentUser = {
            id: authData.user.id,
            email: authData.user.email!,
            name: profile.name,
            role: profile.role,
            status: profile.status,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at,
            welcome_credits_claimed: profile.welcome_credits_claimed,
            cpf: profile.cpf,
            phone: profile.phone,
            newsletter_opt_in: profile.newsletter_opt_in,
          };
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

      clearUser();
    } catch (error) {
      console.error("Logout failed:", error);
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
