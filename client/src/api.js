const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function initDataHeader() {
  const initData = window?.Telegram?.WebApp?.initData || "";
  return { "x-telegram-init-data": initData };
}

export async function apiGET(path) {
  const res = await fetch(API_BASE + path, { headers: initDataHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPOST(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...initDataHeader() },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPATCH(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...initDataHeader() },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
