import Database from '@tauri-apps/plugin-sql';
import { migrateSchema } from './schema';

let dbPromise: Promise<Database> | null = null;

export async function initDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await Database.load('sqlite:selectmind.db');
        await migrateSchema(db);
        return db;
      } catch (error) {
        dbPromise = null;
        throw new Error(`SQLite init failed: ${formatError(error)}`, { cause: error });
      }
    })();
  }
  return dbPromise;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    throw new Error('Database not initialized — call initDatabase() first');
  }
  return dbPromise;
}
