'use client';

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export function AdminLinks() {
  const { user } = useAuth();
  if (user?.role !== 'brigadier' && user?.role !== 'supervisor') return null;
  return (
    <>
      <Link href="/objects" className="text-gray-600 hover:text-gray-900">Объекты</Link>    
      <Link href="/workers" className="text-gray-600 hover:text-gray-900">Сотрудники</Link>
      <Link href="/brigades" className="text-gray-600 hover:text-gray-900">Бригады</Link>
      <Link href="/work-types" className="text-gray-600 hover:text-gray-900">Расценки</Link>
    </>
  );
}

export function SupervisorLinks() {
  const { user } = useAuth();
  if (user?.role !== 'supervisor') return null;
  return (
    <Link href="/supervisor" className="text-gray-600 hover:text-gray-900">Подтверждение</Link>
  );
}