import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: process.env.VITE_DEV_PORT ? parseInt(process.env.VITE_DEV_PORT) : 5173,
    // HMR конфигурация для разных сценариев
    hmr: process.env.NODE_ENV === 'production' 
      ? {
          // Production: используем домен с single-port (1031)
          host: 'teacher.windexs.ru',
          port: 1031,
          protocol: 'wss',
        }
      : true, // Development: используем default HMR
    proxy: {
      '/api': {
        // Production: proxy через Nginx на домен
        // Single-port: proxy на localhost:1031
        // Development: proxy на localhost:1038
        target: process.env.NODE_ENV === 'production'
          ? (process.env.PROXY_PORT === '1031'
              ? 'http://localhost:1031'  // Single-port режим (development)
              : 'https://teacher.windexs.ru')  // Normal production
          : `http://localhost:${process.env.PROXY_PORT || 3001}`, // Development: используем 3001 для backend server
        changeOrigin: true,
        secure: process.env.NODE_ENV === 'production'
          ? (process.env.PROXY_PORT === '1031' ? false : true)  // HTTP для single-port, HTTPS для normal
          : false,
      },
    },
  },
  preview: {
    host: "::",
    port: process.env.PORT ? parseInt(process.env.PORT) : 1035,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
