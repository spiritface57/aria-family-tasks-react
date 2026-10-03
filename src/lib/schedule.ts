import type { Task, TaskResult } from '../types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEK_ALL = 127;
export const dayIndex = (date: Date) => (date.getDay() + 6) % 7;
export function localDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export function dateFromLocal(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(date: Date, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + delta);
  return next;
}
export function mondayOf(date: Date): Date { return addDays(date, -dayIndex(date)); }
export function weekDays(date: Date): Date[] { const monday = mondayOf(date); return Array.from({length: 7}, (_,i) => addDays(monday, i)); }
export function occurs(task: Task, date: Date): boolean {
  return task.active && (task.days_mask & (1 << dayIndex(date))) !== 0 &&
    localDate(date) >= localDate(new Date(task.created_at));
}
export function resultFor(results: TaskResult[], task: Task, date: Date, childId: string): TaskResult | undefined {
  const key = localDate(date);
  return results.find(r => r.task_id === task.id && r.child_id === childId && r.local_date === key);
}
export function dailyTasks(tasks: Task[], date: Date): Task[] {
  return tasks.filter(t => occurs(t, date)).sort((a,b) => a.time_local.localeCompare(b.time_local));
}
export function dayStats(tasks: Task[], results: TaskResult[], date: Date, childId: string, today = new Date()) {
  if (localDate(date) > localDate(today)) return {done: 0, help: 0, not_done: 0, unanswered: 0, total: 0};
  const isToday = localDate(date) === localDate(today);
  const nowTime = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`;
  const occurrences = dailyTasks(tasks, date).filter(t => !isToday || t.time_local.slice(0,5) <= nowTime || Boolean(resultFor(results,t,date,childId)));
  const counts = {done: 0, help: 0, not_done: 0, unanswered: 0, total: occurrences.length};
  for (const task of occurrences) {
    const state = resultFor(results, task, date, childId)?.state ?? 'unanswered';
    counts[state]++;
  }
  return counts;
}
export function timeLabel(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minute).padStart(2,'0')} ${suffix}`;
}
export function dayDescription(mask: number): string {
  if (mask === 127) return 'Every day';
  if (mask === 31) return 'Weekdays';
  return DAYS.filter((_,index) => (mask & (1 << index)) !== 0).join(', ');
}
export function dateHeading(date: Date): string {
  return date.toLocaleDateString('en-CA', {month:'long', day:'numeric', year:'numeric'});
}

export function generateICS(tasks: Task[], date = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'): string {
  const escapeIcs = (s: string) => s.replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const localStamp = (d: Date, time: string) => `${localDate(d).replace(/-/g,'')}T${time.slice(0,5).replace(':','')}00`;
  const weekdays = ['MO','TU','WE','TH','FR','SA','SU'];
  const events = tasks.filter(t => t.active).map(task => {
    const occurrence = Array.from({length:14}, (_,i)=>addDays(date,i)).find(d=>occurs(task,d));
    if (!occurrence) return '';
    const start = localStamp(occurrence, task.time_local);
    const end = new Date(occurrence.getFullYear(),occurrence.getMonth(),occurrence.getDate(),Number(task.time_local.slice(0,2)),Number(task.time_local.slice(3,5))+15);
    const byDays = weekdays.filter((_,i)=>(task.days_mask & (1<<i))!==0).join(',');
    return [
      'BEGIN:VEVENT', `UID:${task.id}@aria-family-tasks`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,
      `DTSTART;TZID=${timezone}:${start}`, `DTEND;TZID=${timezone}:${localStamp(end,`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`)}`,
      `SUMMARY:${escapeIcs(task.title)}`, `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${escapeIcs(task.title)}`, 'END:VALARM', 'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Daylight Family Tasks//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events,'END:VCALENDAR'].join('\r\n')+'\r\n';
}
