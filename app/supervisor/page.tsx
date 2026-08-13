'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/lib/utils';
import { getBrigades } from '@/lib/data';

export default function SupervisorPage() {
  const { user } = useAuth();
  const [brigades, setBrigades] = useState<any[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]);

  const loadData = async () => {
    // Получаем справочник бригад
    const b = await getBrigades();
    setBrigades(b);

    // Получаем все неподтверждённые записи
    const { data: logs, error } = await supabase
      .from('work_logs')
      .select(`
        id, worker_id, work_type_id, quantity, log_date, object_id, amount, status, is_brigade,
        worker:workers!inner(id, full_name, brigade_id),
        work_type:work_types(id, name, unit, rate),
        object:objects(id, name)
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
      brigades: new Map<string, any>(),
      soloWorkers: new Map<number, { worker: any; logs: any[] }>(),
    };

    for (const log of logs as any[]) {
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
        // Группируем бригадные записи по бригаде, затем по дате и виду работы
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
        // Персональные записи
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
  };

  const handleReject = async (ids: number[]) => {
    if (confirm('Отклонить и удалить выбранные записи?')) {
      await Promise.all(ids.map(id => supabase.from('work_logs').delete().eq('id', id)));
      loadData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Подтверждение работ</h1>
      {groupedData.length === 0 && <p className="text-gray-500">Нет неподтверждённых записей</p>}

      {groupedData.map(obj => (
        <details key={obj.id ?? 'no-obj'} className="bg-white rounded-xl shadow mb-4" open>
          <summary className="p-4 cursor-pointer hover:bg-gray-50 font-semibold flex justify-between items-center">
            <span>{obj.name}</span>
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
                      <div key={group.key} className="flex items-center justify-between py-1 text-sm">
                        <span>
                          {formatDate(group.log_date)} — {group.work_type?.name}: {group.quantity} {group.work_type?.unit} × {formatMoney(group.work_type?.rate)} = <strong>{formatMoney(group.totalAmount)}</strong>
                        </span>
                        <span className="flex gap-2">
                          <button
                            onClick={() => handleApprove(group.ids)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            ✓ Подтвердить
                          </button>
                          <button
                            onClick={() => handleReject(group.ids)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            ✗ Отклонить
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Работы сотрудников */}
            {obj.soloWorkers.size > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Работы сотрудников</h3>
                {Array.from(obj.soloWorkers.values()).map((workerEntry: any) => (
                  <div key={workerEntry.worker.id} className="ml-2 mb-3">
                    <p className="text-sm font-medium">{workerEntry.worker.full_name}</p>
                    {workerEntry.logs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between py-1 text-sm">
                        <span>
                          {formatDate(log.log_date)} — {log.work_type?.name}: {log.quantity} {log.work_type?.unit} × {formatMoney(log.work_type?.rate)} = <strong>{formatMoney(log.amount)}</strong>
                        </span>
                        <span className="flex gap-2">
                          <button
                            onClick={() => handleApprove([log.id])}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            ✓ Подтвердить
                          </button>
                          <button
                            onClick={() => handleReject([log.id])}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            ✗ Отклонить
                          </button>
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
    </div>
  );
}