'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/lib/utils';
import {
  getBrigades,
  getWorkTypes,
  getWorkCategories,
  updateWorkLog,
  deleteWorkLog,
  addWorkLog,
  WorkType,
  WorkCategory,
} from '@/lib/data';

export default function SupervisorPage() {
  const { user } = useAuth();
  const [brigades, setBrigades] = useState<any[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Редактирование одиночной записи
  const [editingLog, setEditingLog] = useState<any | null>(null);
  // Редактирование бригадной группы
  const [editingGroup, setEditingGroup] = useState<any | null>(null);

  // Форма редактирования одной записи
  const [editForm, setEditForm] = useState({
    work_type_id: 0,
    quantity: '',
    log_date: '',
  });

  // Новые строки для добавления (внутри модального окна группы)
  const [newRows, setNewRows] = useState<any[]>([]);

  const loadData = async () => {
    const [b, wt, cats] = await Promise.all([
      getBrigades(),
      getWorkTypes(),
      getWorkCategories(),
    ]);
    setBrigades(b);
    setWorkTypes(wt);
    setCategories(cats);

    const { data: logs, error } = await supabase
      .from('work_logs')
      .select(`
        id, worker_id, work_type_id, quantity, log_date, object_id, amount, status, is_brigade,
        worker:workers!inner(id, full_name, brigade_id),
        work_type:work_types(id, name, unit, rate),
        object:objects(id, name, address)
      `)
      .eq('status', 'pending')
      .order('log_date', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки:', error);
      return;
    }

    const objectMap = new Map<any, any>();
    const noObject = {
      id: null,
      name: 'Без объекта',
      address: '',
      brigades: new Map<string, any>(),
      soloWorkers: new Map<number, { worker: any; logs: any[] }>(),
    };

    for (const log of logs as any[]) {
      const objId = log.object?.id ?? null;
      if (!objectMap.has(objId) && objId !== null) {
        objectMap.set(objId, {
          id: objId,
          name: log.object?.name || '',
          address: log.object?.address || '',
          brigades: new Map<string, any>(),
          soloWorkers: new Map<number, any>(),
        });
      }
      const objGroup = objId === null ? noObject : objectMap.get(objId);

      if (log.is_brigade) {
        const brigadeId = log.worker?.brigade_id;
        const brigadeName = b.find(br => br.id === brigadeId)?.name || 'Без бригады';
        if (!objGroup.brigades.has(brigadeName)) {
          objGroup.brigades.set(brigadeName, new Map<string, any>());
        }
        const brigadeGroups = objGroup.brigades.get(brigadeName);
        const groupKey = `${log.object_id ?? 'null'}_${log.log_date}_${log.work_type_id}`;
        if (!brigadeGroups.has(groupKey)) {
          brigadeGroups.set(groupKey, {
            key: groupKey,
            ids: [],
            work_type: log.work_type,
            quantity: log.quantity,
            log_date: log.log_date,
            totalAmount: 0,
          });
        }
        const group = brigadeGroups.get(groupKey);
        group.ids.push(log.id);
        group.totalAmount += log.amount;
      } else {
        const workerId = log.worker.id;
        if (!objGroup.soloWorkers.has(workerId)) {
          objGroup.soloWorkers.set(workerId, {
            worker: log.worker,
            logs: [],
          });
        }
        objGroup.soloWorkers.get(workerId).logs.push(log);
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

  if (user?.role !== 'supervisor') {
    return <div className="p-4 text-red-500">Доступ запрещён</div>;
  }

  const handleApprove = async (ids: number[]) => {
    await Promise.all(ids.map(id => supabase.from('work_logs').update({ status: 'approved' }).eq('id', id)));
    loadData();
    setSelectedIds(new Set());
  };

  const handleReject = async (ids: number[]) => {
    if (confirm('Отклонить и удалить выбранные записи?')) {
      await Promise.all(ids.map(id => deleteWorkLog(id)));
      loadData();
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // ----- Одиночная запись -----
  const startEdit = (log: any) => {
    setEditingLog(log);
    setEditForm({
      work_type_id: log.work_type_id,
      quantity: String(log.quantity),
      log_date: log.log_date,
    });
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    const wt = workTypes.find(w => w.id === editForm.work_type_id);
    const rate = wt?.rate || 0;
    const newAmount = parseFloat(editForm.quantity) * rate;

    await updateWorkLog(editingLog.id, {
      work_type_id: editForm.work_type_id,
      quantity: parseFloat(editForm.quantity),
      log_date: editForm.log_date,
      amount: newAmount,
    });
    setEditingLog(null);
    loadData();
  };

  // ----- Бригадная группа -----
  const startEditGroup = (group: any) => {
    setEditingGroup(group);
    setEditForm({
      work_type_id: group.work_type?.id || 0,
      quantity: String(group.quantity),
      log_date: group.log_date,
    });
    setNewRows([]);
  };

  const addNewRow = () => {
    setNewRows(prev => [
      ...prev,
      { id: Date.now(), work_type_id: 0, quantity: '', log_date: editForm.log_date || new Date().toISOString().split('T')[0] },
    ]);
  };

  const updateNewRow = (index: number, field: string, value: any) => {
    setNewRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeNewRow = (index: number) => {
    setNewRows(prev => prev.filter((_, i) => i !== index));
  };

  const saveEditGroup = async () => {
    if (!editingGroup) return;
    const wt = workTypes.find(w => w.id === editForm.work_type_id);
    const rate = wt?.rate || 0;
    const newAmount = parseFloat(editForm.quantity) * rate;
    const amountPerWorker = newAmount / editingGroup.ids.length;

    await Promise.all(
      editingGroup.ids.map((id: number) =>
        updateWorkLog(id, {
          work_type_id: editForm.work_type_id,
          quantity: parseFloat(editForm.quantity),
          log_date: editForm.log_date,
          amount: amountPerWorker,
        })
      )
    );

    // Добавляем новые работы для каждого сотрудника группы
    if (newRows.length > 0) {
      // Находим всех сотрудников, которые были в группе (через worker_id из исходных логов)
      const workerIds = await Promise.all(
        editingGroup.ids.map(async (id: number) => {
          const { data } = await supabase.from('work_logs').select('worker_id').eq('id', id).single();
          return data?.worker_id;
        })
      );
      const uniqueWorkerIds = Array.from(new Set(workerIds.filter(Boolean)));

      for (const row of newRows) {
        for (const workerId of uniqueWorkerIds) {
          await addWorkLog({
            worker_id: workerId,
            work_type_id: row.work_type_id,
            quantity: parseFloat(row.quantity),
            log_date: row.log_date,
            object_id: editingGroup.ids.length > 0 ? (await supabase.from('work_logs').select('object_id').eq('id', editingGroup.ids[0]).single()).data?.object_id : undefined,
            is_brigade: true,
          } as any);
        }
      }
    }

    setEditingGroup(null);
    setNewRows([]);
    loadData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold mb-4">Подтверждение работ</h1>

      {groupedData.length === 0 && <p className="text-gray-500">Нет неподтверждённых записей</p>}

      {groupedData.map(obj => (
        <details key={obj.id ?? 'no-obj'} className="bg-white rounded-xl shadow mb-4" open>
          <summary className="p-4 cursor-pointer hover:bg-gray-50 font-semibold flex justify-between items-center">
            <span>
              {obj.name}
              {obj.address && <span className="text-sm text-gray-500 ml-2">({obj.address})</span>}
            </span>
            <span className="text-sm text-gray-500">
              {obj.brigades.size + obj.soloWorkers.size} записи(ей)
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-6">
            {/* Бригадные работы */}
            {obj.brigades.size > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Бригадные работы</h3>
                {Array.from(obj.brigades.entries() as [string, any][]).map(([brigadeName, groupsMap]) => (
                  <div key={brigadeName} className="ml-2 border-l-2 border-blue-200 pl-2 mb-3">
                    <p className="text-sm font-medium">{brigadeName}</p>
                    {Array.from(groupsMap.values()).map((group: any) => (
                      <div key={group.key} className="flex items-center justify-between py-1 text-sm gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={group.ids.every((id: number) => selectedIds.has(id))}
                            onChange={() => {
                              const newSet = new Set(selectedIds);
                              if (group.ids.every((id: number) => newSet.has(id))) {
                                group.ids.forEach((id: number) => newSet.delete(id));
                              } else {
                                group.ids.forEach((id: number) => newSet.add(id));
                              }
                              setSelectedIds(newSet);
                            }}
                          />
                          <span>
                            {formatDate(group.log_date)} — {group.work_type?.name}: {group.quantity} {group.work_type?.unit} × {formatMoney(group.work_type?.rate)} = <strong>{formatMoney(group.totalAmount)}</strong>
                          </span>
                        </label>
                        <span className="flex gap-2">
                          <button
                            onClick={() => startEditGroup(group)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                            title="Редактировать"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleApprove(group.ids)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleReject(group.ids)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            ✗
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Одиночные работы */}
            {obj.soloWorkers.size > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Работы сотрудников</h3>
                {Array.from(obj.soloWorkers.values()).map((workerEntry: any) => (
                  <div key={workerEntry.worker.id} className="ml-2 mb-3">
                    <p className="text-sm font-medium">{workerEntry.worker.full_name}</p>
                    {workerEntry.logs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between py-1 text-sm gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={() => toggleSelect(log.id)}
                          />
                          <span>
                            {formatDate(log.log_date)} — {log.work_type?.name}: {log.quantity} {log.work_type?.unit} × {formatMoney(log.work_type?.rate)} = <strong>{formatMoney(log.amount)}</strong>
                          </span>
                        </label>
                        <span className="flex gap-2">
                          <button onClick={() => startEdit(log)} className="text-blue-600 hover:text-blue-800 text-xs" title="Редактировать">✎</button>
                          <button onClick={() => handleApprove([log.id])} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">✓</button>
                          <button onClick={() => handleReject([log.id])} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">✗</button>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}

      {/* Массовое подтверждение */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-xl p-4 flex items-center gap-3 z-50">
          <span className="text-sm font-medium">Выбрано: {selectedIds.size}</span>
          <button
            onClick={() => handleApprove(Array.from(selectedIds))}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Подтвердить выбранные
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 bg-gray-200 rounded-md">
            Сбросить
          </button>
        </div>
      )}

      {/* Модальное окно редактирования одиночной работы */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Редактирование работы</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Вид работы</label>
                <select
                  value={editForm.work_type_id}
                  onChange={e => setEditForm({ ...editForm, work_type_id: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value={0} disabled>Выберите...</option>
                  {categories.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {workTypes.filter(wt => wt.category_id === cat.id).map(wt => (
                        <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                      ))}
                    </optgroup>
                  ))}
                  {workTypes.some(wt => wt.category_id == null) && (
                    <optgroup label="Без категории">
                      {workTypes.filter(wt => wt.category_id == null).map(wt => (
                        <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Количество</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.quantity}
                  onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Дата</label>
                <input
                  type="date"
                  value={editForm.log_date}
                  onChange={e => setEditForm({ ...editForm, log_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingLog(null)} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-md">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования бригадной группы */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Редактирование бригадной работы</h2>

            {/* Основная запись группы */}
            <div className="space-y-3 border-b pb-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700">Основная работа</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Вид работы</label>
                <select
                  value={editForm.work_type_id}
                  onChange={e => setEditForm({ ...editForm, work_type_id: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value={0} disabled>Выберите...</option>
                  {categories.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {workTypes.filter(wt => wt.category_id === cat.id).map(wt => (
                        <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                      ))}
                    </optgroup>
                  ))}
                  {workTypes.some(wt => wt.category_id == null) && (
                    <optgroup label="Без категории">
                      {workTypes.filter(wt => wt.category_id == null).map(wt => (
                        <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Количество</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.quantity}
                  onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Дата</label>
                <input
                  type="date"
                  value={editForm.log_date}
                  onChange={e => setEditForm({ ...editForm, log_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
            </div>

            {/* Новые работы */}
            {newRows.length > 0 && (
              <div className="space-y-3 mb-4">
                <h3 className="text-sm font-medium text-gray-700">Новые работы</h3>
                {newRows.map((row, idx) => (
                  <div key={row.id} className="flex flex-wrap items-end gap-2 border p-2 rounded bg-gray-50">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-medium text-gray-500">Вид работы</label>
                      <select
                        value={row.work_type_id}
                        onChange={e => updateNewRow(idx, 'work_type_id', Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      >
                        <option value={0} disabled>Выберите...</option>
                        {categories.map(cat => (
                          <optgroup key={cat.id} label={cat.name}>
                            {workTypes.filter(wt => wt.category_id === cat.id).map(wt => (
                              <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                            ))}
                          </optgroup>
                        ))}
                        {workTypes.some(wt => wt.category_id == null) && (
                          <optgroup label="Без категории">
                            {workTypes.filter(wt => wt.category_id == null).map(wt => (
                              <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs font-medium text-gray-500">Количество</label>
                      <input
                        type="number"
                        step="any"
                        value={row.quantity}
                        onChange={e => updateNewRow(idx, 'quantity', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs font-medium text-gray-500">Дата</label>
                      <input
                        type="date"
                        value={row.log_date}
                        onChange={e => updateNewRow(idx, 'log_date', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewRow(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Удалить строку"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addNewRow}
              className="mb-4 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
            >
              + Добавить работу
            </button>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditingGroup(null); setNewRows([]); }} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
              <button onClick={saveEditGroup} className="px-4 py-2 bg-blue-600 text-white rounded-md">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}