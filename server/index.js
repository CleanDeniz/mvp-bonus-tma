import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dbPromise from "./db.js";
import { authMiddleware } from "./telegramAuth.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || "https://mvp-bonus-tma-1.onrender.com";

const app = express();

// ==================== CORS FIX ====================
app.use((req, res, next) => {
  const allowedOrigins = [
    CLIENT_URL,
    "https://mvp-bonus-tma.onrender.com",
    "https://mvp-bonus-tma-1.onrender.com",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Разрешаем всё, чтобы не было блокировок
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

// ==================== TELEGRAM AUTH ====================
app.use(authMiddleware);

// ==================== USER SYNC ====================
async function getOrCreateUserByTgId(db, tgId) {
  let row = await db.get("SELECT * FROM users WHERE tg_id = ?", String(tgId));
  if (!row) {
    await db.run("INSERT INTO users (tg_id, balance) VALUES (?, 0)", String(tgId));
    row = await db.get("SELECT * FROM users WHERE tg_id = ?", String(tgId));
  }
  return row;
}

app.use(async (req, res, next) => {
  if (req.tgUser?.id) {
    const db = await dbPromise;
    const user = await getOrCreateUserByTgId(db, req.tgUser.id);
    req.userDb = user;
  }
  next();
});

// ==================== USER ROUTES ====================

// Текущий пользователь
app.get("/api/user/me", (req, res) => {
  return res.json({ user: req.userDb || null, tgUser: req.tgUser || null });
});

// Установить телефон
app.post("/api/user/phone", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });

  try {
    const db = await dbPromise;
    const exists = await db.get(
      "SELECT id FROM users WHERE phone = ? AND tg_id != ?",
      phone,
      String(req.tgUser.id)
    );
    if (exists) return res.status(409).json({ error: "phone already used" });

    await db.run("UPDATE users SET phone = ? WHERE tg_id = ?", phone, String(req.tgUser.id));
    const updated = await db.get("SELECT * FROM users WHERE tg_id = ?", String(req.tgUser.id));
    return res.json({ user: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to set phone" });
  }
});

// Все активные услуги
app.get("/api/services", async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM services WHERE active = 1 ORDER BY id DESC");
  return res.json({ services: rows });
});

// Покупка услуги
app.post("/api/user/redeem", async (req, res) => {
  const { serviceId } = req.body;
  if (!serviceId) return res.status(400).json({ error: "serviceId required" });
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });

  const db = await dbPromise;
  const svc = await db.get("SELECT * FROM services WHERE id = ? AND active = 1", serviceId);
  if (!svc) return res.status(404).json({ error: "service not found or inactive" });

  const owned = await db.get(
    "SELECT id FROM purchases WHERE user_id = ? AND service_id = ?",
    user.id,
    svc.id
  );
  if (owned) return res.status(409).json({ error: "already purchased" });

  if (user.balance < svc.price) return res.status(400).json({ error: "insufficient balance" });

  try {
    await db.run("BEGIN TRANSACTION");
    await db.run("INSERT INTO purchases (user_id, service_id) VALUES (?, ?)", user.id, svc.id);
    await db.run("UPDATE users SET balance = balance - ? WHERE id = ?", svc.price, user.id);
    await db.run("COMMIT");
    const updated = await db.get("SELECT * FROM users WHERE id = ?", user.id);
    return res.json({ ok: true, balance: updated.balance });
  } catch (e) {
    await db.run("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "redeem failed" });
  }
});

// Купленные услуги
app.get("/api/user/purchases", async (req, res) => {
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });
  const db = await dbPromise;

  const rows = await db.all(
    `SELECT p.id, p.created_at, s.id AS service_id, s.title, s.partner, s.description, s.price
     FROM purchases p
     JOIN services s ON s.id = p.service_id
     WHERE p.user_id = ?
     ORDER BY p.id DESC`,
    user.id
  );

  return res.json({ items: rows });
});

// ==================== ADMIN (ОТКРЫТА ДЛЯ ВСЕХ) ====================

// Временная версия без проверки ролей
function requireAdmin(req, res, next) {
  next();
}

// Начислить бонусы
app.post("/api/admin/bonus", requireAdmin, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !Number.isInteger(amount)) {
    return res.status(400).json({ error: "phone and integer amount required" });
  }
  const db = await dbPromise;

  let u = await db.get("SELECT * FROM users WHERE phone = ?", phone);
  if (!u) {
    await db.run("INSERT INTO users (phone, balance) VALUES (?, 0)", phone);
    u = await db.get("SELECT * FROM users WHERE phone = ?", phone);
  }

  await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", amount, u.id);
  const updated = await db.get("SELECT * FROM users WHERE id = ?", u.id);

  return res.json({
    ok: true,
    user: { id: updated.id, phone: updated.phone, balance: updated.balance },
  });
});

// Добавить услугу
app.post("/api/admin/services", requireAdmin, async (req, res) => {
  const { title, partner, price, description } = req.body;
  if (!title || !Number.isInteger(price))
    return res.status(400).json({ error: "title and integer price required" });

  const db = await dbPromise;
  const result = await db.run(
    "INSERT INTO services (title, partner, price, description, active) VALUES (?, ?, ?, ?, 1)",
    title,
    partner || null,
    price,
    description || null
  );

  const row = await db.get("SELECT * FROM services WHERE id = ?", result.lastID);
  return res.json({ ok: true, service: row });
});

// Изменить услугу
app.patch("/api/admin/services/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, partner, price, description, active } = req.body;

  const db = await dbPromise;
  const existing = await db.get("SELECT * FROM services WHERE id = ?", id);
  if (!existing) return res.status(404).json({ error: "service not found" });

  const newTitle = title ?? existing.title;
  const newPartner = partner ?? existing.partner;
  const newPrice = Number.isInteger(price) ? price : existing.price;
  const newDesc = description ?? existing.description;
  const newActive = typeof active === "number" ? active : existing.active;

  await db.run(
    "UPDATE services SET title = ?, partner = ?, price = ?, description = ?, active = ? WHERE id = ?",
    newTitle,
    newPartner,
    newPrice,
    newDesc,
    newActive,
    id
  );

  const updated = await db.get("SELECT * FROM services WHERE id = ?", id);
  return res.json({ ok: true, service: updated });
});

// Все пользователи
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all(
    "SELECT id, tg_id, phone, balance, role, created_at FROM users ORDER BY id DESC"
  );
  return res.json({ users: rows });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
