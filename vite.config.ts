import { defineConfig } from 'vite';

export default defineConfig({
  base: '/nagi-player/',
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
});
