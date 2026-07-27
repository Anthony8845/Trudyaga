// components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return <div className="flex justify-center items-center h-64">Проверка доступа...</div>;
  }

  // Только админ имеет полный доступ
  if (user.role !== 'brigadier' && user.role !== 'supervisor') {
    return <div>У вас недостаточно прав...</div>;
  }

  return <>{children}</>;
}