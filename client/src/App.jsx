import React, { useEffect, useState } from "react";
import { apiGET } from "./api.js";
import Home from "./pages/Home.jsx";
import Catalog from "./pages/Catalog.jsx";
import MyServices from "./pages/MyServices.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("home");

  useEffect(() => {
    window.Telegram?.WebApp?.expand?.();
    loadMe();
  }, []);

  async function loadMe() {
    try {
      const res = await apiGET("/api/user/me");
      setMe(res.user ? { ...res.user, tg: res.tgUser } : { error: "no-user" });
    } catch (e) {
      console.warn("Ошибка загрузки пользователя:", e);
      setMe({ error: "api-failed" });
    }
  }

  const tabs = [
    { key: "home", title: "Баланс" },
    { key: "catalog", title: "Каталог" },
    { key: "my", title: "Мои услуги" },
    { key: "admin", title: "Админ (демо)" } // 👈 всегда доступно
  ];

  return (
    <div>
      {/* === HEADER === */}
      <div className="header">
        <div style={{ fontWeight: 700 }}>Bonus MVP</div>
        <div className="nav">
          {tabs.map(t => (
            <button
              key={t.key}
              className={"btn" + (tab === t.key ? " primary" : "")}
              onClick={() => setTab(t.key)}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* === CONTENT === */}
      <div className="container">
        {!me && <div className="card">Загрузка...</div>}
        {me && tab === "home" && <Home me={me} onUpdated={loadMe} />}
        {me && tab === "catalog" && <Catalog me={me} onUpdated={loadMe} />}
        {me && tab === "my" && <MyServices />}
        {tab === "admin" && <Admin />} {/* 👈 теперь отображается всегда */}
      </div>
    </div>
  );
}
