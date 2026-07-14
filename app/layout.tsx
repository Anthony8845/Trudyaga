// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { AuthProvider } from '@/lib/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { UserMenu } from '@/components/UserMenu';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Трудяга',
  description: 'Учёт заработной платы монтажников',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col px-2 sm:px-4`}>
        <AuthProvider>
          <AuthGuard>
            <header className="bg-white border-b border-gray-200 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold text-blue-600">
                  Трудяга
                </Link>
                  <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm font-medium">
                      <Link href="/" className="text-gray-600 hover:text-gray-900">Дашборд</Link>
                      <Link href="/workers" className="text-gray-600 hover:text-gray-900">Сотрудники</Link>
                      <Link href="/brigades" className="text-gray-600 hover:text-gray-900">Бригады</Link>
                      <Link href="/work-types" className="text-gray-600 hover:text-gray-900">Расценки</Link>
                      <Link href="/report" className="text-gray-600 hover:text-gray-900">Зарплата</Link>
                    <UserMenu />
                  </nav>
              </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
              {children}
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}