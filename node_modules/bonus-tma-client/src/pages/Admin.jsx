import React, { useEffect, useState } from "react";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newService, setNewService] = useState({ title: "", price: "", description: "" });

  const API = "https://mvp-bonus-tma-server.onrender.com";

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, servicesRes] = await Promise.all([
          fetch(`${API}/api/admin/users`).then(r => r.json()),
          fetch(`${API}/api/services`).then(r => r.json())
        ]);
        setUsers(usersRes.users || []);
        setServices(servicesRes.services || []);
      } catch (e) {
        console.error("Ошибка загрузки данных:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function addService() {
    try {
      const res = await fetch(`${API}/api/admin/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newService.title,
          price: parseInt(newService.price, 10),
          description: newService.description
        })
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ Услуга добавлена!");
        setServices(prev => [data.service, ...prev]);
        setNewService({ title: "", price: "", description: "" });
      } else alert("Ошибка: " + (data.error || "неизвестная"));
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return <div className="text-center mt-8 text-gray-400">Загрузка данных...</div>;

  return (
    <div className="p-4 text-white font-sans bg-[#121212] min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-purple-400">Админ панель (демо-доступ)</h1>

      {/* === Добавление услуги === */}
      <div className="mb-8 border border-gray-700 rounded-xl p-4">
        <h2 className="text-lg mb-2">Добавить услугу</h2>
        <input
          className="block w-full mb-2 p-2 bg-[#1e1e1e] rounded"
          placeholder="Название"
          value={newService.title}
          onChange={e => setNewService({ ...newService, title: e.target.value })}
        />
        <input
          className="block w-full mb-2 p-2 bg-[#1e1e1e] rounded"
          placeholder="Цена"
          type="number"
          value={newService.price}
          onChange={e => setNewService({ ...newService, price: e.target.value })}
        />
        <textarea
          className="block w-full mb-2 p-2 bg-[#1e1e1e] rounded"
          placeholder="Описание"
          value={newService.description}
          onChange={e => setNewService({ ...newService, description: e.target.value })}
        />
        <button
          onClick={addService}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold"
        >
          Добавить
        </button>
      </div>

      {/* === Таблица услуг === */}
      <h2 className="text-lg mb-2">Все услуги</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse border border-gray-700 text-sm">
          <thead>
            <tr className="bg-[#1e1e1e] text-left">
              <th className="p-2 border border-gray-700">ID</th>
              <th className="p-2 border border-gray-700">Название</th>
              <th className="p-2 border border-gray-700">Цена</th>
              <th className="p-2 border border-gray-700">Описание</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id}>
                <td className="p-2 border border-gray-700">{s.id}</td>
                <td className="p-2 border border-gray-700">{s.title}</td>
                <td className="p-2 border border-gray-700">{s.price}</td>
                <td className="p-2 border border-gray-700">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === Список пользователей === */}
      <h2 className="text-lg mb-2">Пользователи</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-700 text-sm">
          <thead>
            <tr className="bg-[#1e1e1e] text-left">
              <th className="p-2 border border-gray-700">ID</th>
              <th className="p-2 border border-gray-700">Телеграм</th>
              <th className="p-2 border border-gray-700">Телефон</th>
              <th className="p-2 border border-gray-700">Баланс</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-2 border border-gray-700">{u.id}</td>
                <td className="p-2 border border-gray-700">{u.tg_id}</td>
                <td className="p-2 border border-gray-700">{u.phone}</td>
                <td className="p-2 border border-gray-700">{u.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
