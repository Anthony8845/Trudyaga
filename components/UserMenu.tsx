// components/UserMenu.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return null; // вообще не показываем, если не авторизован (AuthGuard уже должен редиректить)
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex items-center space-x-2 ml-auto">
      <span className="text-gray-700 text-sm">
        {user.role === 'brigadier' ? '👷 Бригадир' : user.role === 'supervisor' ? '👑 Руководитель' : '👷 ' + user.login}
      </span>
      <button
        onClick={handleLogout}
        className="text-red-600 hover:text-red-800 text-sm"
      >
        Выйти
      </button>
    </div>
  );
}