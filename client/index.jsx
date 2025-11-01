import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Telegram WebApp адаптация (чтобы сразу разворачивалось и выглядело корректно)
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.expand();
  tg.ready();
  tg.setHeaderColor("bg_color");
  tg.setBackgroundColor("#111111");
}

// Рендерим приложение
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
