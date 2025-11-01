import React, { useState } from "react";
import { apiPOST } from "../api.js";

export default function Home({ me, onUpdated }) {
  const [phone, setPhone] = useState(me.phone || "");

  async function savePhone() {
    if (!phone) return;
    try {
      await apiPOST("/api/user/phone", { phone });
      await onUpdated();
    } catch (e) {
      alert("Не удалось сохранить телефон: " + e);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="label">Ваш баланс</div>
        <div style={{ fontSize: 32, fontWeight: 800 }}>{me.balance} бонусов</div>
      </div>

      <div className="card">
        <div className="label">Телефон для начислений</div>
        <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7..." />
        <div style={{ height: 8 }} />
        <button className="btn" onClick={savePhone}>Сохранить телефон</button>
        <div className="label" style={{ marginTop: 6 }}>
          Бонусы будут начисляться по этому номеру.
        </div>
      </div>
    </div>
  );
}
