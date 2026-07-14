// app/workers/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  getWorkers,
  addWorker,
  deleteWorker,
  updateWorker,
  getBrigades,
  Worker,
  Brigade,
} from '@/lib/data';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function WorkersPage() {
  return (
    <ProtectedRoute>
      <WorkersContent />
    </ProtectedRoute>
  );
}

function WorkersContent() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: '', position: '', brigade_id: '' });
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    const [w, b] = await Promise.all([getWorkers(), getBrigades()]);
    setWorkers(w);
    setBrigades(b);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ full_name: '', position: '', brigade_id: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) return;
    const workerData = {
      full_name: form.full_name,
      position: form.position,
      brigade_id: form.brigade_id ? Number(form.brigade_id) : undefined,
    };
    try {
      if (editingId !== null) {
        await updateWorker({ id: editingId, ...workerData });
      } else {
        await addWorker(workerData);
      }
      resetForm();
      load();
    } catch (error: any) {
      alert('Ошибка при сохранении сотрудника: ' + (error.message || 'Неизвестная ошибка'));
      console.error(error);
    }
  };

  const startEdit = (w: Worker) => {
    setEditingId(w.id);
    setForm({
      full_name: w.full_name,
      position: w.position,
      brigade_id: w.brigade_id ? String(w.brigade_id) : '',
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Удалить сотрудника?')) {
      await deleteWorker(id);
      load();
    }
  };

  const getBrigadeName = (id?: number) => {
    if (!id) return '—';
    const b = brigades.find(b => b.id === id);
    return b ? b.name : '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Сотрудники</h1>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setForm({ full_name: '', position: '', brigade_id: '' });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm md:text-base"
        >
          Добавить
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <input
            type="text"
            placeholder="ФИО"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="block w-full rounded-md border-gray-300 shadow-sm"
          />
          <input
            type="text"
            placeholder="Должность"
            value={form.position}
            onChange={e => setForm({ ...form, position: e.target.value })}
            className="block w-full rounded-md border-gray-300 shadow-sm"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Бригада
            </label>
            <select
              value={form.brigade_id}
              onChange={e => setForm({ ...form, brigade_id: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Без бригады</option>
              {brigades.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md"
            >
              {editingId !== null ? 'Сохранить' : 'Добавить'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-md">
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                  ФИО
                </th>
                <th className="hidden md:table-cell px-3 py-2 text-left font-medium text-gray-500 uppercase">
                  Должность
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                  Бригада
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workers.map(w => (
                <tr key={w.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{w.full_name}</div>
                    <div className="text-xs text-gray-500 md:hidden">
                      {w.position}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-gray-600">
                    {w.position}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-sm">
                    {getBrigadeName(w.brigade_id)}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(w)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Ред.
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Уд.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}