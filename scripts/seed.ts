import { ensureDb } from '../src/lib/init';
import { seedDatabase } from '../src/lib/seed';

ensureDb();
seedDatabase();
console.log('IntelliDesk database seeded.');
