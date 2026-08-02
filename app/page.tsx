'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getWorkers,
  getWorkTypes,
  getBrigades,
  getObjects,
  addWorkLog,
  addWorkLogForBrigade,
  getWorkLogs,
  getWorkLogsGroupedByBrigade,
  Worker,
  WorkType,
  Brigade,
  ObjectItem,
} from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';

  // Справочники
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [objects, setObjects] = useState<ObjectItem[]>([]);

  // Данные для двух видов
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [tableLogs, setTableLogs] = useState<any[]>([]);

  // Режим отображения
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Форма добавления
  const [targetType, setTargetType] = useState<'worker' | 'brigade'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<number>(0);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<number>(0);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number>(0);
  const [selectedObjectId, setSelectedObjectId] = useState<number>(0);
  const [quantity, setQuantity] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Фильтры и сортировка для таблицы
  const [sortField, setSortField] = useState<'log_date' | 'amount'>('log_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterWorker, setFilterWorker] = useState<number>(0);
  const [filterObject, setFilterObject] = useState<number>(0);

  const loadData = async () => {
    const [w, wt, b, obj, grouped, logs] = await Promise.all([
      getWorkers(),
      getWorkTypes(),
      getBrigades(),
      getObjects(),
      getWorkLogsGroupedByBrigade(),
      getWorkLogs(),
    ]);
    setWorkers(w);
    setWorkTypes(wt);
    setBrigades(b);
    setObjects(obj);
    setGroupedData(grouped);
    setTableLogs(logs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkTypeId || !quantity || !selectedObjectId) return;
    if (targetType === 'worker' && !selectedWorkerId) return;
    if (targetType === 'brigade' && !selectedBrigadeId) return;

    try {
      if (targetType === 'worker') {
        await addWorkLog({
          worker_id: selectedWorkerId,
          work_type_id: selectedWorkTypeId,
          quantity: parseFloat(quantity),
          log_date: date,
          object_id: selectedObjectId,
        } as any);
      } else {
        await addWorkLogForBrigade(
          selectedBrigadeId,
          selectedWorkTypeId,
          parseFloat(quantity),
          date,
          selectedObjectId
        );
      }
      setSelectedWorkerId(0);
      setSelectedBrigadeId(0);
      setSelectedWorkTypeId(0);
      setSelectedObjectId(0);
      setQuantity('');
      loadData();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const getWorkerName = (id: number) => workers.find(w => w.id === id)?.full_name;
  const getWorkType = (id: number) => workTypes.find(wt => wt.id === id);
  const getObjectName = (id?: number) => id ? objects.find(o => o.id === id)?.name : '—';

  // Фильтрация и сортировка для таблицы
  const filteredTableLogs = tableLogs
    .filter(log => !filterWorker || log.worker_id === filterWorker)
    .filter(log => !filterObject || log.object_id === filterObject)
    .sort((a, b) => {
      const aVal = sortField === 'log_date' ? a.log_date : a.amount;
      const bVal = sortField === 'log_date' ? b.log_date : b.amount;
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  return (
    <div className="space-y-8">
      {/* Форма добавления */}
      {isManager && (
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Добавить запись</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Объект</label>
              <select
                value={selectedObjectId}
                onChange={e => setSelectedObjectId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              >
                <option value={0} disabled>Выберите объект</option>
                {objects.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="worker"
                  checked={targetType === 'worker'}
                  onChange={() => setTargetType('worker')}
                  className="text-blue-600"
                />
                <span className="ml-2 text-sm">Сотруднику</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="brigade"
                  checked={targetType === 'brigade'}
                  onChange={() => setTargetType('brigade')}
                  className="text-blue-600"
                />
                <span className="ml-2 text-sm">Бригаде</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {targetType === 'worker' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Сотрудник</label>
                  <select
                    value={selectedWorkerId}
                    onChange={e => setSelectedWorkerId(Number(e.target.value))}
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
                    onChange={e => setSelectedBrigadeId(Number(e.target.value))}
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
                  onChange={e => setSelectedWorkTypeId(Number(e.target.value))}
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
                  onChange={e => setQuantity(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Дата</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
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
                Добавить
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Переключатель представлений */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Журнал работ</h2>
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1 text-sm ${viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            По бригадам
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            Таблица
          </button>
        </div>
      </div>

      {/* Представление "По бригадам" */}
      {viewMode === 'grouped' && (
        <section className="space-y-4">
          {groupedData.length === 0 && (
            <p className="text-gray-500">Нет добавленных работ.</p>
          )}
          {groupedData.map(brigade => (
            <details
              key={brigade.brigadeId ?? 'no-brig'}
              className="bg-white rounded-xl shadow"
              open
            >
              <summary className="p-4 cursor-pointer hover:bg-gray-50 font-semibold">
                {brigade.brigadeName}
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {brigade.workers.map((w: any) => (
                  <div key={w.worker?.id ?? 'unassigned'}>
                    {w.worker ? (
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {w.worker.full_name}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-gray-700 mb-1">Без сотрудника</p>
                    )}
                    {/* Группируем по объектам */}
                    {(() => {
                      const objMap = new Map<string, any[]>();
                      w.logs.forEach((log: any) => {
                        const objKey = log.object?.id ?? 'no-object';
                        if (!objMap.has(objKey)) objMap.set(objKey, []);
                        objMap.get(objKey)!.push(log);
                      });
                      return Array.from(objMap.entries()).map(([objKey, logs]) => {
                        const objName = logs[0]?.object?.name || 'Без объекта';
                        return (
                          <div key={objKey} className="ml-4 mb-2">
                            <p className="text-xs text-gray-500 mb-1">{objName}</p>
                            <ul className="space-y-1">
                              {logs.map((log: any) => {
                                const workTypeName = log.work_type?.name || '?';
                                const unit = log.work_type?.unit || '';
                                const rate = log.work_type?.rate || 0;
                                return (
                                  <li key={log.id} className="text-sm text-gray-600">
                                    {formatDate(log.log_date)} — {workTypeName}:{' '}
                                    {log.quantity} {unit} ×{' '}
                                    {formatMoney(rate)} ={' '}
                                    <span className="font-medium">{formatMoney(log.amount)}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </section>
      )}

      {/* Представление "Таблица" */}
      {viewMode === 'table' && (
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              <select value={filterObject} onChange={e => setFilterObject(Number(e.target.value))} className="rounded-md border-gray-300 text-sm">
                <option value={0}>Все объекты</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={filterWorker} onChange={e => setFilterWorker(Number(e.target.value))} className="rounded-md border-gray-300 text-sm">
                <option value={0}>Все сотрудники</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
              </select>
              <button onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')} className="px-2 py-1 bg-gray-100 rounded text-sm">
                {sortField === 'log_date' ? 'Дата' : 'Сумма'} {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortField('log_date')}>Дата</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Объект</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Сотрудник</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Работа</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Кол-во</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortField('amount')}>Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTableLogs.map((log: any) => {
                  const worker = getWorkerName(log.worker_id);
                  const wt = getWorkType(log.work_type_id);
                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-2">{formatDate(log.log_date)}</td>
                      <td className="px-3 py-2">{getObjectName(log.object_id)}</td>
                      <td className="px-3 py-2">{worker}</td>
                      <td className="px-3 py-2">{wt?.name}</td>
                      <td className="px-3 py-2 text-right">{log.quantity} {wt?.unit}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoney(log.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}