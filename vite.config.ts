import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  publicDir: path.resolve(rootDir, 'engine/public'),
  resolve: {
    alias: {
      '@ulf': path.resolve(rootDir, 'engine/src'),
      '@ostrze': path.resolve(rootDir, 'src'),
      'pixi.js': path.resolve(rootDir, 'node_modules/pixi.js')
    }
  },
  server: {
    port: 5174,
    host: true
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules\\pixi.js')) {
            return 'vendor-pixi';
          }
          return undefined;
        }
      }
    }
  }
});
