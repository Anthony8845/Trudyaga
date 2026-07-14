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
  if (user.role !== 'admin') {
    return <div className="text-center py-12 text-gray-500">У вас недостаточно прав для просмотра этой страницы.</div>;
  }

  return <>{children}</>;
}