'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSalaryReport } from '@/lib/data';
import { formatMoney, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Packer, Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';

export default function ReportPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'brigadier' || user?.role === 'supervisor';
  const brigadeId = user?.brigadeId;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<any[] | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today.substring(0, 7) + '-01');
    setEndDate(today);
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;
    const data = await getSalaryReport(startDate, endDate);
    if (!isManager && brigadeId) {
      const filtered = data.filter((b: any) => b.brigade.id === brigadeId);
      setReport(filtered);
    } else {
      setReport(data);
    }
  };

 const generatePayslip = async (workerId: number, workerName: string) => {
  const { data: worker } = await supabase.from('workers').select('full_name, position').eq('id', workerId).single();
  const { data: logs } = await supabase
    .from('work_logs')
    .select('id, log_date, quantity, amount, work_type:work_types(name, unit, rate), object:objects(id, name)')
    .eq('worker_id', workerId)
    .eq('status', 'approved')
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true });

  if (!worker || !logs) {
    alert('Нет данных для расчётного листка');
    return;
  }

  // Группируем работы по объектам
  const objectGroups = new Map<string, any[]>();
  logs.forEach((log: any) => {
    const objName = log.object?.name || 'Без объекта';
    if (!objectGroups.has(objName)) objectGroups.set(objName, []);
    objectGroups.get(objName)!.push(log);
  });

  // Строим строки таблицы
  const tableRows: TableRow[] = [];
  let totalAmount = 0;
  for (const [objName, objLogs] of objectGroups) {
    // Заголовок объекта
    tableRows.push(new TableRow({
      children: [new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: objName, bold: true })] })],
        columnSpan: 5,
      })],
    }));
    // Работы объекта
    objLogs.forEach((log: any) => {
      totalAmount += log.amount;
      tableRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(log.work_type?.name || '')] }),
          new TableCell({ children: [new Paragraph(log.work_type?.unit || '')] }),
          new TableCell({ children: [new Paragraph({ text: String(log.quantity), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatMoney(log.work_type?.rate), alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: formatMoney(log.amount), alignment: AlignmentType.RIGHT })] }),
        ],
      }));
    });
  }

  // Итого
  tableRows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Итого', bold: true })] })], columnSpan: 4 }),
      new TableCell({ children: [new Paragraph({
                                                children: [new TextRun({ text: formatMoney(totalAmount), bold: true, size: 28 })],
                                                alignment: AlignmentType.RIGHT,
                                              })] }),
    ],
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
            children: [new TextRun({ text: 'Расчётный листок', bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `${startDate} – ${endDate}`, size: 22 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Работодатель: ИП Пиногоров А.А.`, bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Сотрудник: ${worker.full_name}`, bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Должность: ${worker.position || ''}` })],
          }),
        new Paragraph(''),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph({children: [new TextRun({text: 'Вид работы', bold: true})] })] }),
            new TableCell({ children: [new Paragraph({children: [new TextRun({text: 'Ед.', bold: true})] })] }),
            new TableCell({ children: [new Paragraph({children: [new TextRun({text: 'Кол-во', bold: true})], alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({children: [new TextRun({text: 'Расценка', bold: true})], alignment: AlignmentType.RIGHT })] }),
            new TableCell({ children: [new Paragraph({children: [new TextRun({text: 'Сумма', bold: true})], alignment: AlignmentType.RIGHT })] }),
            // new TableCell({ children: [new Paragraph({ text: '', bold: true })] }),
            // new TableCell({ children: [new Paragraph({ text: 'Кол-во', bold: true, alignment: AlignmentType.RIGHT })] }),
            // new TableCell({ children: [new Paragraph({ text: 'Расценка', bold: true, alignment: AlignmentType.RIGHT })] }),
            // new TableCell({ children: [new Paragraph({ text: 'Сумма', bold: true, alignment: AlignmentType.RIGHT })] }),
          ] }),
          ...tableRows,
        ] }),
        new Paragraph(''),
        new Paragraph(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`),
        new Paragraph('ИП Пиногоров А.А.'),
      ],
    }],
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Расчётный лист ${workerName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Расчёт заработной платы</h1>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div><label className="block text-sm font-medium text-gray-700">Начало периода</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
          <div><label className="block text-sm font-medium text-gray-700">Конец периода</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
          <div><button onClick={handleGenerate} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сформировать</button></div>
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          {report.map((brigade: any) => (
            <details key={brigade.brigade.id ?? 'no-brig'} className="bg-white rounded-xl shadow" open>
              <summary className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold">{brigade.brigade.name}</h2>
                <span className="text-sm font-medium text-blue-600">{formatMoney(brigade.total_brigade_amount ?? 0)}</span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {brigade.workers.map((w: any) => {
                  const detailsByObject = new Map<string, any[]>();
                  w.details.forEach((d: any) => {
                    const objKey = d.object?.id ?? 'no-object';
                    if (!detailsByObject.has(objKey)) detailsByObject.set(objKey, []);
                    detailsByObject.get(objKey)!.push(d);
                  });

                  return (
                    <details key={w.worker.id} className="pl-4 border-l-2 border-gray-200">
                      <summary className="py-1 cursor-pointer flex justify-between items-center">
                        <span className="font-medium">{w.worker.full_name} ({w.worker.position})</span>
                        <span className="font-medium mr-4">{formatMoney(w.total_amount ?? 0)}</span>
                      </summary>
                      <div className="mt-2 text-sm space-y-3">
                        {Array.from(detailsByObject.entries()).map(([objKey, details]) => {
                          const objName = details[0]?.object?.name || 'Без объекта';
                          return (
                            <div key={objKey}>
                              <p className="font-semibold text-gray-700 mb-1">{objName}</p>
                              <ul className="pl-4 space-y-1">
                                {details.map((d: any) => (
                                  <li key={d.id}>{formatDate(d.date)} — {d.workTypeName}: {d.quantity} {d.unit} × {formatMoney(d.rate)} = {formatMoney(d.amount)}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => generatePayslip(w.worker.id, w.worker.full_name)}
                          className="mt-2 inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 border border-blue-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
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