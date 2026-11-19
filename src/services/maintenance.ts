// Maintenance logic: when is a task due, and what is its status?
//
// Rules (kept simple on purpose):
// - Start point = date of the last diary entry that completed this task,
//   otherwise the commissioning date of the tag (Inbetriebnahme).
// - Due date = start point + interval.
// - Status: "overdue" after the due date, "due" within a warning window before it,
//   otherwise "ok". Window = 10 % of the interval, at least 7 and at most 30 days.

import { data } from '../data';
import type { IntervalUnit, LogEntry, MaintenanceTask, Tag } from '../data/types';
import { INTERVAL_UNIT_LABELS } from '../data/types';
import { t, translated } from '../i18n';
import { addDays, addMonths, daysBetween, today } from '../lib/util';

export type MaintStatus = 'ok' | 'due' | 'overdue';

export const STATUS_LABELS: Record<MaintStatus, string> = translated({
  ok: 'OK',
  due: 'Fällig',
  overdue: 'Überfällig',
});

export const STATUS_RANK: Record<MaintStatus, number> = { ok: 0, due: 1, overdue: 2 };

export interface TaskStatus {
  task: MaintenanceTask;
  tag: Tag;
  lastDone: string | null; // null = never done, counting from commissioning
  startDate: string;
  dueDate: string;
  daysLeft: number; // negative = overdue
  status: MaintStatus;
}

export function addInterval(date: string, value: number, unit: IntervalUnit, times = 1): string {
  const n = value * times;
  switch (unit) {
    case 'days':
      return addDays(date, n);
    case 'weeks':
      return addDays(date, n * 7);
    case 'months':
      return addMonths(date, n);
    case 'years':
      return addMonths(date, n * 12);
  }
}

export function intervalDays(value: number, unit: IntervalUnit): number {
  const f = { days: 1, weeks: 7, months: 30.4, years: 365 }[unit];
  return value * f;
}

export function intervalLabel(value: number, unit: IntervalUnit): string {
  if (value === 1) {
    return t({ days: 'täglich', weeks: 'wöchentlich', months: 'monatlich', years: 'jährlich' }[unit]);
  }
  if (unit === 'months' && value === 3) return t('vierteljährlich');
  if (unit === 'months' && value === 6) return t('halbjährlich');
  const [one, many] = INTERVAL_UNIT_LABELS[unit];
  return t('alle {{n}} {{unit}}', { n: value, unit: t(value === 1 ? one : many) });
}

export function warningWindowDays(task: MaintenanceTask): number {
  return Math.min(30, Math.max(7, Math.round(intervalDays(task.intervalValue, task.intervalUnit) * 0.1)));
}

export function computeTaskStatus(
  task: MaintenanceTask,
  tag: Tag,
  entries: LogEntry[],
  refDate: string = today(),
): TaskStatus {
  let lastDone: string | null = null;
  for (const e of entries) {
    if (e.tagId === tag.id && e.completedTaskIds.includes(task.id)) {
      if (!lastDone || e.date > lastDone) lastDone = e.date;
    }
  }
  const startDate = lastDone ?? (tag.commissionedAt || tag.createdAt.slice(0, 10));
  const dueDate = addInterval(startDate, task.intervalValue, task.intervalUnit);
  const daysLeft = daysBetween(refDate, dueDate);
  const status: MaintStatus = daysLeft < 0 ? 'overdue' : daysLeft <= warningWindowDays(task) ? 'due' : 'ok';
  return { task, tag, lastDone, startDate, dueDate, daysLeft, status };
}

export function worstStatus(list: { status: MaintStatus }[]): MaintStatus {
  return list.reduce<MaintStatus>((w, s) => (STATUS_RANK[s.status] > STATUS_RANK[w] ? s.status : w), 'ok');
}

/** Tasks that apply to a tag: the ones of its product template + its own. */
export function tasksForTag(tag: Tag, allTasks: MaintenanceTask[]): MaintenanceTask[] {
  return allTasks.filter(
    (t) =>
      (t.ownerType === 'tag' && t.ownerId === tag.id) || (t.ownerType === 'product' && t.ownerId === tag.productId),
  );
}

/** Status of every task of every tag – used for notifications, the admin table and the report. */
export async function loadAllTaskStatuses(refDate = today()): Promise<TaskStatus[]> {
  const [tags, tasks, entries] = await Promise.all([data.tags.list(), data.tasks.list(), data.logEntries.list()]);
  const result: TaskStatus[] = [];
  for (const tag of tags) {
    for (const task of tasksForTag(tag, tasks)) {
      result.push(computeTaskStatus(task, tag, entries, refDate));
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function describeDue(s: TaskStatus): string {
  if (s.daysLeft === -1) return t('seit 1 Tag überfällig');
  if (s.daysLeft < 0) return t('seit {{n}} Tagen überfällig', { n: -s.daysLeft });
  if (s.daysLeft === 0) return t('heute fällig');
  if (s.daysLeft === 1) return t('morgen fällig');
  return t('fällig in {{n}} Tagen', { n: s.daysLeft });
}
