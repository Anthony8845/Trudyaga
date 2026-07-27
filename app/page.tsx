// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getWorkers,
  getWorkTypes,
  getWorkLogs,
  addWorkLog,
  addWorkLogForBrigade,
  getBrigades,
  Worker,
  WorkType,
  WorkLog,
  Brigade,
} from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';
  const brigadeId = user?.brigadeId;;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);

  // Поля формы
  const [targetType, setTargetType] = useState<'worker' | 'brigade'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<number>(0);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<number>(0);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number>(0);
  const [quantity, setQuantity] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  const loadData = async () => {
    const [w, wt, l, b] = await Promise.all([
      getWorkers(),
      getWorkTypes(),
      getWorkLogs(),
      getBrigades(),
    ]);
    setWorkers(w);
    setWorkTypes(wt);
    setBrigades(b);

    // Фильтрация по бригаде для бригадира
    if (!isManager && brigadeId) {
  const brigadeWorkerIds = w.filter(wk => wk.brigade_id === brigadeId).map(wk => wk.id);
    setLogs(l.filter(log => brigadeWorkerIds.includes(log.worker_id) && log.status === 'approved')
      .sort((a, b) => b.log_date.localeCompare(a.log_date)));
  } else {
    // Администратор и супервизор видят все записи
    setLogs(l.sort((a, b) => b.log_date.localeCompare(a.log_date)));
  }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkTypeId || !quantity || parseFloat(quantity) <= 0) return;

    if (targetType === 'worker' && !selectedWorkerId) return;
    if (targetType === 'brigade' && !selectedBrigadeId) return;

    try {
      if (targetType === 'worker') {
        await addWorkLog({
          worker_id: selectedWorkerId,
          work_type_id: selectedWorkTypeId,
          quantity: parseFloat(quantity),
          log_date: date,
        });
      } else {
        await addWorkLogForBrigade(
          selectedBrigadeId,
          selectedWorkTypeId,
          parseFloat(quantity),
          date
        );
      }
      // Сброс формы
      setSelectedWorkerId(0);
      setSelectedBrigadeId(0);
      setSelectedWorkTypeId(0);
      setQuantity('');
      loadData();
    } catch (error) {
      alert('Ошибка при добавлении записи');
      console.error(error);
    }
  };

  const findWorker = (id: number) => workers.find(w => w.id === id);
  const findWorkType = (id: number) => workTypes.find(wt => wt.id === id);

  return (
    <div className="space-y-8">
      {/* Форма доступна только админу */}
      {isManager && (
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Добавить запись</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Выбор типа цели */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Назначить работу</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="worker"
                    checked={targetType === 'worker'}
                    onChange={() => setTargetType('worker')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Сотруднику</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="brigade"
                    checked={targetType === 'brigade'}
                    onChange={() => setTargetType('brigade')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Бригаде</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {targetType === 'worker' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Сотрудник</label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    required
                  >
                    <option value={0} disabled>Выберите...</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.full_name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Бригада</label>
                  <select
                    value={selectedBrigadeId}
                    onChange={(e) => setSelectedBrigadeId(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    required
                  >
                    <option value={0} disabled>Выберите...</option>
                    {brigades.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Вид работы</label>
                <select
                  value={selectedWorkTypeId}
                  onChange={(e) => setSelectedWorkTypeId(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                >
                  <option value={0} disabled>Выберите...</option>
                  {workTypes.map(wt => (
                    <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Количество</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Дата</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Добавить запись
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Последние записи</h2>
        {logs.length === 0 ? (
          <p className="text-gray-500">Записей пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сотрудник</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Работа</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Кол-во</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.slice(0, 20).map(log => {
                  const worker = findWorker(log.worker_id);
                  const wt = findWorkType(log.work_type_id);
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-2 text-sm">{formatDate(log.log_date)}</td>
                      <td className="px-4 py-2 text-sm">{worker?.full_name || '—'}</td>
                      <td className="px-4 py-2 text-sm">{wt?.name || '—'}</td>
                      <td className="px-4 py-2 text-sm">{log.quantity} {wt?.unit || ''}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatMoney(log.amount)}</td>
                      <td>{log.status === 'approved' ? '✅' : log.status === 'rejected' ? '❌' : '⏳'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}