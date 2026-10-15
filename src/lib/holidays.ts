import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getDb } from './db';

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/** Seed set aligned with workbook R5 (New Delhi calendar sample) */
export const DEFAULT_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-14', name: 'Holi' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-09', name: 'Diwali' },
  { date: '2026-12-25', name: 'Christmas' },
];

export function seedHolidays(db: ReturnType<typeof getDb>) {
  const insert = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
  for (const h of DEFAULT_HOLIDAYS) {
    insert.run(h.date, h.name);
  }
}

export function isHoliday(date: Date): boolean {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  const key = format(zoned, 'yyyy-MM-dd');
  const row = getDb().prepare('SELECT 1 FROM holidays WHERE date = ?').get(key);
  return !!row;
}

export function listHolidays() {
  return getDb()
    .prepare('SELECT date, name FROM holidays ORDER BY date ASC')
    .all() as { date: string; name: string }[];
}
