'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { AdminLinks, SupervisorLinks } from './NavLinks'; // AdminLinks уже адаптированы под brigadier/supervisor
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {/* Кнопка гамбургера – видна только на маленьких экранах */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden text-gray-600 focus:outline-none"
        aria-label="Открыть меню"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Мобильное меню – показывается только когда open=true */}
      {open && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col p-4 md:hidden">
          <div className="flex justify-between items-center mb-6">
            <Link href="/" className="text-xl font-bold text-blue-600" onClick={() => setOpen(false)}>
              Трудяга
            </Link>
            <button onClick={() => setOpen(false)} className="text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col space-y-4 text-lg font-medium">
            <Link href="/" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Дашборд</Link>
            <Link href="/report" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Зарплата</Link>
            <Link href="/payments" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Выплаты</Link>

            {user?.role === 'brigadier' || user?.role === 'supervisor' ? (
              <>
                <Link href="/workers" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Сотрудники</Link>
                <Link href="/brigades" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Бригады</Link>
                <Link href="/work-types" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Расценки</Link>
                <Link href="/objects" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Объекты</Link>
              </>
            ) : null}

            {user?.role === 'supervisor' && (
              <Link href="/supervisor" className="text-gray-700 hover:text-blue-600" onClick={() => setOpen(false)}>Подтверждение</Link>
            )}

            <div className="pt-4 border-t flex items-center justify-between">
              <NotificationBell />
              <UserMenu />
            </div>
          </nav>
        </div>
      )}

      {/* Обычная навигация для больших экранов – скрыта на мобильных */}
      <div className="hidden md:flex items-center space-x-4 text-sm font-medium">
        <Link href="/" className="text-gray-600 hover:text-gray-900">Дашборд</Link>
        <Link href="/report" className="text-gray-600 hover:text-gray-900">Зарплата</Link>
        <AdminLinks />
        <SupervisorLinks />
        <NotificationBell />
        <UserMenu />
      </div>
    </>
  );
}