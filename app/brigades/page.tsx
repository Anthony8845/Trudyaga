// app/brigades/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  getBrigades,
  addBrigade,
  updateBrigade,
  deleteBrigade,
  getWorkers,
  updateWorker,
  Brigade,
  Worker,
} from '@/lib/data';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/AuthContext';

export default function BrigadesPage() {
  return (
    <ProtectedRoute>
      <BrigadesContent />
    </ProtectedRoute>
  );
}

function BrigadesContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [editingBrigade, setEditingBrigade] = useState<Brigade | null>(null);
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBrigadeName, setNewBrigadeName] = useState('');

  const loadData = async () => {
    const [b, w] = await Promise.all([getBrigades(), getWorkers()]);
    setBrigades(b);
    setWorkers(w);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveNewBrigade = async () => {
    if (!newBrigadeName.trim()) return;
    await addBrigade(newBrigadeName.trim());
    setNewBrigadeName('');
    setShowAddForm(false);
    loadData();
  };

  const handleUpdateBrigade = async () => {
    if (!editingBrigade || !newName.trim()) return;
    await updateBrigade({ ...editingBrigade, name: newName.trim() });
    setEditingBrigade(null);
    loadData();
  };

  const handleDeleteBrigade = async (id: number) => {
    if (confirm('Удалить бригаду? Все сотрудники станут без бригады.')) {
      await deleteBrigade(id);
      loadData();
    }
  };

const handleChangeWorkerBrigade = async (worker: Worker, newBrigadeId: string) => {
  const brigade_id = newBrigadeId === '' ? undefined : Number(newBrigadeId);
  await updateWorker({ ...worker, brigade_id });
  loadData();
};

  const getBrigadeWorkers = (brigadeId: number) =>
    workers.filter(w => w.brigade_id === brigadeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Бригады и состав</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAddForm(true);
              setNewBrigadeName('');
            }}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm md:text-base self-start"
          >
            + Новая бригада
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название бригады
            </label>
            <input
              type="text"
              value={newBrigadeName}
              onChange={e => setNewBrigadeName(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Бригада №..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveNewBrigade}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm"
            >
              Сохранить
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-gray-200 rounded-md text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {brigades.map(brigade => {
          const brigadeWorkers = getBrigadeWorkers(brigade.id);
          return (
            <div
              key={brigade.id}
              className="bg-white rounded-xl shadow p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{brigade.name}</h2>
                {isAdmin && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingBrigade(brigade);
                        setNewName(brigade.name);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Редактировать название"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteBrigade(brigade.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                      title="Удалить бригаду"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {editingBrigade?.id === brigade.id && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="sr-only">Новое название</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm text-sm"
                    />
                  </div>
                  <button
                    onClick={handleUpdateBrigade}
                    className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setEditingBrigade(null)}
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Сотрудники ({brigadeWorkers.length})
                </h3>
                {brigadeWorkers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Нет сотрудников</p>
                ) : (
                  <ul className="space-y-2">
                    {brigadeWorkers.map(worker => (
                      <li
                        key={worker.id}
                        className="flex items-center justify-between text-sm bg-gray-50 rounded p-2"
                      >
                        <div>
                          <span className="font-medium">{worker.full_name}</span>
                          <span className="text-gray-500 ml-2">{worker.position}</span>
                        </div>
                        {isAdmin && (
                          <select
                            value={worker.brigade_id ?? ''}
                            onChange={e =>
                              handleChangeWorkerBrigade(worker, e.target.value)
                            }
                            className="text-xs rounded border-gray-300 ml-2"
                          >
                            <option value="">Без бригады</option>
                            {brigades.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}