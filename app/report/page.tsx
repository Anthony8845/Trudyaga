// app/report/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSalaryReport } from '@/lib/data';
import { formatMoney, formatDate } from '@/lib/utils';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';

interface WorkerDetail {
  worker: {
    id: number;
    full_name: string;
    position: string;
  };
  total_amount: number;
  details: {
    id: number;
    date: string;
    workTypeName: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
}

interface ReportItem {
  brigade: number | null;
  brigade_name: string;
  total_brigade_amount: number;
  workers: WorkerDetail[];
}

export default function ReportPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';
  const brigadeId = user?.brigadeId;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<ReportItem[] | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today.substring(0, 7) + '-01');
    setEndDate(today);
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      alert('Выберите даты');
      return;
    }
    const fullReport = await getSalaryReport(startDate, endDate);
    if (!isManager && brigadeId) {
      // Оставляем только бригаду бригадира
      const filtered = fullReport.filter(item => item.brigade === brigadeId);
      setReport(filtered);
    } else {
      setReport(fullReport);
    }
  };
  const handlePrint = () => {
  if (!report || report.length === 0) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Зарплатная ведомость</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Зарплатная ведомость</h1>
          ${report.map(item => `
            <h2>${item.brigade_name} (${formatMoney(item.total_brigade_amount ?? 0)})</h2>
            <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:20px;">
              <tr><th>Сотрудник</th><th>Сумма</th></tr>
              ${item.workers.map(w => `
                <tr><td>${w.worker.full_name}</td><td>${formatMoney(w.total_amount ?? 0)}</td></tr>
              `).join('')}
            </table>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPayslip = async (worker: any) => {
  // Данные для расчётного листка уже есть в props (worker.total_amount, worker.details)
  const details = worker.details;

  const tableRows = details.map((d: any) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(d.workTypeName || '')], width: { size: 30, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph(d.unit || '')], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun(String(d.quantity))], alignment: AlignmentType.RIGHT })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun(formatMoney(d.rate))], alignment: AlignmentType.RIGHT })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun(formatMoney(d.amount))], alignment: AlignmentType.RIGHT })], width: { size: 15, type: WidthType.PERCENTAGE } }),
      ],
    })
  );

  tableRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Итого', bold: true })] })], columnSpan: 4, width: { size: 65, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(worker.total_amount), bold: true })], alignment: AlignmentType.RIGHT })], width: { size: 15, type: WidthType.PERCENTAGE } }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Расчётный листок', bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${startDate} – ${endDate}`, size: 22 })] }),
        new Paragraph({ children: [] }),
        new Paragraph({ children: [new TextRun({ text: `Работодатель: ИП Пиногоров А.А.`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Сотрудник: ${worker.worker.full_name}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Должность: ${worker.worker.position || ''}` })] }),
        new Paragraph({ children: [] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Вид работы', bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ед.', bold: true })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true })], alignment: AlignmentType.RIGHT })], width: { size: 10, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Расценка', bold: true })], alignment: AlignmentType.RIGHT })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true })], alignment: AlignmentType.RIGHT })], width: { size: 15, type: WidthType.PERCENTAGE } }),
          ] }),
          ...tableRows,
        ] }),
        new Paragraph({ children: [] }),
        new Paragraph({ children: [new TextRun(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`)] }),
        new Paragraph({ children: [new TextRun('ИП Пиногоров А.А.')] }),
      ],
    }],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Расчётный лист ${worker.worker.full_name}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
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
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Конец периода</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            <button onClick={handlePrint} className="px-4 py-2 bg-gray-200 rounded-md">Печать ведомости</button>
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
              <summary className="p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">{item.brigade_name}</h2>
                  <span className="text-sm font-medium text-blue-600">
                    {item.workers.length} чел. — {formatMoney(item.total_brigade_amount ?? 0)}
                  </span>
                </div>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {item.workers.map((w, widx) => (
                  <details key={widx} className="pl-4 border-l-2 border-gray-200">
                    <summary className="py-1 cursor-pointer text-gray-800">
                      <span className="font-medium">{w.worker.full_name}</span>
                      <span className="ml-2 text-gray-500 text-sm">{w.worker.position}</span>
                      <span className="float-right mr-4 font-medium">{formatMoney(w.total_amount ?? 0)}</span>
                        <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPayslip(w);
                            }}
                            className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Скачать .docx
                        </button>
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 text-sm">
                      {w.details.map(d => (
                        <li key={d.id} className="text-gray-600">
                          {formatDate(d.date)} — {d.workTypeName}: {d.quantity} {d.unit} × {formatMoney(d.rate)} = {formatMoney(d.amount)}
                        </li>
                      ))}
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