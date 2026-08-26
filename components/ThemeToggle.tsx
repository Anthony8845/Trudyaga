'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = () => {
    setDark(prev => {
      const newDark = !prev;
      if (newDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newDark;
    });
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1 rounded-md text-sm font-medium bg-gray-200 dark:bg-grey-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 transition-colors"
      title="Переключить тему"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}