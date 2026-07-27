'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

interface AppUser {
  id: string;
  login: string;
  role: 'brigadier' | 'supervisor' | 'worker';
  brigadeId?: number;
}

interface AuthContextType {
  user: AppUser | null;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  const loadProfile = async (userId: string, userEmail: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, brigade_id')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      setUser(null);
      return;
    }

    setUser({
      id: userId,
      login: userEmail, // теперь сохраняем логин (email из auth)
      role: data.role as AppUser['role'],
      brigadeId: data.brigade_id ?? undefined,
    });
  };

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email!);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email!);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (login: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: login,
      password,
    });
    return !error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}