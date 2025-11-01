export default {
  server: {
    port: 5173,
    allowedHosts: [
      // Разрешаем ngrok-домен
      "ira-penecontemporaneous-don.ngrok-free.dev"
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        headers: {
          "ngrok-skip-browser-warning": "true"
        }
      }
    }
  },
  preview: {
    port: 5173
  }
};
