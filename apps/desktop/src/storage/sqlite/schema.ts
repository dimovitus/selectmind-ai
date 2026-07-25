import Database from '@tauri-apps/plugin-sql';

type SqlDatabase = Awaited<ReturnType<typeof Database.load>>;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    data TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)`,
];

export async function migrateSchema(db: SqlDatabase): Promise<void> {
  for (const sql of TABLES) {
    await db.execute(sql);
  }
}
