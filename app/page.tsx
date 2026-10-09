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
  getWorkCategories,
  Worker,
  WorkType,
  Brigade,
  ObjectItem,
  WorkCategory,
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
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [brigadeGroupedData, setBrigadeGroupedData] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'byObject' | 'byBrigade'>('byObject');

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
  const [newRows, setNewRows] = useState<any[]>([]);

  // Комментарии
  const [objectCommentsMap, setObjectCommentsMap] = useState<Record<number, any[]>>({});
  const [newCommentMap, setNewCommentMap] = useState<Record<number, string>>({});
  const [expandedObjectId, setExpandedObjectId] = useState<number | null>(null);

  // ---------- Загрузка данных ----------
  const loadData = async () => {
    const [w, wt, b, obj, cats] = await Promise.all([
      getWorkers(),
      getWorkTypes(),
      getBrigades(),
      getObjects(),
      getWorkCategories(),
    ]);
    setWorkers(w);
    setWorkTypes(wt);
    setBrigades(b);
    setObjects(obj);
    setCategories(cats);

    const grouped = await getWorkLogsGroupedByBrigade();

    // ---------- По объектам ----------
    const objectMap = new Map<any, any>();
    const noObject = {
      id: null,
      name: 'Без объекта',
      address: '',
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
              address: log.object?.address || '',
              brigades: new Map<string, any>(),
              soloWorkers: new Map<number, any>(),
            });
          }
          const objGroup = objId === null ? noObject : objectMap.get(objId);

          if (log.is_brigade) {
            const groupKey = `${log.object_id ?? 'null'}_${log.log_date}_${log.work_type_id}`;
            if (!objGroup.brigades.has(groupKey)) {
              objGroup.brigades.set(groupKey, {
                key: groupKey,
                brigadeName: brigade.brigadeName,
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

    const objectResult = Array.from(objectMap.values());
    if (noObject.brigades.size > 0 || noObject.soloWorkers.size > 0) {
      objectResult.push(noObject);
    }

    const sortedObjectResult = objectResult.sort((a: any, b: any) => {
      const getMaxDate = (obj: any) => {
        let maxDate = '';
        if (obj.brigades) {
          for (const group of obj.brigades.values()) {
            for (const log of group.logs) {
              if (log.log_date > maxDate) maxDate = log.log_date;
            }
          }
        }
        if (obj.soloWorkers) {
          for (const entry of obj.soloWorkers.values()) {
            for (const log of entry.logs) {
              if (log.log_date > maxDate) maxDate = log.log_date;
            }
          }
        }
        return maxDate;
      };
      return getMaxDate(b).localeCompare(getMaxDate(a));
    });
    setGroupedData(sortedObjectResult);

    // ---------- По бригадам ----------
    const brigadeMap = new Map<number, any>();
    const noBrigadeMap = {
      brigadeId: null,
      brigadeName: 'Без бригады',
      workers: new Map<number, any>(),
    };

    for (const brigade of grouped) {
      for (const worker of brigade.workers) {
        if (!worker.worker) continue;
        const brigadeId = worker.worker.brigade_id || null;
        const target = brigadeId === null ? noBrigadeMap : (brigadeMap.get(brigadeId) || {
          brigadeId,
          brigadeName: brigade.brigadeName || 'Бригада без названия',
          workers: new Map<number, any>(),
        });
        if (brigadeId !== null && !brigadeMap.has(brigadeId)) {
          brigadeMap.set(brigadeId, target);
        }
        for (const log of worker.logs) {
          if (!target.workers.has(worker.worker.id)) {
            target.workers.set(worker.worker.id, {
              worker: worker.worker,
              logs: [],
            });
          }
          target.workers.get(worker.worker.id).logs.push(log);
        }
      }
    }

    const brigadeResult: any[] = [];
    for (const [, brigade] of brigadeMap) {
      brigadeResult.push(brigade);
    }
    if (noBrigadeMap.workers.size > 0) {
      brigadeResult.push(noBrigadeMap);
    }
    setBrigadeGroupedData(brigadeResult);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------- Комментарии ----------
  const loadComments = async (objectId: number) => {
    if (!objectId) return;
    const { data, error } = await supabase
      .from('object_comments')
      .select('id, comment, created_at, author_name')
      .eq('object_id', objectId)
      .order('created_at', { ascending: true });
    if (!error) {
      setObjectCommentsMap(prev => ({ ...prev, [objectId]: data || [] }));
    }
  };

  const handleAddComment = async (objectId: number) => {
    const commentText = (newCommentMap[objectId] || '').trim();
    if (!objectId || !commentText) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const role = profileData?.role || 'brigadier';
    const authorName = user?.login || (role === 'supervisor' ? 'Руководитель' : 'Бригадир');

    const { error } = await supabase.from('object_comments').insert({
      object_id: objectId,
      user_id: userId,
      comment: commentText,
      author_name: authorName,
    });

    if (error) {
      alert('Ошибка добавления комментария');
      return;
    }

    setNewCommentMap(prev => ({ ...prev, [objectId]: '' }));
    loadComments(objectId);
  };

  const handleDeleteComment = async (commentId: number, objectId: number) => {
    if (!confirm('Удалить комментарий?')) return;
    const { error } = await supabase.from('object_comments').delete().eq('id', commentId);
    if (error) {
      alert('Ошибка удаления комментария');
      return;
    }
    loadComments(objectId);
  };

  // ---------- Форма добавления ----------
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

  // ---------- Редактирование объекта ----------
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
        log_date: first.log_date,
        groupSize: groupLogs.length,
      });
    });

    const soloRows = soloLogs.map((log: any) => ({
      id: log.id,
      worker_name: log.worker.full_name,
      work_type_id: log.work_type_id,
      quantity: String(log.quantity),
      log_date: log.log_date,
    }));

    setEditBrigadeGroups(brigadeGroups);
    setEditSoloRows(soloRows);
    setNewRows([]);
    setEditingObjectId(objectId);
    document.body.style.overflow = 'hidden';
  };

  const cancelEditObject = () => {
    setEditingObjectId(null);
    setEditBrigadeGroups([]);
    setEditSoloRows([]);
    setNewRows([]);
    document.body.style.overflow = 'auto';
  };

  const updateBrigadeGroupField = (index: number, field: string, value: any) => {
    setEditBrigadeGroups(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const updateSoloRowField = (index: number, field: string, value: any) => {
    setEditSoloRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  // Новые строки
  const addNewEditRow = () => {
    setNewRows(prev => [
      ...prev,
      {
        id: Date.now(),
        targetType: 'worker',
        worker_id: 0,
        brigade_id: 0,
        work_type_id: 0,
        quantity: '',
        log_date: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const updateNewEditRow = (index: number, field: string, value: any) => {
    setNewRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeNewEditRow = (index: number) => {
    setNewRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditObjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBrigadeGroups.length && !editSoloRows.length && !newRows.length) return;

    try {
      const updates: Promise<any>[] = [];

      // Обновление бригадных групп
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
              log_date: group.log_date,
            })
          );
        });
      });

      // Обновление одиночных работ
      editSoloRows.forEach(row => {
        const wt = workTypes.find(w => w.id === row.work_type_id);
        const rate = wt ? wt.rate : 0;
        const newAmount = parseFloat(row.quantity) * rate;
        updates.push(
          updateWorkLog(row.id, {
            work_type_id: row.work_type_id,
            quantity: parseFloat(row.quantity),
            amount: newAmount,
            log_date: row.log_date,
          })
        );
      });

      // Добавление новых работ
      for (const row of newRows) {
        const wt = workTypes.find(w => w.id === row.work_type_id);
        const rate = wt ? wt.rate : 0;
        const qty = parseFloat(row.quantity);
        if (!qty || !row.work_type_id) continue;

        if (row.targetType === 'worker') {
          if (!row.worker_id) continue;
          updates.push(
            addWorkLog({
              worker_id: row.worker_id,
              work_type_id: row.work_type_id,
              quantity: qty,
              log_date: row.log_date,
              object_id: editingObjectId ?? undefined,
            } as any)
          );
        } else {
          if (!row.brigade_id) continue;
          updates.push(
            addWorkLogForBrigade(
              row.brigade_id,
              row.work_type_id,
              qty,
              row.log_date,
              editingObjectId ?? undefined
            )
          );
        }
      }

      await Promise.all(updates);

      setNewRows([]);
      cancelEditObject();
      loadData();
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  };

  // ---------- Редактирование отдельной записи из режима "По бригадам" ----------
  const startEditSingleLog = (log: any) => {
    setTargetType(log.worker_id ? 'worker' : 'brigade');
    setSelectedWorkerId(log.worker_id || 0);
    setSelectedBrigadeId(0);
    setSelectedObjectId(log.object_id || 0);
    setDate(log.log_date);

    setEditBrigadeGroups([]);
    setEditSoloRows([
      {
        id: log.id,
        worker_name: log.worker?.full_name || 'Неизвестно',
        work_type_id: log.work_type_id,
        quantity: String(log.quantity),
        log_date: log.log_date,
      },
    ]);

    setEditingObjectId(log.object_id ?? null);
    document.body.style.overflow = 'hidden';
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
              <select
                value={selectedObjectId}
                onChange={e => setSelectedObjectId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              >
                <option value={0} disabled>Выберите объект</option>
                {objects.map(o => (
                  <option key={o.id} value={o.id}>{o.name}{o.address ? ` — ${o.address}` : ''}</option>
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

            {targetType === 'worker' && (
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
            )}

            {targetType === 'brigade' && (
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
              <label className="block text-sm font-medium text-gray-700">Дата</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500">Вид работы</label>
                    <select
                      value={row.work_type_id}
                      onChange={e => updateRow(idx, 'work_type_id', Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      required
                    >
                      <option value={0} disabled>Выберите...</option>
                      {categories.map(cat => (
                        <optgroup key={cat.id} label={cat.name}>
                          {workTypes
                            .filter(wt => wt.category_id === cat.id)
                            .map(wt => (
                              <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                            ))}
                        </optgroup>
                      ))}
                      {workTypes.some(wt => wt.category_id == null) && (
                        <optgroup label="Без категории">
                          {workTypes
                            .filter(wt => wt.category_id == null)
                            .map(wt => (
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
                      min="0"
                      value={row.quantity}
                      onChange={e => updateRow(idx, 'quantity', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      required
                    />
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Удалить строку"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={addRow}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
              >
                + Добавить ещё
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Сохранить все
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Модальное окно редактирования */}
      {isManager && editingObjectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
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
                            {categories.map(cat => (
                              <optgroup key={cat.id} label={cat.name}>
                                {workTypes
                                  .filter(wt => wt.category_id === cat.id)
                                  .map(wt => (
                                    <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                                  ))}
                              </optgroup>
                            ))}
                            {workTypes.some(wt => wt.category_id == null) && (
                              <optgroup label="Без категории">
                                {workTypes
                                  .filter(wt => wt.category_id == null)
                                  .map(wt => (
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
                            min="0"
                            value={group.quantity}
                            onChange={e => updateBrigadeGroupField(idx, 'quantity', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                            required
                          />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-xs font-medium text-gray-500">Дата</label>
                          <input
                            type="date"
                            value={group.log_date}
                            onChange={e => updateBrigadeGroupField(idx, 'log_date', e.target.value)}
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
                          <div className="text-sm font-medium">
                            {row.id > 1e12 ? ( // временный id означает новую строку
                              <select
                                value={row.worker_id || ''}
                                onChange={e => updateSoloRowField(idx, 'worker_id', Number(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                              >
                                <option value="">Выберите сотрудника</option>
                                {workers.map(w => (
                                  <option key={w.id} value={w.id}>{w.full_name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="text-sm font-medium">{row.worker_name}</div>
                            )}
                          </div>
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
                            {categories.map(cat => (
                              <optgroup key={cat.id} label={cat.name}>
                                {workTypes
                                  .filter(wt => wt.category_id === cat.id)
                                  .map(wt => (
                                    <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {wt.rate} ₽</option>
                                  ))}
                              </optgroup>
                            ))}
                            {workTypes.some(wt => wt.category_id == null) && (
                              <optgroup label="Без категории">
                                {workTypes
                                  .filter(wt => wt.category_id == null)
                                  .map(wt => (
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
                            min="0"
                            value={row.quantity}
                            onChange={e => updateSoloRowField(idx, 'quantity', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                            required
                          />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-xs font-medium text-gray-500">Дата</label>
                          <input
                            type="date"
                            value={row.log_date}
                            onChange={e => updateSoloRowField(idx, 'log_date', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Новые работы</h3>
                <div className="space-y-3">
                  {newRows.map((row, idx) => (
                    <div key={row.id} className="border p-2 rounded bg-gray-50 space-y-2">
                      <div className="flex gap-2 items-center">
                        <label className="inline-flex items-center text-sm">
                          <input
                            type="radio"
                            checked={row.targetType === 'worker'}
                            onChange={() => updateNewEditRow(idx, 'targetType', 'worker')}
                          />
                          <span className="ml-1">Сотруднику</span>
                        </label>
                        <label className="inline-flex items-center text-sm">
                          <input
                            type="radio"
                            checked={row.targetType === 'brigade'}
                            onChange={() => updateNewEditRow(idx, 'targetType', 'brigade')}
                          />
                          <span className="ml-1">Бригаде</span>
                        </label>
                      </div>

                      {row.targetType === 'worker' ? (
                        <select
                          value={row.worker_id}
                          onChange={e => updateNewEditRow(idx, 'worker_id', Number(e.target.value))}
                          className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                        >
                          <option value={0} disabled>Выберите сотрудника</option>
                          {workers.map(w => (
                            <option key={w.id} value={w.id}>{w.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={row.brigade_id}
                          onChange={e => updateNewEditRow(idx, 'brigade_id', Number(e.target.value))}
                          className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                        >
                          <option value={0} disabled>Выберите бригаду</option>
                          {brigades.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={row.work_type_id}
                          onChange={e => updateNewEditRow(idx, 'work_type_id', Number(e.target.value))}
                          className="rounded-md border-gray-300 shadow-sm text-sm"
                        >
                          <option value={0} disabled>Вид работы</option>
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
                        <input
                          type="number"
                          step="any"
                          placeholder="Количество"
                          value={row.quantity}
                          onChange={e => updateNewEditRow(idx, 'quantity', e.target.value)}
                          className="rounded-md border-gray-300 shadow-sm text-sm"
                        />
                        <input
                          type="date"
                          value={row.log_date}
                          onChange={e => updateNewEditRow(idx, 'log_date', e.target.value)}
                          className="rounded-md border-gray-300 shadow-sm text-sm"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeNewEditRow(idx)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Удалить строку
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addNewEditRow}
                  className="mt-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
                >
                  + Добавить работу
                </button>
              </div>
             
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={cancelEditObject} className="px-4 py-2 bg-gray-200 rounded-md">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Переключатель вида журнала */}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold mr-4">Журнал работ</h2>
        <button
          onClick={() => setViewMode('byObject')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'byObject' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          По объектам
        </button>
        <button
          onClick={() => setViewMode('byBrigade')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'byBrigade' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          По бригадам
        </button>
      </div>

      {/* По объектам */}
      {viewMode === 'byObject' && (
        <div className="space-y-4">
          {groupedData.length === 0 && <p className="text-gray-500">Нет добавленных работ.</p>}
          {groupedData.map(obj => (
            <details key={obj.id ?? 'no-obj'} className="bg-white rounded-xl shadow">
              <summary className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                <span className="font-semibold">
                  {obj.name}
                  {obj.address && <span className="text-sm text-gray-500 ml-2">{obj.address}</span>}
                </span>
                {isManager && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      startEditObject(obj.id);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm ml-2"
                  >
                    ✎ Редактировать объект
                  </button>
                )}
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {/* Бригадные работы */}
                {obj.brigades && obj.brigades.size > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700">Бригадные работы</h3>
                    {(() => {
                      const brigadeGroups = Array.from(obj.brigades.values()) as any[];
                      const byBrigade = new Map<string, any[]>();
                      brigadeGroups.forEach(group => {
                        const name = group.brigadeName || 'Без названия';
                        if (!byBrigade.has(name)) byBrigade.set(name, []);
                        byBrigade.get(name)!.push(group);
                      });
                      return Array.from(byBrigade.entries()).map(([brigadeName, groups]) => (
                        <div key={brigadeName} className="ml-2 border-l-2 border-blue-200 pl-2">
                          <p className="text-sm font-medium">{brigadeName}</p>
                          <div className="space-y-2">
                            {groups.map(group => (
                              <div key={group.key} className="flex items-center justify-between text-sm text-gray-600">
                                <span>
                                  {group.logs.some((l: any) => l.status === 'pending') && '⏳ '}
                                  {formatDate(group.log_date)} — {group.work_type?.name || '?'}: {group.quantity} {group.work_type?.unit || ''} × {formatMoney(group.rate || 0)} = <span className="font-medium">{formatMoney(group.totalAmount)}</span>
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
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
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

                {/* Комментарии */}
                {obj.id !== null && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Комментарии</h4>
                    {(() => {
                      const comments = objectCommentsMap[obj.id] || [];
                      const commentInput = newCommentMap[obj.id] || '';
                      return (
                        <>
                          {comments.length === 0 ? (
                            <p className="text-sm text-gray-500">Нет комментариев</p>
                          ) : (
                            <ul className="space-y-2">
                              {comments.map(c => (
                                <li key={c.id} className="text-sm text-gray-600">
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium">{c.author_name || 'Сотрудник'}</span>
                                    <span className="text-gray-400 text-xs">{new Date(c.created_at).toLocaleString('ru-RU')}</span>
                                  </div>
                                  <p>{c.comment}</p>
                                  {(user?.role === 'supervisor' || c.user_id === user?.id) && (
                                    <button
                                      onClick={() => handleDeleteComment(c.id, obj.id)}
                                      className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                      Удалить
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          {isManager && (
                            <div className="mt-3 flex gap-2">
                              <input
                                type="text"
                                value={commentInput}
                                onChange={e => setNewCommentMap(prev => ({ ...prev, [obj.id]: e.target.value }))}
                                placeholder="Добавить комментарий..."
                                className="flex-1 rounded-md border-gray-300 shadow-sm text-sm"
                              />
                              <button
                                onClick={() => handleAddComment(obj.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                              >
                                Отправить
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* По бригадам */}
      {viewMode === 'byBrigade' && (
        <div className="space-y-4">
          {brigadeGroupedData.length === 0 && <p className="text-gray-500">Нет добавленных работ.</p>}
          {brigadeGroupedData.map(brigade => (
            <details key={brigade.brigadeId ?? 'no-brigade'} className="bg-white rounded-xl shadow">
              <summary className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                <span className="font-semibold">
                  {brigade.brigadeId === null ? 'Без бригады' : brigade.brigadeName}
                </span>
                <span className="text-sm text-gray-500">
                  {Array.from(brigade.workers.values()).reduce((sum: number, worker: any) => sum + worker.logs.length, 0)} записей
                </span>
              </summary>
              <div className="px-4 pb-4 space-y-4">
                {Array.from(brigade.workers.values()).map((workerEntry: any) => (
                  <details key={workerEntry.worker.id} className="ml-2 text-sm text-gray-600">
                    <summary className="cursor-pointer font-medium py-1">
                      {workerEntry.worker.full_name}
                      <span className="text-gray-400 ml-2 text-xs">
                        ({workerEntry.logs.length} записей)
                      </span>
                    </summary>
                    <ul className="space-y-1 mt-2 pl-4">
                      {workerEntry.logs.map((log: any) => {
                        const workTypeName = log.work_type?.name || '?';
                        const unit = log.work_type?.unit || '';
                        const rate = log.work_type?.rate || 0;
                        const objectName = log.object?.name || 'Без объекта';
                        const objectAddress = log.object?.address || '';
                        const isPending = log.status === 'pending';
                        return (
                          <li
                            key={`brigade-log-${log.id}`}
                            className={`flex items-center justify-between ${
                              isPending ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-2' : ''
                            }`}
                          >
                            <span>
                              {isPending && '⏳ '}
                              {formatDate(log.log_date)} — {objectName}
                              {objectAddress ? ` (${objectAddress})` : ''} — {workTypeName}: {log.quantity} {unit} × {formatMoney(rate)} ={' '}
                              <span className="font-medium">{formatMoney(log.amount)}</span>
                            </span>
                            <span className="flex gap-1 ml-2">
                              {isManager && (
                                <button
                                  onClick={() => startEditSingleLog(log)}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Редактировать"
                                >
                                  ✎
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="text-red-600 hover:text-red-800 text-xs"
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </span>
                          </li>
                        );
                      })}
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