import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Local frontend work should use the local API by default. Override this
  // only when intentionally developing against another backend.
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: { proxy: { '/api': { target: proxyTarget, changeOrigin: true } } },
  };
});
