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
  getWorkLogsGroupedByBrigade,
  getWorkLogs,
  updateWorkLog,
  deleteWorkLog,
  Worker,
  WorkType,
  Brigade,
  ObjectItem,
  WorkLog,
} from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';

interface WorkRow {
  id: number;
  work_type_id: number;
  quantity: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);

  const [viewMode, setViewMode] = useState<'byBrigade' | 'table'>('byBrigade');

  // Форма добавления
  const [targetType, setTargetType] = useState<'worker' | 'brigade'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<number>(0);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<number>(0);
  const [selectedObjectId, setSelectedObjectId] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<WorkRow[]>([
    { id: Date.now(), work_type_id: 0, quantity: '' },
  ]);

  // Редактирование
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<WorkRow>({
    id: 0, work_type_id: 0, quantity: '',
  });

  // Фильтры и сортировка
  const [sortField, setSortField] = useState<'log_date' | 'amount'>('log_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterWorker, setFilterWorker] = useState<number>(0);
  const [filterObject, setFilterObject] = useState<number>(0);

  const loadData = async () => {
    const [w, wt, b, obj] = await Promise.all([
      getWorkers(), getWorkTypes(), getBrigades(), getObjects(),
    ]);
    setWorkers(w);
    setWorkTypes(wt);
    setBrigades(b);
    setObjects(obj);

    const [grouped, allLogs] = await Promise.all([
      getWorkLogsGroupedByBrigade(),
      getWorkLogs(),
    ]);
    setGroupedData(grouped);
    setLogs(allLogs);
  };

  useEffect(() => { loadData(); }, []);

  const resetBatchForm = () => {
    setTargetType('worker');
    setSelectedWorkerId(0);
    setSelectedBrigadeId(0);
    setSelectedObjectId(0);
    setDate(new Date().toISOString().split('T')[0]);
    setRows([{ id: Date.now(), work_type_id: 0, quantity: '' }]);
    setEditingLogId(null);
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now(), work_type_id: 0, quantity: '' }]);
  };

  const updateRow = (index: number, field: keyof WorkRow, value: any) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjectId) return alert('Выберите объект');
    if (rows.some(r => !r.work_type_id || !r.quantity)) return alert('Заполните все строки');

    try {
      const promises = rows.map(row => {
        const qty = parseFloat(row.quantity);
        if (targetType === 'worker') {
          if (!selectedWorkerId) throw new Error('Выберите сотрудника');
          return addWorkLog({
            worker_id: selectedWorkerId,
            work_type_id: row.work_type_id,
            quantity: qty,
            log_date: date,
            object_id: selectedObjectId,
          } as any);
        } else {
          if (!selectedBrigadeId) throw new Error('Выберите бригаду');
          return addWorkLogForBrigade(selectedBrigadeId, row.work_type_id, qty, date, selectedObjectId);
        }
      });
      await Promise.all(promises);
      resetBatchForm();
      loadData();
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  };

  const startEdit = (log: any) => {
    setEditingLogId(log.id);
    setTargetType(log.worker_id ? 'worker' : 'brigade');
    setSelectedWorkerId(log.worker_id || 0);
    setSelectedBrigadeId(0);
    setSelectedObjectId(log.object_id || 0);
    setDate(log.log_date);
    setEditingRow({ id: 0, work_type_id: log.work_type_id, quantity: String(log.quantity) });
    setRows([]);
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    resetBatchForm();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow.work_type_id || !editingRow.quantity || !selectedObjectId) return alert('Заполните все поля');
    try {
      const wt = workTypes.find(w => w.id === editingRow.work_type_id);
      const newAmount = wt ? parseFloat(editingRow.quantity) * wt.rate : 0;
      await updateWorkLog(editingLogId!, {
        worker_id: targetType === 'worker' ? selectedWorkerId : undefined,
        work_type_id: editingRow.work_type_id,
        quantity: parseFloat(editingRow.quantity),
        log_date: date,
        object_id: selectedObjectId,
        amount: newAmount,
      });
      cancelEdit();
      loadData();
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Удалить запись?')) {
      await deleteWorkLog(id);
      loadData();
    }
  };

  const getWorkerName = (id: number) => workers.find(w => w.id === id)?.full_name;
  const getWorkType = (id: number) => workTypes.find(wt => wt.id === id);
  const getObjectName = (id?: number) => id ? objects.find(o => o.id === id)?.name : '—';

  const filteredLogs = logs
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
      {isManager && !editingLogId && (
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Добавить работы</h2>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Объект</label>
              <select value={selectedObjectId} onChange={e => setSelectedObjectId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                <option value={0} disabled>Выберите объект</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex space-x-4">
              <label className="inline-flex items-center"><input type="radio" value="worker" checked={targetType === 'worker'} onChange={() => setTargetType('worker')} className="text-blue-600" /><span className="ml-2 text-sm">Сотруднику</span></label>
              <label className="inline-flex items-center"><input type="radio" value="brigade" checked={targetType === 'brigade'} onChange={() => setTargetType('brigade')} className="text-blue-600" /><span className="ml-2 text-sm">Бригаде</span></label>
            </div>
            {targetType === 'worker' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Сотрудник</label>
                <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                  <option value={0} disabled>Выберите...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
            )}
            {targetType === 'brigade' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Бригада</label>
                <select value={selectedBrigadeId} onChange={e => setSelectedBrigadeId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                  <option value={0} disabled>Выберите...</option>
                  {brigades.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            {/* Строки */}
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500">Вид работы</label>
                    <select value={row.work_type_id} onChange={e => updateRow(idx, 'work_type_id', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm" required>
                      <option value={0} disabled>Выберите...</option>
                      {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs font-medium text-gray-500">Количество</label>
                    <input type="number" step="any" min="0" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm" required />
                  </div>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-sm" title="Удалить строку">✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <button type="button" onClick={addRow} className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200">+ Добавить ещё</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить все</button>
            </div>
          </form>
        </section>
      )}

      {/* Редактирование */}
      {isManager && editingLogId && (
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Редактировать запись</h2>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Объект</label>
              <select value={selectedObjectId} onChange={e => setSelectedObjectId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                <option value={0} disabled>Выберите объект</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex space-x-4">
              <label className="inline-flex items-center"><input type="radio" value="worker" checked={targetType === 'worker'} onChange={() => setTargetType('worker')} className="text-blue-600" /><span className="ml-2 text-sm">Сотруднику</span></label>
              <label className="inline-flex items-center"><input type="radio" value="brigade" checked={targetType === 'brigade'} onChange={() => setTargetType('brigade')} className="text-blue-600" /><span className="ml-2 text-sm">Бригаде</span></label>
            </div>
            {targetType === 'worker' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Сотрудник</label>
                <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                  <option value={0} disabled>Выберите...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Бригада</label>
                <select value={selectedBrigadeId} onChange={e => setSelectedBrigadeId(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                  <option value={0} disabled>Выберите...</option>
                  {brigades.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Вид работы</label>
              <select value={editingRow.work_type_id} onChange={e => setEditingRow(prev => ({ ...prev, work_type_id: Number(e.target.value) }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
                <option value={0} disabled>Выберите...</option>
                {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Количество</label>
              <input type="number" step="any" min="0" value={editingRow.quantity} onChange={e => setEditingRow(prev => ({ ...prev, quantity: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
          </form>
        </section>
      )}

        {/* Переключатель вида журнала */}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold mr-4">Журнал работ</h2>
        <button
          onClick={() => setViewMode('byBrigade')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'byBrigade' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          По бригадам
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Таблица
        </button>
      </div>

      {/* Представление "По бригадам" */}
      {viewMode === 'byBrigade' && (
        <div className="space-y-4">
          {groupedData.length === 0 && (
            <p className="text-gray-500">Нет добавленных работ.</p>
          )}
          {groupedData.map(brigade => (
            <details key={brigade.brigadeId ?? 'no-brig'} className="bg-white rounded-xl shadow" open>
              <summary className="p-4 cursor-pointer hover:bg-gray-50 font-semibold">
                {brigade.brigadeName}
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {brigade.workers.map((w: any) => (
                  <div key={w.worker?.id ?? 'unassigned'}>
                    {w.worker ? (
                      <p className="text-sm font-medium text-gray-700 mb-1">{w.worker.full_name}</p>
                    ) : (
                      <p className="text-sm font-medium text-gray-700 mb-1">Без сотрудника</p>
                    )}
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
                                const isPending = log.status === 'pending';
                                return (
                                  <li key={log.id} className={`text-sm text-gray-600 flex items-center justify-between ${
                                    isPending ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-2' : ''
                                  }`}>
                                    <span>
                                      {isPending && '⏳ '}
                                      {formatDate(log.log_date)} — {workTypeName}:{' '}
                                      {log.quantity} {unit} ×{' '}
                                      {formatMoney(rate)} ={' '}
                                      <span className="font-medium">{formatMoney(log.amount)}</span>
                                    </span>
                                    {isManager && (
                                      <span className="flex gap-1 ml-2">
                                        <button onClick={() => startEdit(log)} className="text-blue-600 hover:text-blue-800 text-xs" title="Редактировать">✎</button>
                                        <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-800 text-xs" title="Удалить">✕</button>
                                      </span>
                                    )}
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
        </div>
      )}

      {/* Представление "Таблица" */}
      {viewMode === 'table' && (
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Таблица работ</h2>
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
                  {isManager && <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Действия</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map(log => {
                  const worker = getWorkerName(log.worker_id);
                  const wt = getWorkType(log.work_type_id);
                  const isPending = log.status === 'pending';
                  return (
                    <tr key={log.id} className={isPending ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-2">{formatDate(log.log_date)}</td>
                      <td className="px-3 py-2">{getObjectName(log.object_id)}</td>
                      <td className="px-3 py-2">{worker}</td>
                      <td className="px-3 py-2">{wt?.name}</td>
                      <td className="px-3 py-2 text-right">{log.quantity} {wt?.unit}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoney(log.amount)}</td>
                      {isManager && (
                        <td className="px-3 py-2 text-right space-x-2">
                          <button onClick={() => startEdit(log)} className="text-blue-600 hover:text-blue-800">Ред.</button>
                          <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-800">Уд.</button>
                        </td>
                      )}
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