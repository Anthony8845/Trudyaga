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
  updateWorkLog,
  deleteWorkLog,
  Worker,
  WorkType,
  Brigade,
  ObjectItem,
} from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

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

  // Форма добавления
  const [targetType, setTargetType] = useState<'worker' | 'brigade'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<number>(0);
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<number>(0);
  const [selectedObjectId, setSelectedObjectId] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<WorkRow[]>([
    { id: Date.now(), work_type_id: 0, quantity: '' },
  ]);

  // Редактирование объекта
  const [editingObjectId, setEditingObjectId] = useState<number | null>(null);
  const [editBrigadeGroups, setEditBrigadeGroups] = useState<any[]>([]);
  const [editSoloRows, setEditSoloRows] = useState<any[]>([]);

  const loadData = async () => {
    const [w, wt, b, obj] = await Promise.all([
      getWorkers(),
      getWorkTypes(),
      getBrigades(),
      getObjects(),
    ]);
    setWorkers(w);
    setWorkTypes(wt);
    setBrigades(b);
    setObjects(obj);

    const grouped = await getWorkLogsGroupedByBrigade();

    const objectMap = new Map<any, any>();
    const noObject = {
      id: null,
      name: 'Без объекта',
      brigades: new Map<string, any>(),
      soloWorkers: new Map<number, { worker: any; logs: any[] }>(),
    };

    for (const brigade of grouped) {
      for (const worker of brigade.workers) {
        if (!worker.worker) continue;
        for (const log of worker.logs) {
          const objId = log.object?.id ?? null;
          if (!objectMap.has(objId) && objId !== null) {
            objectMap.set(objId, {
              id: objId,
              name: log.object?.name || '',
              brigades: new Map<string, any>(),
              soloWorkers: new Map<number, any>(),
            });
          }
          const objGroup = objId === null ? noObject : objectMap.get(objId);

          if (log.is_brigade) {
            // Группируем бригадные записи по object_id, log_date, work_type_id
            const groupKey = `${log.object_id ?? 'null'}_${log.log_date}_${log.work_type_id}`;
            if (!objGroup.brigades.has(groupKey)) {
              objGroup.brigades.set(groupKey, {
                key: groupKey,
                work_type: log.work_type,
                quantity: log.quantity,
                rate: log.work_type?.rate,
                totalAmount: 0,
                logs: [],
                log_date: log.log_date,
              });
            }
            const group = objGroup.brigades.get(groupKey);
            group.logs.push(log);
            group.totalAmount += log.amount;
          } else {
            if (!objGroup.soloWorkers.has(worker.worker.id)) {
              objGroup.soloWorkers.set(worker.worker.id, {
                worker: worker.worker,
                logs: [],
              });
            }
            objGroup.soloWorkers.get(worker.worker.id).logs.push(log);
          }
        }
      }
    }

    const result = Array.from(objectMap.values());
    if (noObject.brigades.size > 0 || noObject.soloWorkers.size > 0) {
      result.push(noObject);
    }
    setGroupedData(result);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetBatchForm = () => {
    setTargetType('worker');
    setSelectedWorkerId(0);
    setSelectedBrigadeId(0);
    setSelectedObjectId(0);
    setDate(new Date().toISOString().split('T')[0]);
    setRows([{ id: Date.now(), work_type_id: 0, quantity: '' }]);
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
    if (rows.some(row => !row.work_type_id || !row.quantity)) return alert('Заполните все строки');

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

  const handleDelete = async (id: number) => {
    if (confirm('Удалить запись?')) {
      await deleteWorkLog(id);
      loadData();
    }
  };

  const startEditObject = async (objectId: number | null) => {
    let query = supabase
      .from('work_logs')
      .select('id, worker_id, work_type_id, quantity, log_date, object_id, amount, is_brigade, worker:workers!inner(id, full_name, brigade_id)')
      .order('log_date', { ascending: false });

    if (objectId === null) {
      query = query.is('object_id', null);
    } else {
      query = query.eq('object_id', objectId);
    }

    const { data: logs, error } = await query;
    if (error || !logs) {
      alert('Ошибка загрузки данных');
      return;
    }
    if (logs.length === 0) {
      alert('Нет записей для этого объекта');
      return;
    }

    const brigadeLogs = logs.filter((log: any) => log.is_brigade);
    const soloLogs = logs.filter((log: any) => !log.is_brigade);

    const groupMap = new Map<string, any[]>();
    brigadeLogs.forEach((log: any) => {
      const key = `${log.object_id ?? 'null'}_${log.log_date}_${log.work_type_id}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(log);
    });

    const brigadeGroups: any[] = [];
    groupMap.forEach((groupLogs) => {
      const first = groupLogs[0];
      brigadeGroups.push({
        key: `${first.object_id ?? 'null'}_${first.log_date}_${first.work_type_id}`,
        ids: groupLogs.map((l: any) => l.id),
        work_type_id: first.work_type_id,
        quantity: String(first.quantity),
        groupSize: groupLogs.length,
      });
    });

    const soloRows = soloLogs.map((log: any) => ({
      id: log.id,
      worker_name: log.worker.full_name,
      work_type_id: log.work_type_id,
      quantity: String(log.quantity),
    }));

    setEditBrigadeGroups(brigadeGroups);
    setEditSoloRows(soloRows);
    setEditingObjectId(objectId);
  };

  const cancelEditObject = () => {
    setEditingObjectId(null);
    setEditBrigadeGroups([]);
    setEditSoloRows([]);
  };

  const handleEditObjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBrigadeGroups.length && !editSoloRows.length) return;

    try {
      const updates: Promise<any>[] = [];

      editBrigadeGroups.forEach(group => {
        const wt = workTypes.find(w => w.id === group.work_type_id);
        const rate = wt ? wt.rate : 0;
        const totalAmount = parseFloat(group.quantity) * rate;
        const amountPerWorker = totalAmount / group.groupSize;

        group.ids.forEach((id: number) => {
          updates.push(
            updateWorkLog(id, {
              work_type_id: group.work_type_id,
              quantity: parseFloat(group.quantity),
              amount: amountPerWorker,
            })
          );
        });
      });

      editSoloRows.forEach(row => {
        const wt = workTypes.find(w => w.id === row.work_type_id);
        const rate = wt ? wt.rate : 0;
        const newAmount = parseFloat(row.quantity) * rate;
        updates.push(
          updateWorkLog(row.id, {
            work_type_id: row.work_type_id,
            quantity: parseFloat(row.quantity),
            amount: newAmount,
          })
        );
      });

      await Promise.all(updates);
      cancelEditObject();
      loadData();
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  };

  const updateBrigadeGroupField = (index: number, field: string, value: any) => {
    setEditBrigadeGroups(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const updateSoloRowField = (index: number, field: string, value: any) => {
    setEditSoloRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-8">
      {/* Форма добавления */}
      {isManager && editingObjectId === null && (
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

      {/* Редактирование объекта */}
      {isManager && editingObjectId !== null && (
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Редактирование объекта: {objects.find(o => o.id === editingObjectId)?.name || 'Без объекта'}
          </h2>
          <form onSubmit={handleEditObjectSubmit} className="space-y-6">
            {editBrigadeGroups.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Бригадные работы</h3>
                <div className="space-y-3">
                  {editBrigadeGroups.map((group, idx) => (
                    <div key={group.key} className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500">Вид работы</label>
                        <select
                          value={group.work_type_id}
                          onChange={e => updateBrigadeGroupField(idx, 'work_type_id', Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          required
                        >
                          <option value={0} disabled>Выберите...</option>
                          {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs font-medium text-gray-500">Количество</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={group.quantity}
                          onChange={e => updateBrigadeGroupField(idx, 'quantity', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editSoloRows.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Работы сотрудников</h3>
                <div className="space-y-3">
                  {editSoloRows.map((row, idx) => (
                    <div key={row.id} className="flex flex-wrap items-end gap-2 border p-2 rounded bg-gray-50">
                      <div className="min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-500">Сотрудник</label>
                        <div className="text-sm font-medium">{row.worker_name}</div>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500">Вид работы</label>
                        <select
                          value={row.work_type_id}
                          onChange={e => updateSoloRowField(idx, 'work_type_id', Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          required
                        >
                          <option value={0} disabled>Выберите...</option>
                          {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs font-medium text-gray-500">Количество</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.quantity}
                          onChange={e => updateSoloRowField(idx, 'quantity', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button type="button" onClick={cancelEditObject} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
          </form>
        </section>
      )}

      {/* Журнал работ – "По объектам" */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Журнал работ</h2>
        {groupedData.length === 0 && <p className="text-gray-500">Нет добавленных работ.</p>}
        {groupedData.map(obj => (
          <details key={obj.id ?? 'no-obj'} className="bg-white rounded-xl shadow" open>
            <summary className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
              <span className="font-semibold">{obj.name}</span>
              {isManager && (
                <button onClick={(e) => { e.preventDefault(); startEditObject(obj.id); }} className="text-blue-600 hover:text-blue-800 text-sm ml-2">
                  ✎ Редактировать объект
                </button>
              )}
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {/* Бригадные работы (группированные) */}
              {obj.brigades && obj.brigades.size > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Бригадные работы</h3>
                  {Array.from(obj.brigades.values()).map((group: any) => {
                    const workTypeName = group.work_type?.name || '?';
                    const unit = group.work_type?.unit || '';
                    const rate = group.rate || 0;
                    const totalAmount = group.totalAmount;
                    const isPending = group.logs.some((l: any) => l.status === 'pending');
                    return (
                      <div key={group.key} className="ml-2 border-l-2 border-blue-200 pl-2">
                        <div className={`flex items-center justify-between text-sm text-gray-600 ${isPending ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-2' : ''}`}>
                          <span>
                            {isPending && '⏳ '}
                            {formatDate(group.log_date)} — {workTypeName}: {group.quantity} {unit} × {formatMoney(rate)} = <span className="font-medium">{formatMoney(totalAmount)}</span>
                          </span>
                          <button
                            onClick={() => {
                              if (confirm('Удалить весь бригадный наряд?')) {
                                Promise.all(group.logs.map((l: any) => deleteWorkLog(l.id))).then(() => loadData());
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-xs ml-2"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Одиночные сотрудники */}
              {obj.soloWorkers && obj.soloWorkers.size > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Работы сотрудников</h3>
                  {Array.from(obj.soloWorkers.values()).map((workerEntry: any) => (
                    <div key={`solo-worker-${workerEntry.worker.id}`} className="ml-2 text-sm text-gray-600">
                      <p className="font-medium">{workerEntry.worker.full_name}</p>
                      <ul className="space-y-1">
                        {workerEntry.logs.map((log: any) => {
                          const workTypeName = log.work_type?.name || '?';
                          const unit = log.work_type?.unit || '';
                          const rate = log.work_type?.rate || 0;
                          const isPending = log.status === 'pending';
                          return (
                            <li key={`solo-log-${log.id}`} className={`flex items-center justify-between ${isPending ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-2' : ''}`}>
                              <span>
                                {isPending && '⏳ '}
                                {formatDate(log.log_date)} — {workTypeName}: {log.quantity} {unit} × {formatMoney(rate)} = <span className="font-medium">{formatMoney(log.amount)}</span>
                              </span>
                              <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-800 text-xs ml-2">✕</button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}