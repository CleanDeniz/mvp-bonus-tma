import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";
import { authMiddleware } from "./telegramAuth.js";

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "https://mvp-bonus-tma-1.onrender.com";

const app = express();

// ===== CORS FIX (для Telegram и Render) =====
app.use((req, res, next) => {
  const allowedOrigins = [
    CLIENT_URL,
    "https://mvp-bonus-tma.onrender.com",
    "https://mvp-bonus-tma-1.onrender.com"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

// ===== AUTH (Telegram) =====
app.use(authMiddleware);

// ===== Пользовательская логика =====

// Получить или создать пользователя
async function getOrCreateUser(tg_id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE tg_id = ?", [String(tg_id)], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);

      db.run("INSERT INTO users (tg_id, balance, role) VALUES (?, 0, 'user')", [String(tg_id)], function (err2) {
        if (err2) return reject(err2);
        db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err3, newRow) => {
          if (err3) reject(err3);
          else resolve(newRow);
        });
      });
    });
  });
}

// Middleware: привязка пользователя
app.use(async (req, res, next) => {
  if (req.tgUser?.id) {
    try {
      const user = await getOrCreateUser(req.tgUser.id);
      req.userDb = user;
    } catch (e) {
      console.error("User sync error:", e);
    }
  }
  next();
});

// ===== Пользовательские роуты =====

// Инфо о текущем пользователе
app.get("/api/user/me", (req, res) => {
  res.json({ user: req.userDb || null, tgUser: req.tgUser || null });
});

// Сохранить телефон
app.post("/api/user/phone", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });

  try {
    const tg_id = String(req.tgUser.id);
    db.run(
      "UPDATE users SET phone = ? WHERE tg_id = ?",
      [phone, tg_id],
      function (err) {
        if (err) return res.status(500).json({ error: "db error" });
        db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id], (err2, row) => {
          if (err2) return res.status(500).json({ error: "db error" });
          res.json({ user: row });
        });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to set phone" });
  }
});

// Все услуги
app.get("/api/services", (req, res) => {
  db.all("SELECT * FROM services WHERE active = 1 ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: "db error" });
    res.json({ services: rows });
  });
});

// Купить услугу
app.post("/api/user/redeem", (req, res) => {
  const { serviceId } = req.body;
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });
  if (!serviceId) return res.status(400).json({ error: "serviceId required" });

  db.get("SELECT * FROM services WHERE id = ? AND active = 1", [serviceId], (err, svc) => {
    if (err || !svc) return res.status(404).json({ error: "service not found" });

    db.get("SELECT * FROM purchases WHERE user_id = ? AND service_id = ?", [user.id, svc.id], (err2, existing) => {
      if (existing) return res.status(409).json({ error: "already purchased" });
      if (user.balance < svc.price) return res.status(400).json({ error: "insufficient balance" });

      db.run("BEGIN TRANSACTION");
      db.run("INSERT INTO purchases (user_id, service_id) VALUES (?, ?)", [user.id, svc.id]);
      db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [svc.price, user.id]);
      db.run("COMMIT", err3 => {
        if (err3) return res.status(500).json({ error: "redeem failed" });
        res.json({ ok: true, balance: user.balance - svc.price });
      });
    });
  });
});

// Покупки
app.get("/api/user/purchases", (req, res) => {
  const user = req.userDb;
  if (!user) return res.status(401).json({ error: "no user" });
  db.all(
    `SELECT p.id, p.created_at, s.title, s.price, s.partner
     FROM purchases p JOIN services s ON p.service_id = s.id
     WHERE p.user_id = ? ORDER BY p.id DESC`,
    [user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db error" });
      res.json({ items: rows });
    }
  );
});

// ===== Админ (временно открыт всем для MVP) =====

// Начислить бонус
app.post("/api/admin/bonus", (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !Number.isInteger(Number(amount))) {
    return res.status(400).json({ error: "phone and integer amount required" });
  }

  db.get("SELECT * FROM users WHERE phone = ?", [phone], (err, user) => {
    if (err) return res.status(500).json({ error: "db error" });
    if (!user) {
      db.run("INSERT INTO users (phone, balance, role) VALUES (?, ?, 'user')", [phone, Number(amount)], function (err2) {
        if (err2) return res.status(500).json({ error: "db insert error" });
        db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err3, newUser) => {
          if (err3) return res.status(500).json({ error: "db error" });
          res.json({ ok: true, user: newUser });
        });
      });
    } else {
      db.run("UPDATE users SET balance = balance + ? WHERE phone = ?", [Number(amount), phone], err2 => {
        if (err2) return res.status(500).json({ error: "db update error" });
        db.get("SELECT * FROM users WHERE phone = ?", [phone], (err3, updated) => {
          if (err3) return res.status(500).json({ error: "db error" });
          res.json({ ok: true, user: updated });
        });
      });
    }
  });
});

// Добавить услугу
app.post("/api/admin/services", (req, res) => {
  const { title, partner, price, description } = req.body;
  if (!title || !price) return res.status(400).json({ error: "title and price required" });

  db.run(
    "INSERT INTO services (title, partner, price, description, active) VALUES (?, ?, ?, ?, 1)",
    [title, partner || "", Number(price), description || ""],
    function (err) {
      if (err) return res.status(500).json({ error: "db error" });
      db.get("SELECT * FROM services WHERE id = ?", [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: "db error" });
        res.json({ ok: true, service: row });
      });
    }
  );
});

// Изменить статус услуги
app.patch("/api/admin/services/:id", (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.run("UPDATE services SET active = ? WHERE id = ?", [active, id], err => {
    if (err) return res.status(500).json({ error: "db error" });
    db.get("SELECT * FROM services WHERE id = ?", [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: "db error" });
      res.json({ ok: true, service: row });
    });
  });
});

// Список пользователей
app.get("/api/admin/users", (req, res) => {
  db.all("SELECT id, tg_id, phone, balance, role FROM users ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: "db error" });
    res.json({ users: rows });
  });
});

// ===== Старт сервера =====
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
