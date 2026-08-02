'use client';

import { useEffect, useState } from 'react';
import { getObjects, addObject, updateObject, deleteObject, ObjectItem } from '@/lib/data';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ObjectsPage() {
  return (
    <ProtectedRoute>
      <ObjectsContent />
    </ProtectedRoute>
  );
}

function ObjectsContent() {
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [isAdding, setIsAdding] = useState(false);

  const load = async () => setObjects(await getObjects());

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', address: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const objData = { name: form.name.trim(), address: form.address.trim() };
    if (editingId !== null) {
      await updateObject({ id: editingId, ...objData });
    } else {
      await addObject(objData);
    }
    resetForm();
    load();
  };

  const startEdit = (obj: ObjectItem) => {
    setEditingId(obj.id);
    setForm({ name: obj.name, address: obj.address || '' });
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Удалить объект?')) {
      await deleteObject(id);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Объекты</h1>
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); setForm({ name: '', address: '' }); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm md:text-base"
        >
          + Добавить объект
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <input
            type="text"
            placeholder="Название объекта"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
          <input
            type="text"
            placeholder="Адрес (необязательно)"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            className="block w-full rounded-md border-gray-300 shadow-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md">
              {editingId !== null ? 'Сохранить' : 'Добавить'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Название</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase hidden md:table-cell">Адрес</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {objects.map(obj => (
              <tr key={obj.id}>
                <td className="px-3 py-2 font-medium">{obj.name}</td>
                <td className="px-3 py-2 text-gray-600 hidden md:table-cell">{obj.address || '—'}</td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => startEdit(obj)} className="text-blue-600 hover:text-blue-800 text-sm">Ред.</button>
                  <button onClick={() => handleDelete(obj.id)} className="text-red-600 hover:text-red-800 text-sm">Уд.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}