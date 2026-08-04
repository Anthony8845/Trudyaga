'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getPendingWorkLogs, approveWorkLog, deleteWorkLog, getWorkers, getWorkTypes, Worker, WorkType } from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';


export default function SupervisorPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);

  const load = async () => {
    const [p, w, wt] = await Promise.all([getPendingWorkLogs(), getWorkers(), getWorkTypes()]);
    setPending(p);
    setWorkers(w);
    setWorkTypes(wt);
  };

  useEffect(() => { load(); }, []);

  if (user?.role !== 'supervisor') return <div className="p-4 text-red-500">Доступ запрещён</div>;

  const getWorkerName = (id: number) => workers.find(w => w.id === id)?.full_name;
  const getWorkType = (id: number) => workTypes.find(wt => wt.id === id);

  const handleApprove = async (id: number) => {
    await approveWorkLog(id);
    load();
  };

  const handleReject = async (id: number) => {
    if (!confirm('Удалить запись?')) return;
    await deleteWorkLog(id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Подтверждение записей</h1>
      {pending.length === 0 && <p className="text-gray-500">Нет неподтверждённых записей</p>}
      <div className="space-y-2">
        {pending.map(log => {
          const wt = getWorkType(log.work_type_id);
          return (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div className="text-sm text-gray-500">{formatDate(log.log_date)}</div>
                <div className="font-medium">{getWorkerName(log.worker_id)} – {wt?.name || '—'}</div>
                <div>{log.quantity} {wt?.unit || ''} × {wt?.rate} ₽ = <strong>{formatMoney(log.amount)}</strong></div>
              </div>
              <div className="flex gap-2 self-end sm:self-center">
                <button onClick={() => handleApprove(log.id)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">✓ Подтвердить</button>
                <button onClick={() => handleReject(log.id)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">✗ Отклонить</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}