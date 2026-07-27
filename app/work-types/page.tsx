// app/work-types/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  getWorkTypes,
  addWorkType,
  updateWorkType,
  deleteWorkType,
  WorkType,
} from '@/lib/data';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function WorkTypesPage() {
  return (
    <ProtectedRoute>
      <WorkTypesContent />
    </ProtectedRoute>
  );
}

function WorkTypesContent() {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', unit: '', rate: '' });
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => {
    setWorkTypes(await getWorkTypes());
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ name: '', unit: '', rate: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.unit.trim() || !form.rate) return;
    const rateNum = parseFloat(form.rate);
    if (isNaN(rateNum) || rateNum < 0) return;

    try {
      if (editingId !== null) {
        await updateWorkType({
          id: editingId,
          name: form.name.trim(),
          unit: form.unit.trim(),
          rate: rateNum,
        });
      } else {
        await addWorkType({
          name: form.name.trim(),
          unit: form.unit.trim(),
          rate: rateNum,
        });
      }
      resetForm();
      load();
    } catch (error: any) {
      alert('Ошибка при сохранении: ' + (error.message || 'Неизвестная ошибка'));
      console.error(error);
    }
  };

  const startEdit = (wt: WorkType) => {
    setEditingId(wt.id);
    setForm({
      name: wt.name,
      unit: wt.unit,
      rate: wt.rate.toString(),
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Удалить вид работы? Это может повлиять на старые записи.')) {
      await deleteWorkType(id);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Виды работ и расценки</h1>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setForm({ name: '', unit: '', rate: '' });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm md:text-base self-start"
        >
          + Добавить
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Название работы"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            />
            <input
              type="text"
              placeholder="Ед. изм. (м, шт, ...)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            />
            <input
              type="number"
              placeholder="Ставка, ₽"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm"
            />
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
                  Название работы
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                  Ед.
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">
                  Ставка
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workTypes.map((wt) => (
                <tr key={wt.id}>
                  <td className="px-3 py-2">{wt.name}</td>
                  <td className="px-3 py-2 text-gray-600">{wt.unit}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {wt.rate} ₽
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(wt)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Ред.
                    </button>
                    <button
                      onClick={() => handleDelete(wt.id)}
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