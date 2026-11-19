import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  base: '/jrpg/walk/',
  build: {
    outDir: fileURLToPath(new URL('../frontend/jrpg/walk/', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    sourcemap: false
  },
  server: { host: '127.0.0.1' }
});
