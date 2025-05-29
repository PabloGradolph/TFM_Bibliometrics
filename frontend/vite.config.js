import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './',
  build: {
    outDir: '../static/js',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, './src/main.js'),
      output: {
        entryFileNames: 'bundle.js'
      }
    }
  }
});
