// app/report/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSalaryReport } from '@/lib/data';
import { formatMoney, formatDate } from '@/lib/utils';

interface WorkerDetail {
  worker: {
    id: number;
    full_name: string;
    position: string;
  };
  total_amount: number;
  details: {
    id: number;
    date: string;
    workTypeName: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
}

interface ReportItem {
  brigade: number | null;
  brigade_name: string;
  total_brigade_amount: number;
  workers: WorkerDetail[];
}

export default function ReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const brigadeId = user?.brigade_id;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<ReportItem[] | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today.substring(0, 7) + '-01');
    setEndDate(today);
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      alert('Выберите даты');
      return;
    }
    const fullReport = await getSalaryReport(startDate, endDate);
    if (!isAdmin && brigadeId) {
      // Оставляем только бригаду бригадира
      const filtered = fullReport.filter(item => item.brigade === brigadeId);
      setReport(filtered);
    } else {
      setReport(fullReport);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Расчёт заработной платы</h1>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Начало периода</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Конец периода</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <button
              onClick={handleGenerate}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Сформировать
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          {report.length === 0 && (
            <p className="text-gray-500 text-center">Нет данных за выбранный период.</p>
          )}
          {report.map((item, idx) => (
            <details key={idx} className="bg-white rounded-xl shadow" open>
              <summary className="p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">{item.brigade_name}</h2>
                  <span className="text-sm font-medium text-blue-600">
                    {item.workers.length} чел. — {formatMoney(item.total_brigade_amount ?? 0)}
                  </span>
                </div>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {item.workers.map((w, widx) => (
                  <details key={widx} className="pl-4 border-l-2 border-gray-200">
                    <summary className="py-1 cursor-pointer text-gray-800">
                      <span className="font-medium">{w.worker.full_name}</span>
                      <span className="ml-2 text-gray-500 text-sm">{w.worker.position}</span>
                      <span className="float-right mr-4 font-medium">{formatMoney(w.total_amount ?? 0)}</span>
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 text-sm">
                      {w.details.map(d => (
                        <li key={d.id} className="text-gray-600">
                          {formatDate(d.date)} — {d.workTypeName}: {d.quantity} {d.unit} × {formatMoney(d.rate)} = {formatMoney(d.amount)}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}