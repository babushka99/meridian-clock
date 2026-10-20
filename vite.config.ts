import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Output is a ready-to-load unpacked extension: dist/world-time-ruler/manifest.json.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/world-time-ruler',
    emptyOutDir: true,
    target: 'chrome120',
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { index: 'index.html', background: 'src/background.ts' },
      output: {
        entryFileNames: c => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
