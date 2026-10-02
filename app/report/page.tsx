'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSalaryReport, getSalaryPaymentsByPeriod } from '@/lib/data';
import { formatMoney, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';

const typeLabel = (type: string) => {
  switch (type) {
    case 'advance': return 'Аванс';
    case 'salary': return 'Зарплата';
    case 'bonus': return 'Премия';
    default: return 'Другое';
  }
};

export default function ReportPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';
  const brigadeId = user?.brigadeId;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<any[] | null>(null);
  const [paymentsMap, setPaymentsMap] = useState<Record<number, number>>({});

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today.substring(0, 7) + '-01');
    setEndDate(today);
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;

    const period = startDate.substring(0, 7) + '-01';
    const [data, payments] = await Promise.all([
      getSalaryReport(startDate, endDate),
      getSalaryPaymentsByPeriod(period),
    ]);

    const map: Record<number, number> = {};
    payments.forEach((p: any) => {
      map[p.worker_id] = (map[p.worker_id] || 0) + p.amount;
    });
    setPaymentsMap(map);

    if (!isManager && brigadeId) {
      const filtered = data.filter((item: any) => item.brigade.id === brigadeId);
      setReport(filtered);
    } else {
      setReport(data);
    }
  };

  const generatePayslip = async (workerId: number, workerName: string) => {
    if (!startDate || !endDate) {
      alert('Выберите период');
      return;
    }

    // Получаем сотрудника
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('full_name, position')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      alert('Сотрудник не найден');
      return;
    }

    // Получаем подтверждённые работы за период
    const { data: logs, error: logsError } = await supabase
      .from('work_logs')
      .select(`
        id, log_date, quantity, amount,
        work_type:work_types(name, unit, rate),
        object:objects(id, name, address)
      `)
      .eq('worker_id', workerId)
      .eq('status', 'approved')
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: true });

    if (logsError || !logs) {
      alert('Ошибка получения данных');
      return;
    }

    // Получаем выплаты за период начисления
    const period = startDate.substring(0, 7) + '-01';
    const { data: payments } = await supabase
      .from('salary_payments')
      .select('id, amount, payment_date, type, comment')
      .eq('worker_id', workerId)
      .eq('period', period)
      .order('payment_date', { ascending: true });

    // Группируем работы по объектам (с учётом адреса)
    const objectGroups = new Map<number, { name: string; address?: string; logs: any[] }>();
    logs.forEach((log: any) => {
      const obj = log.object;
      const key = obj?.id ?? 0;
      if (!objectGroups.has(key)) {
        objectGroups.set(key, {
          name: obj?.name || 'Без объекта',
          address: obj?.address || '',
          logs: [],
        });
      }
      objectGroups.get(key)!.logs.push(log);
    });

    const tableRows: TableRow[] = [];
    let totalAmount = 0;

    // Заголовки таблицы работ
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Объект', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Вид работы', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ед.', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true })], alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Расценка', bold: true })], alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true })], alignment: AlignmentType.RIGHT })] }),
        ],
      })
    );

    for (const [, objGroup] of objectGroups) {
      const displayName = objGroup.address ? `${objGroup.name} (${objGroup.address})` : objGroup.name;

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: displayName, bold: true })] })],
              columnSpan: 6,
            }),
          ],
        })
      );

      objGroup.logs.forEach((log: any) => {
        totalAmount += log.amount;
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph('')] }),
              new TableCell({ children: [new Paragraph(log.work_type?.name || '')] }),
              new TableCell({ children: [new Paragraph(log.work_type?.unit || '')] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun(String(log.quantity))], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun(formatMoney(log.work_type?.rate))], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun(formatMoney(log.amount))], alignment: AlignmentType.RIGHT })] }),
            ],
          })
        );
      });
    }

    // Итог по начислениям
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Итого начислено', bold: true })] })],
            columnSpan: 5,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totalAmount), bold: true })], alignment: AlignmentType.RIGHT })],
          }),
        ],
      })
    );

    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const balance = totalAmount - totalPaid;

    if (totalPaid > 0) {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Выплачено', bold: true })] })],
              columnSpan: 5,
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totalPaid), bold: true })], alignment: AlignmentType.RIGHT })],
            }),
          ],
        })
      );

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Остаток к выплате', bold: true })] })],
              columnSpan: 5,
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: formatMoney(balance), bold: true })], alignment: AlignmentType.RIGHT })],
            }),
          ],
        })
      );
    }

    // Формируем документ
    const docChildren: any[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Расчётный листок', bold: true, size: 28 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${formatDate(startDate)} – ${formatDate(endDate)}`, size: 22 })],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [new TextRun({ text: `Работодатель: ИП Пиногоров А.А.`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Сотрудник: ${worker.full_name}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Должность: ${worker.position || ''}` })] }),
      new Paragraph({ children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    ];

    // Добавляем детализацию выплат (если есть)
    if (payments && payments.length > 0) {
      docChildren.push(new Paragraph({ children: [] }));
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Детализация выплат', bold: true, size: 22 })],
        })
      );

      const paymentRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Дата', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Тип', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Комментарий', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true })], alignment: AlignmentType.RIGHT })] }),
          ],
        }),
        ...payments.map(p =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(formatDate(p.payment_date))] }),
              new TableCell({ children: [new Paragraph(typeLabel(p.type))] }),
              new TableCell({ children: [new Paragraph(p.comment || '—')] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun(formatMoney(p.amount))], alignment: AlignmentType.RIGHT })] }),
            ],
          })
        ),
      ];

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: paymentRows,
        })
      );
    }

    docChildren.push(new Paragraph({ children: [] }));
    docChildren.push(
      new Paragraph({ children: [new TextRun({ text: `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}` })] })
    );
    docChildren.push(new Paragraph({ children: [new TextRun({ text: 'ИП Пиногоров А.А.' })] }));

    const doc = new Document({
      sections: [{ children: docChildren }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Расчётный лист ${workerName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Расчёт заработной платы</h1>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Начало периода</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Конец периода</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <button
              onClick={handleGenerate}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Сформировать
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          {report.length === 0 && (
            <p className="text-gray-500 text-center">Нет данных за выбранный период.</p>
          )}
          {report.map((item, idx) => (
            <details key={idx} className="bg-white rounded-xl shadow" open>
              <summary className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold">{item.brigade.name}</h2>
                <span className="text-sm font-medium text-blue-600">
                  {item.workers.length} чел. — {formatMoney(item.total_brigade_amount ?? 0)}
                </span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {item.workers.map((w: any) => {
                  const paid = paymentsMap[w.worker.id] || 0;
                  const accrued = w.total_amount || 0;
                  const balance = accrued - paid;
                  const isOverpaid = balance < 0;

                  return (
                    <details key={w.worker.id} className="pl-4 border-l-2 border-gray-200">
                      <summary className="py-1 cursor-pointer flex justify-between items-center">
                        <span className="font-medium">{w.worker.full_name} ({w.worker.position})</span>
                        <span className={`font-medium mr-4 ${isOverpaid ? 'text-red-600' : 'text-green-600'}`}>
                          Остаток: {formatMoney(balance)}
                        </span>
                      </summary>
                      <div className="mt-2 text-sm space-y-2">
                        <div className="flex justify-between text-gray-600">
                          <span>Начислено:</span>
                          <span className="font-medium">{formatMoney(accrued)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Выплачено:</span>
                          <span className="font-medium">{formatMoney(paid)}</span>
                        </div>
                        <div className={`flex justify-between font-medium ${isOverpaid ? 'text-red-600' : 'text-green-600'}`}>
                          <span>Остаток:</span>
                          <span>{formatMoney(balance)}</span>
                        </div>

                        <ul className="mt-2 space-y-1 pl-4 text-sm">
                          {w.details.map((d: any) => (
                            <li key={d.id} className="text-gray-600 text-sm leading-relaxed">
                              <span className="text-gray-500">{formatDate(d.date)}</span>
                              {' — '}
                              <span>{d.workTypeName}</span>
                              {': '}
                              {d.quantity} {d.unit} × {formatMoney(d.rate)} = <span className="font-medium">{formatMoney(d.amount)}</span>
                              {d.object && (
                                <span className="block text-xs text-gray-400 mt-0.5">
                                  {d.object.name}
                                  {d.object.address ? `, ${d.object.address}` : ''}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => generatePayslip(w.worker.id, w.worker.full_name)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
                        >
                          Скачать .docx
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}