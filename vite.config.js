import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    headers: {
      // Required for SharedArrayBuffer if we run complex multithreading, 
      // but good practice for WebAssembly performance
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  base: './',
});
