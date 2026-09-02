import { getDb } from './db';

let initialized = false;

/** Ensures DB is migrated and seeded (idempotent). */
export function ensureDb() {
  if (!initialized) {
    getDb();
    initialized = true;
  }
}
