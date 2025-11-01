import sqlite3 from "sqlite3";
import { open } from "sqlite";

const dbPromise = open({
  filename: "data.sqlite",
  driver: sqlite3.Database
});

(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id TEXT UNIQUE,
      phone TEXT UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      partner TEXT,
      price INTEGER NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, service_id)
    );
  `);
})();

export default dbPromise;
