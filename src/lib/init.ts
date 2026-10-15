import { getDb } from './db';
import { ensureStatuses, seedDatabase } from './seed';
import { seedHolidays } from './holidays';
import { ensurePlatformExtras } from './platform';
import { ensureCannedResponses } from './canned-responses';
import { ensureTicketLocks } from './ticket-lock';
import { ensureTicketRelations } from './ticket-relations';

let initialized = false;

/** Ensures DB is migrated and seeded (idempotent). */
export function ensureDb() {
  if (initialized) return;
  getDb();
  ensureStatuses(getDb());
  seedHolidays(getDb());
  ensurePlatformExtras();
  ensureCannedResponses();
  ensureTicketLocks();
  ensureTicketRelations();
  initialized = true;
}

export { seedDatabase };
