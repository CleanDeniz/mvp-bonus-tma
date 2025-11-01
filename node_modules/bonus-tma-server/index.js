import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "https://mvp-bonus-tma-1.onrender.com";

const app = express();

// ========== CORS FIX ==========
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CLIENT_URL);
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ========== ВРЕМЕННОЕ "ХРАНИЛИЩЕ" ==========
let users = [
  { id: 1, username: "Demo Admin", balance: 5000, role: "admin", phone: "79990001122" },
  { id: 2, username: "User", balance: 1000, role: "user", phone: "78880002233" }
];

let services = [
  { id: 1, title: "Абонемент в спортзал", price: 300, description: "1 месяц" },
  { id: 2, title: "Скидка на одежду", price: 150, description: "−20% на весь ассортимент" }
];

// ========== ROUTES ==========

// проверка связи
app.get("/api/ping", (_, res) => res.json({ ok: true, message: "pong" }));

// "авторизация"
app.get("/api/user/me", (_, res) => {
  const demo = users[0]; // всегда возвращаем админа
  res.json({ user: demo, tgUser: { id: demo.id, username: demo.username }, demo: true });
});

// все услуги
app.get("/api/services", (_, res) => res.json({ services }));

// покупка услуги
app.post("/api/user/redeem", (req, res) => {
  const { serviceId } = req.body;
  const user = users[1]; // демо-пользователь
  const svc = services.find(s => s.id === Number(serviceId));
  if (!svc) return res.status(404).json({ error: "service not found" });
  if (user.balance < svc.price)
    return res.status(400).json({ error: "insufficient balance" });
  user.balance -= svc.price;
  res.json({ ok: true, balance: user.balance });
});

// ====================
//      АДМИН
// ====================

// получить всех пользователей
app.get("/api/admin/users", (_, res) => res.json({ users }));

// добавить услугу
app.post("/api/admin/services", (req, res) => {
  const { title, price, description } = req.body;
  if (!title || !price) return res.status(400).json({ error: "title and price required" });
  const newSvc = {
    id: services.length + 1,
    title,
    price: Number(price),
    description: description || ""
  };
  services.push(newSvc);
  res.json({ ok: true, service: newSvc });
});

// начислить бонусы
app.post("/api/admin/bonus", (req, res) => {
  const { phone, amount } = req.body;
  const user = users.find(u => u.phone === phone);
  if (!user) return res.status(404).json({ error: "user not found" });
  user.balance += Number(amount);
  res.json({ ok: true, user });
});

// ====================
//      SERVER
// ====================
app.listen(PORT, () => {
  console.log(`✅ DEMO Server running on port ${PORT}`);
  console.log(`🌍 Allowed origin: ${CLIENT_URL}`);
});
