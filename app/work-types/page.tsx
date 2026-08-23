'use client';

import { useEffect, useState } from 'react';
import {
  getWorkTypes,
  addWorkType,
  updateWorkType,
  deleteWorkType,
  getWorkCategories,
  addWorkCategory,
  updateWorkCategory,
  deleteWorkCategory,
  WorkType,
  WorkCategory,
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
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);

  // Категории: добавление / редактирование
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryFormMode, setCategoryFormMode] = useState<'add' | 'edit'>('add');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Виды работ: добавление / редактирование (модальное окно)
  const [showWorkTypeForm, setShowWorkTypeForm] = useState(false);
  const [workTypeFormMode, setWorkTypeFormMode] = useState<'add' | 'edit'>('add');
  const [editingWorkTypeId, setEditingWorkTypeId] = useState<number | null>(null);
  const [workTypeForm, setWorkTypeForm] = useState({
    name: '',
    unit: '',
    rate: '',
    category_id: '',
  });

  // Drag and drop
  const [draggedWorkTypeId, setDraggedWorkTypeId] = useState<number | null>(null);

  const loadData = async () => {
    const [cats, wts] = await Promise.all([getWorkCategories(), getWorkTypes()]);
    setCategories(cats);
    setWorkTypes(wts);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------- Категории ----------
  const openAddCategory = () => {
    setCategoryFormMode('add');
    setEditingCategoryId(null);
    setCategoryName('');
    setShowCategoryForm(true);
  };

  const openEditCategory = (cat: WorkCategory) => {
    setCategoryFormMode('edit');
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setShowCategoryForm(true);
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) return;
    if (categoryFormMode === 'add') {
      await addWorkCategory(categoryName.trim());
    } else if (editingCategoryId !== null) {
      await updateWorkCategory({ id: editingCategoryId, name: categoryName.trim() });
    }
    setShowCategoryForm(false);
    setCategoryName('');
    setEditingCategoryId(null);
    loadData();
  };

  const cancelCategory = () => {
    setShowCategoryForm(false);
    setCategoryName('');
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Удалить категорию? Виды работ перейдут в «Без категории».')) {
      await deleteWorkCategory(id);
      loadData();
    }
  };

  // ---------- Виды работ ----------
  const openAddWorkType = (categoryId: number | null = null) => {
    setWorkTypeFormMode('add');
    setEditingWorkTypeId(null);
    setWorkTypeForm({
      name: '',
      unit: '',
      rate: '',
      category_id: categoryId ? String(categoryId) : '',
    });
    setShowWorkTypeForm(true);
  };

  const openEditWorkType = (wt: WorkType) => {
    setWorkTypeFormMode('edit');
    setEditingWorkTypeId(wt.id);
    setWorkTypeForm({
      name: wt.name,
      unit: wt.unit,
      rate: wt.rate.toString(),
      category_id: wt.category_id ? String(wt.category_id) : '',
    });
    setShowWorkTypeForm(true);
  };

  const saveWorkType = async () => {
    if (!workTypeForm.name.trim() || !workTypeForm.unit.trim() || !workTypeForm.rate) return;
    const rateNum = parseFloat(workTypeForm.rate);
    if (isNaN(rateNum) || rateNum < 0) return;

    const payload = {
      name: workTypeForm.name.trim(),
      unit: workTypeForm.unit.trim(),
      rate: rateNum,
      category_id: workTypeForm.category_id ? Number(workTypeForm.category_id) : null,
    };

    if (workTypeFormMode === 'add') {
      await addWorkType(payload);
    } else if (editingWorkTypeId !== null) {
      await updateWorkType({ id: editingWorkTypeId, ...payload });
    }
    setShowWorkTypeForm(false);
    setWorkTypeForm({ name: '', unit: '', rate: '', category_id: '' });
    setEditingWorkTypeId(null);
    loadData();
  };

  const cancelWorkType = () => {
    setShowWorkTypeForm(false);
    setWorkTypeForm({ name: '', unit: '', rate: '', category_id: '' });
    setEditingWorkTypeId(null);
  };

  const handleDeleteWorkType = async (id: number) => {
    if (confirm('Удалить вид работы?')) {
      await deleteWorkType(id);
      loadData();
    }
  };

  // ---------- Drag & Drop ----------
  const handleDragStart = (e: React.DragEvent, workTypeId: number) => {
    e.dataTransfer.setData('text/plain', workTypeId.toString());
    setDraggedWorkTypeId(workTypeId);
  };

  const handleDrop = async (e: React.DragEvent, categoryId: number | null) => {
    e.preventDefault();
    const wtId = Number(e.dataTransfer.getData('text/plain'));
    if (!wtId) return;
    const wt = workTypes.find(w => w.id === wtId);
    if (!wt) return;

    await updateWorkType({ ...wt, category_id: categoryId });
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Расценки и категории</h1>
        <button
          onClick={openAddCategory}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm md:text-base"
        >
          + Добавить категорию
        </button>
      </div>

      {/* Форма добавления/редактирования категории (инлайн) */}
      {showCategoryForm && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <input
            type="text"
            placeholder="Название категории"
            value={categoryName}
            onChange={e => setCategoryName(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
          <div className="flex gap-2">
            <button onClick={saveCategory} className="px-4 py-2 bg-green-600 text-white rounded-md">
              {categoryFormMode === 'add' ? 'Добавить' : 'Сохранить'}
            </button>
            <button onClick={cancelCategory} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
          </div>
        </div>
      )}

      {/* Сетка категорий */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => {
          const catWorkTypes = workTypes.filter(wt => wt.category_id === cat.id);
          return (
            <div
              key={cat.id}
              className="bg-white rounded-xl shadow p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, cat.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{cat.name}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditCategory(cat)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    title="Редактировать категорию"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                    title="Удалить категорию"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <ul className="space-y-2 mb-3">
                {catWorkTypes.length === 0 && (
                  <li className="text-sm text-gray-400 italic">Нет видов работ</li>
                )}
                {catWorkTypes.map(wt => (
                  <li
                    key={wt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, wt.id)}
                    onClick={() => openEditWorkType(wt)}
                    className="p-2 bg-gray-50 rounded flex justify-between items-center cursor-grab hover:bg-gray-100"
                    title="Нажмите для редактирования"
                  >
                    <span className="text-sm">{wt.name} ({wt.unit})</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wt.rate} ₽</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // чтобы не открывалось редактирование
                          handleDeleteWorkType(wt.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Удалить вид работы"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openAddWorkType(cat.id)}
                className="w-full px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
              >
                + Вид работы
              </button>
            </div>
          );
        })}

        {/* Категория "Без категории" */}
        <div
          className="bg-white rounded-xl shadow p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-500">Без категории</h3>
          </div>

          <ul className="space-y-2 mb-3">
            {workTypes.filter(wt => wt.category_id == null).length === 0 && (
              <li className="text-sm text-gray-400 italic">Нет видов работ</li>
            )}
            {workTypes
              .filter(wt => wt.category_id == null)
              .map(wt => (
                <li
                  key={wt.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, wt.id)}
                  onClick={() => openEditWorkType(wt)}
                  className="p-2 bg-gray-50 rounded flex justify-between items-center cursor-grab hover:bg-gray-100"
                  title="Нажмите для редактирования"
                >
                  <span className="text-sm">{wt.name} ({wt.unit})</span>
                  <span className="text-sm font-medium">{wt.rate} ₽</span>
                </li>
              ))}
          </ul>

          <button
            onClick={() => openAddWorkType(null)}
            className="w-full px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
          >
            + Вид работы
          </button>
        </div>
      </div>

      {/* Модальное окно для добавления/редактирования вида работы */}
      {showWorkTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              {workTypeFormMode === 'add' ? 'Добавить вид работы' : 'Редактировать вид работы'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Название</label>
                <input
                  type="text"
                  value={workTypeForm.name}
                  onChange={e => setWorkTypeForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ед. измерения</label>
                <input
                  type="text"
                  value={workTypeForm.unit}
                  onChange={e => setWorkTypeForm(prev => ({ ...prev, unit: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ставка, ₽</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={workTypeForm.rate}
                  onChange={e => setWorkTypeForm(prev => ({ ...prev, rate: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Категория</label>
                <select
                  value={workTypeForm.category_id}
                  onChange={e => setWorkTypeForm(prev => ({ ...prev, category_id: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="">Без категории</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={cancelWorkType} className="px-4 py-2 bg-gray-200 rounded-md">Отмена</button>
              <button onClick={saveWorkType} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                {workTypeFormMode === 'add' ? 'Добавить' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}