import { NextRequest, NextResponse } from 'next/server';
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
  HeadingLevel,
} from 'docx';
import { supabase } from '@/lib/supabase';

const EMPLOYER = 'ИП Пиногоров А.А.';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get('workerId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!workerId || !start || !end) {
    return new NextResponse('Неверные параметры', { status: 400 });
  }

  try {
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('full_name, position')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      return new NextResponse('Сотрудник не найден', { status: 404 });
    }

    const { data: logs, error: logsError } = await supabase
      .from('work_logs')
      .select('id, log_date, quantity, amount, work_type:work_types(name, unit, rate)')
      .eq('worker_id', workerId)
      .eq('status', 'approved')
      .gte('log_date', start)
      .lte('log_date', end)
      .order('log_date', { ascending: true });

    if (logsError) {
      console.error('Supabase error:', logsError);
      return new NextResponse('Ошибка получения данных', { status: 500 });
    }

    const totalAmount = logs?.reduce((sum, log: any) => sum + log.amount, 0) || 0;

    const tableRows = logs?.map((log: any) =>
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(log.work_type?.name || '')],
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph(log.work_type?.unit || '')],
            width: { size: 10, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(String(log.quantity))], alignment: AlignmentType.RIGHT })],
            width: { size: 10, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(formatMoney(log.work_type?.rate))], alignment: AlignmentType.RIGHT })],
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(formatMoney(log.amount))], alignment: AlignmentType.RIGHT })],
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    ) || [];

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Итого', bold: true })] })],
            columnSpan: 4,
            width: { size: 65, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totalAmount), bold: true })], alignment: AlignmentType.RIGHT })],
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Расчётный листок', bold: true, size: 28 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${formatDate(start)} – ${formatDate(end)}`, size: 22 })],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              children: [new TextRun({ text: `Работодатель: ${EMPLOYER}`, bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Сотрудник: ${worker.full_name}`, bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Должность: ${worker.position || ''}` })],
            }),
            new Paragraph({ children: [] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Вид работы', bold: true })] })],
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Ед.', bold: true })] })],
                      width: { size: 10, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 10, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Расценка', bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                ...tableRows,
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              children: [new TextRun({ text: `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}` })],
            }),
            new Paragraph({
              children: [new TextRun({ text: EMPLOYER })],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Расчётный лист ${worker.full_name}.docx"`,
      },
    });
  } catch (error) {
    console.error('Payslip generation error:', error);
    return new NextResponse('Внутренняя ошибка сервера', { status: 500 });
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}

function formatMoney(amount: number): string {
  if (!amount && amount !== 0) return '0,00 ₽';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
}