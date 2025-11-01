import React, { useEffect, useState } from "react";
import { apiGET, apiPOST } from "../api.js";

export default function Catalog({ onUpdated }) {
  const [items, setItems] = useState([]);

  async function load() {
    const res = await apiGET("/api/services");
    setItems(res.services || []);
  }

  useEffect(() => { load(); }, []);

  async function redeem(id) {
    if (!confirm("Купить услугу за бонусы?")) return;
    try {
      await apiPOST("/api/user/redeem", { serviceId: id });
      await onUpdated();
      await load();
      alert("Готово. Услуга добавлена в «Мои услуги».");
    } catch (e) {
      alert("Не удалось купить: " + (e.message || e));
    }
  }

  return (
    <div>
      {items.length === 0 && <div className="card">Пока нет активных услуг.</div>}
      {items.map(s => (
        <div className="card" key={s.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>{s.title}</div>
            <span className="badge">{s.price} б.</span>
          </div>
          {s.partner && <div className="label">Партнёр: {s.partner}</div>}
          {s.description && <div style={{ marginTop: 6 }}>{s.description}</div>}
          <div className="sep"></div>
          <button className="btn primary" onClick={() => redeem(s.id)}>Купить за бонусы</button>
        </div>
      ))}
    </div>
  );
}
