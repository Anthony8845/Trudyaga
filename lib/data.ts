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


export interface Brigade {
  id: number;
  name: string;
}

export interface ObjectItem {
  id: number;
  name: string;
  address?: string;
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
  object_id?: number;          // новый
  // при выборке с join
  object?: ObjectItem;
  worker?: Worker;
  work_type?: WorkType;
}

// ---------- Объекты ----------
export async function getObjects(): Promise<ObjectItem[]> {
  const { data, error } = await supabase.from('objects').select('*');
  if (error) throw error;
  return data;
}

export async function addObject(obj: Omit<ObjectItem, 'id'>): Promise<ObjectItem> {
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

export async function updateWorkLog(id: number, updates: Partial<WorkLog>): Promise<void> {
  const { error } = await supabase.from('work_logs').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkLog(id: number): Promise<void> {
  const { error } = await supabase.from('work_logs').delete().eq('id', id);
  if (error) throw error;
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
  // Явно преобразуем undefined в null для nullable-полей
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
  const { id, ...fields } = wt;  // убираем id
  const { error } = await supabase.from('work_types').update(fields).eq('id', id);
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
    .select('*, worker:workers(*), work_type:work_types(*), object:objects(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function addWorkLogForBrigade(
  brigadeId: number,
  workTypeId: number,
  quantity: number,
  date: string,
  objectId?: number
): Promise<WorkLog[]> {
  // Получаем список сотрудников бригады
  const { data: workers, error: wError } = await supabase
    .from('workers')
    .select('id')
    .eq('brigade_id', brigadeId);
  if (wError) throw wError;
  if (!workers.length) throw new Error('В бригаде нет сотрудников');

  // Получаем ставку вида работы
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
    // Создаём запись с is_brigade = true
    const { data: log, error } = await supabase
      .from('work_logs')
      .insert({
        worker_id: w.id,
        work_type_id: workTypeId,
        quantity,
        log_date: date,
        object_id: objectId,
        amount: amountPerWorker,
        is_brigade: true,        // <-- ключевое изменение
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;
    logs.push(log);
  }
  return logs;
}

// ---------- Отчёт ----------
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
    .order('log_date', { ascending: false }); // запасная сортировка на уровне БД

  if (error) throw error;

  // Явная сортировка по дате (убывание) на случай, если БД вернула неверный порядок
  const sortedData = (data as any[]).sort((a, b) =>
    b.log_date.localeCompare(a.log_date)
  );

  // Группируем по бригадам
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

  // Получаем названия бригад
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

  // Формируем итоговый массив
  const result: any[] = [];
  if (noBrigade.workers.size > 0) {
    result.push({
      brigade: { id: null, name: noBrigade.brigadeName },
      workers: Array.from(noBrigade.workers.values()),
      total_brigade_amount: Array.from(noBrigade.workers.values()).reduce(
        (sum: number, w: any) => sum + w.total_amount,
        0
      ),
    });
  }
  for (const [, brigade] of brigadeMap) {
    result.push({
      brigade: { id: brigade.brigadeId, name: brigade.brigadeName || 'Бригада без названия' },
      workers: Array.from(brigade.workers.values()),
      total_brigade_amount: Array.from(brigade.workers.values()).reduce(
        (sum: number, w: any) => sum + w.total_amount,
        0
      ),
    });
  }

  // Сортировка бригад по названию для стабильного порядка
  result.sort((a, b) => (a.brigade.name || '').localeCompare(b.brigade.name || ''));

  return result;
}


// Получить все неподтверждённые записи (для руководителя)
export async function getPendingWorkLogs(): Promise<WorkLog[]> {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('status', 'pending')
    .order('log_date', { ascending: false });
  if (error) throw error;
  return data;
}

// Подтвердить запись
export async function approveWorkLog(id: number): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from('work_logs')
    .update({ status: 'approved', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Отклонить запись
export async function rejectWorkLog(id: number): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from('work_logs')
    .update({ status: 'rejected', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getWorkLogsGroupedByBrigade() {
  const { data: logs, error } = await supabase
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

  // Собираем все уникальные brigade_id из работ
  const brigadeSet = new Set<number>();
  const logsTyped = logs as any[];
  logsTyped.forEach(log => {
    if (log.worker?.brigade_id) brigadeSet.add(log.worker.brigade_id);
  });

  // Получаем названия бригад
  const brigadeMap = new Map<number, string>();
  if (brigadeSet.size > 0) {
    const { data: brigades } = await supabase
      .from('brigades')
      .select('id, name')
      .in('id', Array.from(brigadeSet));
    if (brigades) {
      brigades.forEach((b: any) => brigadeMap.set(b.id, b.name));
    }
  }

  // Группируем: бригада -> сотрудник -> работы
  const grouped = new Map<number, any>(); // brigadeId -> workersMap
  const noBrigade: any[] = []; // работы без бригады

  logsTyped.forEach(log => {
    const brigadeId = log.worker?.brigade_id || null;
    if (brigadeId === null) {
      noBrigade.push(log);
      return;
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
  });

  // Преобразуем в массив для рендеринга
  const result: any[] = [];
  for (const [brigadeId, workersMap] of grouped) {
    result.push({
      brigadeId,
      brigadeName: brigadeMap.get(brigadeId) || 'Бригада без названия',
      workers: Array.from(workersMap.values()),
    });
  }
  if (noBrigade.length > 0) {
    result.push({
      brigadeId: null,
      brigadeName: 'Без бригады',
      workers: [{
        worker: null,
        logs: noBrigade,
      }],
    });
  }
  return result;
}