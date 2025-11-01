import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";
import { authMiddleware } from "./telegramAuth.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || "https://mvp-bonus-tma-1.onrender.com";

const app = express();

// ==================== CORS FIX ====================
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(authMiddleware);

// ==================== INIT DATABASE ====================
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id TEXT,
    phone TEXT,
    balance INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    partner TEXT,
    price INTEGER,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    service_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ==================== AUTOSEED TEST DATA ====================
function seedDemoData() {
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const svcCount = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
  const purchaseCount = db.prepare("SELECT COUNT(*) AS c FROM purchases").get().c;

  if (userCount === 0) {
    console.log("🌱 Seeding demo users...");
    db.prepare(
      "INSERT INTO users (tg_id, phone, balance, role) VALUES ('demo1', '+79998887766', 200, 'user')"
    ).run();
    db.prepare(
      "INSERT INTO users (tg_id, phone, balance, role) VALUES ('demo2', '+79995553311', 450, 'user')"
    ).run();
  }

  if (svcCount === 0) {
    console.log("🌱 Seeding demo services...");
    db.prepare(
      "INSERT INTO services (title, partner, price, description) VALUES (?, ?, ?, ?)"
    ).run("Скидка 20% в кафе «Осознанность»", "OsCafe", 100, "Купон на скидку при заказе");
    db.prepare(
      "INSERT INTO services (title, partner, price, description) VALUES (?, ?, ?, ?)"
    ).run("1 месяц фитнеса GetFit", "GetFit Gym", 250, "Абонемент в зал на 30 дней");
  }

  if (purchaseCount === 0) {
    console.log("🌱 Seeding demo purchases...");
    const u = db.prepare("SELECT id FROM users WHERE tg_id = 'demo2'").get();
    const s = db.prepare("SELECT id FROM services WHERE title LIKE '%Осознанность%'").get();
    if (u && s) {
      db.prepare("INSERT INTO purchases (user_id, service_id) VALUES (?, ?)").run(u.id, s.id);
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(100, u.id);
    }
  }
}
seedDemoData();

// ==================== HELPERS ====================
function getOrCreateUserByTgId(tgId) {
  let user = db.prepare("SELECT * FROM users WHERE tg_id = ?").get(String(tgId));
  if (!user) {
    db.prepare("INSERT INTO users (tg_id, balance) VALUES (?, 0)").run(String(tgId));
    user = db.prepare("SELECT * FROM users WHERE tg_id = ?").get(String(tgId));
  }
  return user;
}

// ==================== AUTH ====================
app.use((req, res, next) => {
  if (req.tgUser?.id) {
    req.userDb = getOrCreateUserByTgId(req.tgUser.id);
  }
  next();
});

// ==================== USERS ====================
app.get("/api/user/me", (req, res) => {
  return res.json({ user: req.userDb || null, tgUser: req.tgUser || null });
});

app.post("/api/user/phone", (req, res) => {
  const { phone } = req.body;
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });
  if (!phone) return res.status(400).json({ error: "phone required" });

  const conflict = db
    .prepare("SELECT id FROM users WHERE phone = ? AND tg_id != ?")
    .get(phone, String(req.tgUser.id));
  if (conflict) return res.status(409).json({ error: "phone already used" });

  db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(phone, user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  return res.json({ user: updated });
});

app.get("/api/services", (req, res) => {
  const rows = db.prepare("SELECT * FROM services WHERE active = 1 ORDER BY id DESC").all();
  return res.json({ services: rows });
});

app.post("/api/user/redeem", (req, res) => {
  const { serviceId } = req.body;
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });
  if (!serviceId) return res.status(400).json({ error: "serviceId required" });

  const svc = db.prepare("SELECT * FROM services WHERE id = ? AND active = 1").get(serviceId);
  if (!svc) return res.status(404).json({ error: "service not found" });

  const already = db
    .prepare("SELECT id FROM purchases WHERE user_id = ? AND service_id = ?")
    .get(user.id, svc.id);
  if (already) return res.status(409).json({ error: "already purchased" });

  if (user.balance < svc.price)
    return res.status(400).json({ error: "insufficient balance" });

  db.prepare("BEGIN").run();
  db.prepare("INSERT INTO purchases (user_id, service_id) VALUES (?, ?)").run(user.id, svc.id);
  db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(svc.price, user.id);
  db.prepare("COMMIT").run();

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  return res.json({ ok: true, balance: updated.balance });
});

app.get("/api/user/purchases", (req, res) => {
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });

  const rows = db
    .prepare(
      `SELECT p.id, s.title, s.partner, s.description, s.price, p.created_at
       FROM purchases p JOIN services s ON p.service_id = s.id
       WHERE p.user_id = ? ORDER BY p.id DESC`
    )
    .all(user.id);

  return res.json({ items: rows });
});

// ==================== ADMIN (временно для всех) ====================
app.post("/api/admin/bonus", (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !Number.isInteger(amount)) {
    return res.status(400).json({ error: "phone and integer amount required" });
  }

  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  if (!user) {
    db.prepare("INSERT INTO users (phone, balance) VALUES (?, 0)").run(phone);
    user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  }

  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);

  return res.json({ ok: true, user: updated });
});

app.post("/api/admin/services", (req, res) => {
  const { title, partner, price, description } = req.body;
  if (!title || !Number.isInteger(price)) {
    return res.status(400).json({ error: "title and integer price required" });
  }

  const result = db
    .prepare(
      "INSERT INTO services (title, partner, price, description, active) VALUES (?, ?, ?, ?, 1)"
    )
    .run(title, partner || null, price, description || null);

  const newSvc = db.prepare("SELECT * FROM services WHERE id = ?").get(result.lastInsertRowid);
  return res.json({ ok: true, service: newSvc });
});

app.get("/api/admin/users", (req, res) => {
  const rows = db
    .prepare("SELECT id, tg_id, phone, balance, role, created_at FROM users ORDER BY id DESC")
    .all();
  return res.json({ users: rows });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
