import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dbPromise from "./db.js";
import { authMiddleware } from "./telegramAuth.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const CLIENT_URL = process.env.CLIENT_URL || "https://mvp-bonus-tma-1.onrender.com";

const app = express();

// --- CORS FIX (Render + Telegram WebView) ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
// --- END FIX ---

app.use(express.json());
app.use(authMiddleware);

// Middleware: создаём пользователя при первом заходе
app.use(async (req, res, next) => {
  if (req.tgUser?.id) {
    const db = await dbPromise;
    let user = await db.get("SELECT * FROM users WHERE tg_id = ?", String(req.tgUser.id));
    if (!user) {
      await db.run("INSERT INTO users (tg_id, balance, role) VALUES (?, 0, 'admin')", String(req.tgUser.id));
      user = await db.get("SELECT * FROM users WHERE tg_id = ?", String(req.tgUser.id));
    }
    req.userDb = user;
  }
  next();
});

// ==================== ПОЛЬЗОВАТЕЛИ ====================
app.get("/api/user/me", (req, res) => {
  res.json({ user: req.userDb || null, tgUser: req.tgUser || null });
});

app.get("/api/services", async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM services WHERE active = 1 ORDER BY id DESC");
  res.json({ services: rows });
});

// ==================== АДМИН (для всех доступен временно) ====================

// Пропускаем всех в админ-панель
function requireAdmin(req, res, next) {
  next(); // 👈 теперь не проверяем ID
}

// Начислить бонусы
app.post("/api/admin/bonus", requireAdmin, async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !Number.isInteger(amount))
    return res.status(400).json({ error: "phone and integer amount required" });

  const db = await dbPromise;
  let user = await db.get("SELECT * FROM users WHERE phone = ?", phone);
  if (!user) {
    await db.run("INSERT INTO users (phone, balance) VALUES (?, 0)", phone);
    user = await db.get("SELECT * FROM users WHERE phone = ?", phone);
  }
  await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", amount, user.id);
  const updated = await db.get("SELECT * FROM users WHERE id = ?", user.id);
  res.json({ ok: true, user: updated });
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
  res.json({ ok: true, service: row });
});

// Изменить услугу
app.patch("/api/admin/services/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, partner, price, description, active } = req.body;
  const db = await dbPromise;
  const existing = await db.get("SELECT * FROM services WHERE id = ?", id);
  if (!existing) return res.status(404).json({ error: "service not found" });

  await db.run(
    "UPDATE services SET title=?, partner=?, price=?, description=?, active=? WHERE id=?",
    title ?? existing.title,
    partner ?? existing.partner,
    Number.isInteger(price) ? price : existing.price,
    description ?? existing.description,
    typeof active === "number" ? active : existing.active,
    id
  );
  const updated = await db.get("SELECT * FROM services WHERE id = ?", id);
  res.json({ ok: true, service: updated });
});

// Список пользователей
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT id, tg_id, phone, balance, role, created_at FROM users ORDER BY id DESC");
  res.json({ users: rows });
});

// ==================== СТАРТ ====================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
