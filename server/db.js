import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPromise = open({
  filename: path.join(__dirname, "data.db"),
  driver: sqlite3.Database
});

(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id TEXT,
      phone TEXT,
      balance INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user'
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      partner TEXT,
      price INTEGER,
      description TEXT,
      active INTEGER DEFAULT 1
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      service_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ SQLite database initialized");
})();

export default dbPromise;
