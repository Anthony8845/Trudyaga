// lib/data.ts
import { supabase } from './supabase';

export interface Worker {
  id: number;
  full_name: string;  // в БД теперь full_name
  position: string;
  brigade_id?: number;
}

export interface WorkType {
  id: number;
  name: string;
  unit: string;
  rate: number;
}

export interface WorkLog {
  id: number;
  worker_id: number;
  work_type_id: number;
  quantity: number;
  log_date: string;
  amount: number;
}

export interface Brigade {
  id: number;
  name: string;
}

// ---------- Бригады ----------
export async function getBrigades(): Promise<Brigade[]> {
  const { data, error } = await supabase.from('brigades').select('*');
  if (error) throw error;
  return data;
}

export async function addBrigade(name: string): Promise<Brigade> {
  const { data, error } = await supabase.from('brigades').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function updateBrigade(brigade: Brigade): Promise<void> {
  const { error } = await supabase.from('brigades').update({ name: brigade.name }).eq('id', brigade.id);
  if (error) throw error;
}

export async function deleteBrigade(id: number): Promise<void> {
  const { error } = await supabase.from('brigades').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Сотрудники ----------
export async function getWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase.from('workers').select('*');
  if (error) throw error;
  return data;
}

export async function addWorker(worker: Omit<Worker, 'id'>): Promise<Worker> {
  const { data, error } = await supabase.from('workers').insert(worker).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorker(worker: Worker): Promise<void> {
  const { id, ...fields } = worker;  // убираем id из данных обновления
  const { error } = await supabase.from('workers').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteWorker(id: number): Promise<void> {
  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Виды работ ----------
export async function getWorkTypes(): Promise<WorkType[]> {
  const { data, error } = await supabase.from('work_types').select('*');
  if (error) throw error;
  return data;
}

export async function addWorkType(wt: Omit<WorkType, 'id'>): Promise<WorkType> {
  const { data, error } = await supabase.from('work_types').insert(wt).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkType(wt: WorkType): Promise<void> {
  const { error } = await supabase.from('work_types').update(wt).eq('id', wt.id);
  if (error) throw error;
}

export async function deleteWorkType(id: number): Promise<void> {
  const { error } = await supabase.from('work_types').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Журнал работ ----------
export async function getWorkLogs(): Promise<WorkLog[]> {
  const { data, error } = await supabase.from('work_logs').select('*');
  if (error) throw error;
  return data;
}

export async function addWorkLog(log: Omit<WorkLog, 'id' | 'amount'>): Promise<WorkLog> {
  // Получаем ставку вида работ
  const { data: wt, error: wtError } = await supabase
    .from('work_types')
    .select('rate')
    .eq('id', log.work_type_id)
    .single();
  if (wtError) throw wtError;
  const amount = log.quantity * wt.rate;

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ ...log, amount })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addWorkLogForBrigade(
  brigadeId: number,
  workTypeId: number,
  quantity: number,
  date: string
): Promise<WorkLog[]> {
  // Получаем список сотрудников бригады
  const { data: workers, error: wError } = await supabase
    .from('workers')
    .select('id')
    .eq('brigade_id', brigadeId);
  if (wError) throw wError;
  if (!workers.length) throw new Error('В бригаде нет сотрудников');

  const logs: WorkLog[] = [];
  for (const w of workers) {
    const log = await addWorkLog({
      worker_id: w.id,
      work_type_id: workTypeId,
      quantity,
      log_date: date,
    });
    logs.push(log);
  }
  return logs;
}

// ---------- Отчёт ----------
export async function getSalaryReport(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('work_logs')
    .select(`
      id, log_date, quantity, amount,
      worker:workers!inner(id, full_name, position, brigade_id),
      work_type:work_types(id, name, unit, rate)
    `)
    .gte('log_date', startDate)
    .lte('log_date', endDate);

  if (error) throw error;

  const logs = (data as any[]).map((log: any) => ({
    id: log.id,
    log_date: log.log_date,
    quantity: log.quantity,
    amount: log.amount ?? 0,
    worker: {
      id: log.worker.id,
      full_name: log.worker.full_name,
      position: log.worker.position,
      brigade_id: log.worker.brigade_id,
    },
    work_type: log.work_type ? {
      id: log.work_type.id,
      name: log.work_type.name,
      unit: log.work_type.unit,
      rate: log.work_type.rate,
    } : null,
  }));


  const brigadeMap = new Map<number, { brigadeId: number; brigadeName: string; workers: Map<number, any> }>();
  const noBrigade: any = { brigadeId: null, brigadeName: 'Без бригады', workers: new Map<number, any>() };

  for (const log of logs) {
    const brigadeId = log.worker.brigade_id || null;
    let target: any;
    if (brigadeId === null) {
      target = noBrigade;
    } else {
      if (!brigadeMap.has(brigadeId)) {
        brigadeMap.set(brigadeId, {
          brigadeId,
          brigadeName: '',
          workers: new Map(),
        });
      }
      target = brigadeMap.get(brigadeId)!;
    }

    if (!target.workers.has(log.worker.id)) {
      target.workers.set(log.worker.id, {
        worker: log.worker,
        total_amount: 0,
        details: [],
      });
    }
    const wData = target.workers.get(log.worker.id);
    wData.total_amount += log.amount;
    wData.details.push({
      id: log.id,
      date: log.log_date,
      workTypeName: log.work_type?.name,
      unit: log.work_type?.unit,
      quantity: log.quantity,
      rate: log.work_type?.rate,
      amount: log.amount,
    });
  }

  // Получаем названия бригад (только если есть id)
  if (brigadeMap.size > 0) {
    const ids = Array.from(brigadeMap.keys());
    const { data: brigs, error: brigsError } = await supabase.from('brigades').select('id, name').in('id', ids);
    if (brigs) {
      for (const b of brigs) {
        const entry = brigadeMap.get(b.id);
        if (entry) {
          entry.brigadeName = b.name;
        }
      }
    }
  }

  const result: any[] = [];

  if (noBrigade.workers.size > 0) {
    result.push({
      brigade: null,
      brigade_name: 'Без бригады',
      total_brigade_amount: Array.from(noBrigade.workers.values()).reduce((sum: number, w: any) => sum + w.total_amount, 0),
      workers: Array.from(noBrigade.workers.values()),
    });
  }

  for (const [brigadeId, brigade] of brigadeMap) {
    result.push({
      brigade: brigadeId,
      brigade_name: brigade.brigadeName || 'Бригада без названия',
      total_brigade_amount: Array.from(brigade.workers.values()).reduce((sum: number, w: any) => sum + w.total_amount, 0),
      workers: Array.from(brigade.workers.values()),
    });
  }

  return result;
}