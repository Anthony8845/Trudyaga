// lib/data.ts
import { supabase } from './supabase';

export interface Worker {
  id: number;
  full_name: string;
  position: string;
  brigade_id?: number | null;
}

export interface WorkType {
  id: number;
  name: string;
  unit: string;
  rate: number;
  category_id?: number | null;
  sort_order?: number;
}

export interface WorkLog {
  id: number;
  worker_id: number;
  work_type_id: number;
  quantity: number;
  log_date: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  confirmed_by?: string;
  confirmed_at?: string;
  object_id?: number | null;
  is_brigade?: boolean;
  created_by?: string;
  created_at?: string;
}

export interface Brigade {
  id: number;
  name: string;
}

export interface ObjectItem {
  id: number;
  name: string;
  address?: string;
  created_at?: string;
}

export interface WorkCategory {
  id: number;
  name: string;
  created_at?: string;
}

export interface SalaryPayment {
  id: number;
  worker_id: number;
  amount: number;
  payment_date: string;
  type: 'advance' | 'salary' | 'bonus' | 'other';
  comment?: string;
  created_by?: string;
  created_at?: string;
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
  const { id, ...fields } = brigade;
  const { error } = await supabase.from('brigades').update(fields).eq('id', id);
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
  const { id, ...fields } = worker;
  const cleaned: any = {};
  for (const [key, value] of Object.entries(fields)) {
    cleaned[key] = value === undefined ? null : value;
  }
  const { error } = await supabase.from('workers').update(cleaned).eq('id', id);
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
  const { id, ...fields } = wt;
  const { error } = await supabase.from('work_types').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkType(id: number): Promise<void> {
  const { error } = await supabase.from('work_types').delete().eq('id', id);
  if (error) throw error;
}

export async function updateWorkTypesOrder(items: { id: number; sort_order: number }[]): Promise<void> {
  const { error } = await supabase
    .from('work_types')
    .upsert(items, { onConflict: 'id' });
  if (error) throw error;
}

// ---------- Категории видов работ ----------
export async function getWorkCategories(): Promise<WorkCategory[]> {
  const { data, error } = await supabase.from('work_categories').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function addWorkCategory(name: string): Promise<WorkCategory> {
  const { data, error } = await supabase.from('work_categories').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkCategory(category: WorkCategory): Promise<void> {
  const { id, ...fields } = category;
  const { error } = await supabase.from('work_categories').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkCategory(id: number): Promise<void> {
  const { error } = await supabase.from('work_categories').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Объекты ----------
export async function getObjects(): Promise<ObjectItem[]> {
  const { data, error } = await supabase.from('objects').select('*');
  if (error) throw error;
  return data;
}

export async function addObject(obj: Omit<ObjectItem, 'id' | 'created_at'>): Promise<ObjectItem> {
  const { data, error } = await supabase.from('objects').insert(obj).select().single();
  if (error) throw error;
  return data;
}

export async function updateObject(obj: ObjectItem): Promise<void> {
  const { id, ...fields } = obj;
  const { error } = await supabase.from('objects').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteObject(id: number): Promise<void> {
  const { error } = await supabase.from('objects').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Журнал работ ----------
export async function getWorkLogs(): Promise<WorkLog[]> {
  const { data, error } = await supabase.from('work_logs').select('*');
  if (error) throw error;
  return data;
}

export async function getWorkLogsGroupedByBrigade() {
  const { data, error } = await supabase
    .from('work_logs')
    .select(`
      id, log_date, quantity, amount, status, is_brigade,
      worker:workers!inner(id, full_name, brigade_id),
      work_type:work_types(id, name, unit, rate),
      work_type_id,
      object:objects(id, name),
      object_id
    `)
    .order('log_date', { ascending: false });

  if (error) throw error;

  const brigadeSet = new Set<number>();
  const noBrigadeLogs: any[] = [];

  const grouped = new Map<number, any>();

  for (const log of (data as any[])) {
    const brigadeId = log.worker?.brigade_id || null;

    if (brigadeId === null) {
      noBrigadeLogs.push(log);
      continue;
    }

    if (!grouped.has(brigadeId)) {
      grouped.set(brigadeId, new Map<number, any>());
    }
    const workersMap = grouped.get(brigadeId)!;
    if (!workersMap.has(log.worker.id)) {
      workersMap.set(log.worker.id, {
        worker: log.worker,
        logs: [],
      });
    }
    workersMap.get(log.worker.id).logs.push(log);
  }

  const result: any[] = [];
  for (const [brigadeId, workersMap] of grouped) {
    result.push({
      brigadeId,
      brigadeName: '', // заполним позже
      workers: Array.from(workersMap.values()),
    });
  }

  if (noBrigadeLogs.length > 0) {
    // Группируем без бригады по сотрудникам
    const soloWorkersMap = new Map<number, any>();
    noBrigadeLogs.forEach(log => {
      if (!soloWorkersMap.has(log.worker.id)) {
        soloWorkersMap.set(log.worker.id, {
          worker: log.worker,
          logs: [],
        });
      }
      soloWorkersMap.get(log.worker.id).logs.push(log);
    });
    result.push({
      brigadeId: null,
      brigadeName: 'Без бригады',
      workers: Array.from(soloWorkersMap.values()),
    });
  }

  // Получаем названия бригад
  const brigadeIds = Array.from(grouped.keys()) as number[];
  if (brigadeIds.length > 0) {
    const { data: brigadesData } = await supabase
      .from('brigades')
      .select('id, name')
      .in('id', brigadeIds);
    if (brigadesData) {
      const brigadeNameMap = new Map<number, string>();
      brigadesData.forEach((b: any) => brigadeNameMap.set(b.id, b.name));
      result.forEach(brigade => {
        if (brigade.brigadeId !== null) {
          brigade.brigadeName = brigadeNameMap.get(brigade.brigadeId) || 'Бригада без названия';
        }
      });
    }
  }

  return result;
}

export async function addWorkLog(log: Omit<WorkLog, 'id' | 'amount'> & { status?: string }): Promise<WorkLog> {
  const { data: wt, error: wtError } = await supabase
    .from('work_types')
    .select('rate')
    .eq('id', log.work_type_id)
    .single();
  if (wtError) throw wtError;
  const amount = log.quantity * wt.rate;

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ ...log, amount, status: log.status || 'pending' })
    .select()
    .single();
  if (error) throw error;
  console.log('Inserting work log:', { ...log, amount, status: log.status || 'pending' });
  return data;
}

export async function addWorkLogForBrigade(
  brigadeId: number,
  workTypeId: number,
  quantity: number,
  date: string,
  objectId?: number
): Promise<WorkLog[]> {
  const { data: workers, error: wError } = await supabase
    .from('workers')
    .select('id')
    .eq('brigade_id', brigadeId);
  if (wError) throw wError;
  if (!workers.length) throw new Error('В бригаде нет сотрудников');

  const { data: wt, error: wtError } = await supabase
    .from('work_types')
    .select('rate')
    .eq('id', workTypeId)
    .single();
  if (wtError) throw wtError;

  const totalAmount = quantity * wt.rate;
  const amountPerWorker = totalAmount / workers.length;

  const logs: WorkLog[] = [];
  for (const w of workers) {
    const log = await addWorkLog({
      worker_id: w.id,
      work_type_id: workTypeId,
      quantity,
      log_date: date,
      object_id: objectId,
      is_brigade: true, // помечаем как бригадную
    } as any);
    await supabase.from('work_logs').update({ amount: amountPerWorker }).eq('id', log.id);
    log.amount = amountPerWorker;
    logs.push(log);
  }
  return logs;
}

export async function updateWorkLog(id: number, updates: Partial<WorkLog>): Promise<void> {
  const { error } = await supabase.from('work_logs').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkLog(id: number): Promise<void> {
  const { error } = await supabase.from('work_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Зарплатный отчёт ----------
export async function getSalaryReport(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('work_logs')
    .select(`
      id, log_date, quantity, amount, status,
      worker:workers!inner(id, full_name, position, brigade_id),
      work_type:work_types(id, name, unit, rate),
      object:objects(id, name, address)
    `)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .eq('status', 'approved')
    .order('log_date', { ascending: false });

  if (error) throw error;

  const sortedData = (data as any[]).sort((a, b) => b.log_date.localeCompare(a.log_date));

  const brigadeMap = new Map<number | null, any>();
  const noBrigade = {
    brigadeId: null,
    brigadeName: 'Без бригады',
    workers: new Map<number, any>(),
  };

  for (const log of sortedData) {
    const worker = log.worker;
    const brigadeId = worker.brigade_id || null;
    let target;
    if (brigadeId === null) {
      target = noBrigade;
    } else {
      if (!brigadeMap.has(brigadeId)) {
        brigadeMap.set(brigadeId, {
          brigadeId,
          brigadeName: '',
          workers: new Map<number, any>(),
        });
      }
      target = brigadeMap.get(brigadeId)!;
    }
    if (!target.workers.has(worker.id)) {
      target.workers.set(worker.id, {
        worker: {
          id: worker.id,
          full_name: worker.full_name,
          position: worker.position,
        },
        total_amount: 0,
        details: [],
      });
    }
    const wData = target.workers.get(worker.id);
    wData.total_amount += log.amount;
    wData.details.push({
      id: log.id,
      date: log.log_date,
      workTypeName: log.work_type?.name,
      unit: log.work_type?.unit,
      quantity: log.quantity,
      rate: log.work_type?.rate,
      amount: log.amount,
      object: log.object ? { id: log.object.id, name: log.object.name } : null,
    });
  }

  const brigadeIds = Array.from(brigadeMap.keys()).filter(id => id !== null) as number[];
  if (brigadeIds.length > 0) {
    const { data: brigadesData, error: brigadesError } = await supabase
      .from('brigades')
      .select('id, name')
      .in('id', brigadeIds);
    if (brigadesError) throw brigadesError;
    if (brigadesData) {
      for (const b of brigadesData) {
        const entry = brigadeMap.get(b.id);
        if (entry) entry.brigadeName = b.name;
      }
    }
  }

  const result: any[] = [];
  if (noBrigade.workers.size > 0) {
    const workersArray = Array.from(noBrigade.workers.values()) as any[];
    const total = workersArray.reduce((sum: number, w: any) => sum + w.total_amount, 0);
    result.push({
      brigade: { id: null, name: noBrigade.brigadeName },
      workers: workersArray,
      total_brigade_amount: total,
    });
  }
  for (const [, brigade] of brigadeMap) {
    const workersArray = Array.from(brigade.workers.values()) as any[];
    const total = workersArray.reduce((sum: number, w: any) => sum + w.total_amount, 0);
    result.push({
      brigade: { id: brigade.brigadeId, name: brigade.brigadeName || 'Бригада без названия' },
      workers: workersArray,
      total_brigade_amount: total,
    });
  }

  result.sort((a, b) => (a.brigade.name || '').localeCompare(b.brigade.name || ''));
  return result;
}

// Получить все выплаты за период
export async function getSalaryPayments(startDate: string, endDate: string): Promise<SalaryPayment[]> {
  const { data, error } = await supabase
    .from('salary_payments')
    .select(`
      id, worker_id, amount, payment_date, type, comment, created_at,
      worker:workers!inner(id, full_name)
    `)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data;
}

// Добавить выплату
export async function addSalaryPayment(payment: Omit<SalaryPayment, 'id' | 'created_at'>): Promise<SalaryPayment> {
  const { data, error } = await supabase
    .from('salary_payments')
    .insert(payment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Удалить выплату
export async function deleteSalaryPayment(id: number): Promise<void> {
  const { error } = await supabase.from('salary_payments').delete().eq('id', id);
  if (error) throw error;
}

// Обновить выплату (не обязательно, но может пригодиться)
export async function updateSalaryPayment(id: number, updates: Partial<SalaryPayment>): Promise<void> {
  const { error } = await supabase.from('salary_payments').update(updates).eq('id', id);
  if (error) throw error;
}

