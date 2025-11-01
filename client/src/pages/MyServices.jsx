import React, { useEffect, useState } from "react";
import { apiGET } from "../api.js";

export default function MyServices() {
  const [items, setItems] = useState([]);

  async function load() {
    const res = await apiGET("/api/user/purchases");
    setItems(res.items || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      {items.length === 0 && <div className="card">Пока пусто. Купленные услуги появятся здесь.</div>}
      {items.map(i => (
        <div className="card" key={i.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>{i.title}</div>
            <span className="badge">{i.price} б.</span>
          </div>
          {i.partner && <div className="label">Партнёр: {i.partner}</div>}
          {i.description && <div style={{ marginTop: 6 }}>{i.description}</div>}
          <div className="label" style={{ marginTop: 8 }}>Получено: {new Date(i.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
