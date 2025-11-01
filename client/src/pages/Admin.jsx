import React, { useEffect, useState } from "react";
import { apiGET, apiPATCH, apiPOST } from "../api.js";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [svc, setSvc] = useState({ title: "", partner: "", price: 0, description: "" });
  const [bonus, setBonus] = useState({ phone: "", amount: 0, note: "" });
  const [services, setServices] = useState([]);

  async function load() {
    const u = await apiGET("/api/admin/users");
    setUsers(u.users || []);
    const s = await apiGET("/api/services");
    setServices(s.services || []);
  }
  useEffect(() => { load(); }, []);

  async function createService() {
    const price = parseInt(svc.price, 10) || 0;
    const res = await apiPOST("/api/admin/services", { ...svc, price });
    setSvc({ title: "", partner: "", price: 0, description: "" });
    await load();
    alert("Услуга создана");
  }

  async function toggleServiceActive(id, active) {
    await apiPATCH(`/api/admin/services/${id}`, { active });
    await load();
  }

  async function addBonus() {
    const amount = parseInt(bonus.amount, 10) || 0;
    const res = await apiPOST("/api/admin/bonus", { phone: bonus.phone, amount, note: bonus.note });
    setBonus({ phone: "", amount: 0, note: "" });
    await load();
    alert(`Начислено. Баланс: ${res.user.balance}`);
  }

  return (
    <div className="grid">
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Начисление бонусов (по телефону)</div>
        <label className="label">Телефон</label>
        <input className="input" value={bonus.phone} onChange={e => setBonus({ ...bonus, phone: e.target.value })} placeholder="+7..." />
        <label className="label" style={{ marginTop: 8 }}>Сумма</label>
        <input className="input" type="number" value={bonus.amount} onChange={e => setBonus({ ...bonus, amount: e.target.value })} />
        <label className="label" style={{ marginTop: 8 }}>Заметка (необязательно)</label>
        <input className="input" value={bonus.note} onChange={e => setBonus({ ...bonus, note: e.target.value })} placeholder="за рекомендацию" />
        <div style={{ height: 8 }} />
        <button className="btn primary" onClick={addBonus}>Начислить</button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Создать услугу</div>
        <label className="label">Название</label>
        <input className="input" value={svc.title} onChange={e => setSvc({ ...svc, title: e.target.value })} />
        <label className="label" style={{ marginTop: 8 }}>Партнёр</label>
        <input className="input" value={svc.partner} onChange={e => setSvc({ ...svc, partner: e.target.value })} />
        <label className="label" style={{ marginTop: 8 }}>Цена (бонусы)</label>
        <input className="input" type="number" value={svc.price} onChange={e => setSvc({ ...svc, price: e.target.value })} />
        <label className="label" style={{ marginTop: 8 }}>Описание</label>
        <textarea className="input" rows="3" value={svc.description} onChange={e => setSvc({ ...svc, description: e.target.value })}></textarea>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={createService}>Создать</button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Активные услуги</div>
        {services.length === 0 && <div className="label">Пусто</div>}
        {services.map(s => (
          <div className="row" key={s.id} style={{ justifyContent: "space-between", width: "100%", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{s.title}</div>
              <div className="label">Цена: {s.price} б. {s.partner ? ` • ${s.partner}` : ""}</div>
            </div>
            <button className="btn" onClick={() => toggleServiceActive(s.id, s.active ? 0 : 1)}>
              {s.active ? "Скрыть" : "Опубликовать"}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Пользователи</div>
        {users.map(u => (
          <div className="row" key={u.id} style={{ justifyContent: "space-between", width: "100%", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div>#{u.id} — {u.phone || "без телефона"}</div>
              <div className="label">tg_id: {u.tg_id || "—"} • баланс: {u.balance}</div>
            </div>
            <span className="badge">{u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
