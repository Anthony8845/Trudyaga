'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export function NotificationBell() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Запрашиваем разрешение на уведомления при монтировании
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(p => setPermission(p));
    } else {
      setPermission(Notification?.permission || 'denied');
    }
  }, []);

  // Периодический опрос количества pending записей
  useEffect(() => {
    if (user?.role !== 'supervisor') return;

    const fetchPending = async () => {
      const { count, error } = await supabase
        .from('work_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (!error && count !== null) {
        if (count > pendingCount && permission === 'granted') {
          new Notification('Трудодень', {
            body: `Новых записей на подтверждение: ${count}`,
            icon: '/favicon.ico',
          });
        }
        setPendingCount(count);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30000); // проверка каждые 30 секунд
    return () => clearInterval(interval);
  }, [user, pendingCount, permission]);

  if (user?.role !== 'supervisor') return null;

  return (
    <div className="relative inline-flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {pendingCount > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
          {pendingCount}
        </span>
      )}
    </div>
  );
}