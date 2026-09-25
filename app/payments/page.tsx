'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getWorkers,
  getSalaryPayments,
  getSalaryPaymentsByPeriod,
  addSalaryPayment,
  updateSalaryPayment,
  deleteSalaryPayment,
  getSalaryReport,
  Worker,
  SalaryPayment,
} from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/utils';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <PaymentsContent />
    </ProtectedRoute>
  );
}

function PaymentsContent() {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor';

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [viewMode, setViewMode] = useState<'byPaymentDate' | 'byPeriod'>('byPeriod');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 2)
      .toISOString()
      .split('T')[0];
    setSelectedPeriod(firstDay);
  }, []);

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerPayments, setWorkerPayments] = useState<SalaryPayment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    worker_id: '',
    amount: '',
    payment_date: '',
    type: 'advance',
    comment: '',
    period: '',
  });

  const [salarySummary, setSalarySummary] = useState<Record<number, number>>({});

  const loadData = async () => {
    const start = selectedPeriod; // "YYYY-MM-01"
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]; // последний день выбранного месяца

    const [w, p, report] = await Promise.all([
      getWorkers(),
      viewMode === 'byPeriod'
        ? getSalaryPaymentsByPeriod(selectedPeriod)
        : getSalaryPayments(start, end),
      getSalaryReport(start, end),
    ]);
    setWorkers(w);
    setPayments(p);

    const summary: Record<number, number> = {};
    report.forEach((brigade: any) => {
      brigade.workers.forEach((workerEntry: any) => {
        summary[workerEntry.worker.id] = workerEntry.total_amount;
      });
    });
    setSalarySummary(summary);
  };

  useEffect(() => {
    if (selectedPeriod) loadData();
  }, [selectedPeriod, viewMode]);

    const openWorkerPayments = async (worker: Worker) => {
      setSelectedWorker(worker);
      const filtered = payments.filter(p => p.worker_id === worker.id);
      setWorkerPayments(filtered);
    };

  const handleAddPayment = () => {
    if (!selectedWorker) return;
    setEditingPayment(null);
    setPaymentForm({
      worker_id: String(selectedWorker.id),
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      type: 'advance',
      comment: '',
      period: selectedPeriod,
    });
    setShowPaymentForm(true);
  };

  const handleEditPayment = (payment: SalaryPayment) => {
    setEditingPayment(payment);
    setPaymentForm({
      worker_id: String(payment.worker_id),
      amount: String(payment.amount),
      payment_date: payment.payment_date,
      type: payment.type,
      comment: payment.comment || '',
      period: payment.period || selectedPeriod,
    });
    setShowPaymentForm(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || !paymentForm.payment_date || !paymentForm.period) return;

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    const payload = {
      worker_id: Number(paymentForm.worker_id),
      amount,
      payment_date: paymentForm.payment_date,
      type: paymentForm.type as SalaryPayment['type'],
      comment: paymentForm.comment.trim() || undefined,
      period: paymentForm.period, // "YYYY-MM-01"
    };

    if (editingPayment) {
      await updateSalaryPayment(editingPayment.id, payload);
    } else {
      await addSalaryPayment(payload);
    }

    setShowPaymentForm(false);
    loadData();
    if (selectedWorker) openWorkerPayments(selectedWorker);
  };

  const handleDeletePayment = async (id: number) => {
    if (confirm('Удалить выплату?')) {
      await deleteSalaryPayment(id);
      loadData();
      if (selectedWorker) openWorkerPayments(selectedWorker);
    }
  };

  const getWorkerPaymentTotal = (workerId: number) => {
    return payments
      .filter(p => p.worker_id === workerId)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getWorkerBalance = (workerId: number) => {
    const accrued = salarySummary[workerId] || 0;
    const paid = getWorkerPaymentTotal(workerId);
    return accrued - paid;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Выплаты</h1>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedPeriod.substring(0, 7)}
            onChange={e => setSelectedPeriod(e.target.value + '-02')}
            className="rounded-md border-gray-300 text-sm"
          />
          <button
            onClick={() => setViewMode(prev => prev === 'byPeriod' ? 'byPaymentDate' : 'byPeriod')}
            className="px-3 py-1 rounded-md text-sm font-medium bg-gray-200 text-gray-700"
          >
            {viewMode === 'byPeriod' ? 'По периоду начисления' : 'По дате платежа'}
          </button>
        </div>
      </div>

      {/* Список сотрудников */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map(worker => {
          const accrued = salarySummary[worker.id] || 0;
          const paid = getWorkerPaymentTotal(worker.id);
          const balance = accrued - paid;
          const isOverpaid = balance < 0;

          return (
            <div
              key={worker.id}
              onClick={() => openWorkerPayments(worker)}
              className={`bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${
                isOverpaid ? 'border-2 border-red-300' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{worker.full_name}</h3>
                {isOverpaid && <span className="text-xs text-red-600 font-medium">Переплата</span>}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Начислено: <span className="font-medium">{formatMoney(accrued)}</span></div>
                <div>Выплачено: <span className="font-medium">{formatMoney(paid)}</span></div>
                <div className={`font-medium ${isOverpaid ? 'text-red-600' : 'text-green-600'}`}>
                  Остаток: {formatMoney(balance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Модальное окно с выплатами сотрудника */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{selectedWorker.full_name} — выплаты</h2>
              <button onClick={() => setSelectedWorker(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {workerPayments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Нет выплат</p>
              ) : (
                workerPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{formatDate(p.payment_date)}</div>
                      <div className="text-xs text-gray-500">
                        {p.type}{p.comment ? ` — ${p.comment}` : ''}
                        {p.period ? ` (за ${formatDate(p.period)})` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(p.amount)}</span>
                      {isSupervisor && (
                        <>
                          <button
                            onClick={() => handleEditPayment(p)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Ред.
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Уд.
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {isSupervisor && (
              <div className="p-4 border-t">
                <button
                  onClick={handleAddPayment}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Добавить выплату
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно добавления/редактирования выплаты */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingPayment ? 'Редактировать выплату' : 'Новая выплата'}
            </h2>
            <form onSubmit={handleSavePayment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Сумма, ₽</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Дата платежа</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Период начисления</label>
                <input
                  type="month"
                  value={paymentForm.period ? paymentForm.period.substring(0, 7) : selectedPeriod.substring(0, 7)}
                  onChange={e => setPaymentForm({ ...paymentForm, period: e.target.value + '-01' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Тип</label>
                <select
                  value={paymentForm.type}
                  onChange={e => setPaymentForm({ ...paymentForm, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="advance">Аванс</option>
                  <option value="salary">Зарплата</option>
                  <option value="bonus">Премия</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Комментарий</label>
                <input
                  type="text"
                  value={paymentForm.comment}
                  onChange={e => setPaymentForm({ ...paymentForm, comment: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPaymentForm(false)} className="px-4 py-2 bg-gray-200 rounded-md">
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
    </div>
  );
}