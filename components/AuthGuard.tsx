'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, pathname, router]);

  if (!user && pathname !== '/login') {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        Проверка доступа...
      </div>
    );
  }

  return <>{children}</>;
}