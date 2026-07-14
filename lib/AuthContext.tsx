// lib/AuthContext.tsx
'use client';
import { supabase } from './supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';


interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'brigadier' | 'worker';
  brigade_id?: number;
}

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  // Функция для загрузки профиля по user_id
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, brigade_id')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Если профиль не найден, возможно, пользователь не настроен, выходим
      setUser(null);
      return;
    }

    setUser({
      id: userId,
      email: '', // email заполним из сессии
      role: data.role as AppUser['role'],
      brigade_id: data.brigade_id ?? undefined,
    });
  };

  // При загрузке и изменении сессии
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Загружаем профиль
        await loadProfile(session.user.id);
        // Добавляем email из объекта пользователя
        setUser(prev => prev ? { ...prev, email: session.user.email! } : null);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await loadProfile(session.user.id);
          setUser(prev => prev ? { ...prev, email: session.user.email! } : null);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return false;
    // Сессия будет обработана слушателем onAuthStateChange
    return true;
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