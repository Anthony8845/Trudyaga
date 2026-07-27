import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { AuthProvider } from '@/lib/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { MobileMenu } from '@/components/MobileMenu';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Трудодень',
  description: 'Учёт заработной платы монтажников',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`}>
        <AuthProvider>
          <AuthGuard>
            <header className="bg-white border-b border-gray-200 shadow-sm">
              <div className="max-w-7xl mx-auto px-3 py-3 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold text-blue-600">
                  Трудодень
                </Link>
                <MobileMenu />
              </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto px-3 py-6 w-full">
              {children}
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}