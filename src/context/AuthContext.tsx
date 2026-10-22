import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password?: string, fullName?: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('mealhisab_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (isSupabaseConfigured && supabase) {
        const client = supabase;
        try {
          const { data: { session } } = await client.auth.getSession();
          if (session?.user && isMounted) {
            const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            const currentUser: UserProfile = profile
              ? { ...profile, email: session.user.email }
              : {
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || '',
                  phone: session.user.user_metadata?.phone || null,
                };

            setUser(currentUser);
            localStorage.setItem('mealhisab_cached_user', JSON.stringify(currentUser));
          } else if (!session && isMounted) {
            setUser(null);
            localStorage.removeItem('mealhisab_cached_user');
          }

          const { data: { subscription } } = client.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'SIGNED_OUT') {
                if (isMounted) {
                  setUser(null);
                  localStorage.removeItem('mealhisab_cached_user');
                }
                return;
              }

              if (session?.user && isMounted) {
                const { data: profile } = await client
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .maybeSingle();

                const currentUser: UserProfile = profile
                  ? { ...profile, email: session.user.email }
                  : {
                      id: session.user.id,
                      email: session.user.email,
                      full_name: session.user.user_metadata?.full_name || '',
                      phone: session.user.user_metadata?.phone || null,
                    };

                setUser(currentUser);
                localStorage.setItem('mealhisab_cached_user', JSON.stringify(currentUser));
              }
            }
          );

          return () => {
            subscription.unsubscribe();
          };
        } catch (e) {
          console.warn('Supabase auth session error:', e);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        localStorage.removeItem('mealhisab_cached_user');
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          const u: UserProfile = profile
            ? { ...profile, email: data.user.email }
            : {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata?.full_name || email.split('@')[0],
              };
          setUser(u);
        }
      } else {
        throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password?: string, fullName?: string, phone?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;

        // If session was returned immediately (email confirmation disabled in Supabase)
        if (data.session && data.user) {
          const u: UserProfile = {
            id: data.user.id,
            email: data.user.email,
            full_name: fullName || '',
            phone: phone || null,
          };
          setUser(u);
          return;
        }

        // If session is null, attempt sign-in in case confirmation is optional
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError && signInData?.session && signInData.user) {
          const u: UserProfile = {
            id: signInData.user.id,
            email: signInData.user.email,
            full_name: fullName || '',
            phone: phone || null,
          };
          setUser(u);
          return;
        }

        if (data.user) {
          throw new Error('Registration successful. Please check your email to confirm your account before signing in.');
        }
      } else {
        throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('mealhisab_cached_user');
    localStorage.removeItem('mealhisab_active_system_id');
    localStorage.removeItem('mealhisab_session_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
