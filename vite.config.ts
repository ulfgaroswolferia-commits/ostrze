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
    // Pixi is 571 kB raw / 165 kB gzip; all application and data chunks are below 500 kB.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (normalizedId.includes('/node_modules/pixi.js/')) {
            return 'vendor-pixi';
          }
          if (
            normalizedId.includes('/engine/src/') &&
            !normalizedId.endsWith('/engine/src/ui/inspectorPanel.ts')
          ) {
            if (normalizedId.includes('/engine/src/renderer/')) {
              return 'engine-renderer';
            }
            return 'engine-core';
          }
          if (normalizedId.includes('/origin/data/art/')) {
            const assetName = normalizedId.split('/').pop()?.split('?')[0] ?? '';
            let hash = 0;
            for (const character of assetName) {
              hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
            }
            return `ostrze-art-${hash % 4}`;
          }
          if (normalizedId.includes('/origin/data/travel.json')) {
            return 'ostrze-travel-data';
          }
          if (normalizedId.includes('/origin/data/dialogues/')) {
            return 'ostrze-dialogue-data';
          }
          if (normalizedId.includes('/origin/data/')) {
            return 'ostrze-rules-data';
          }
          return undefined;
        }
      }
    }
  }
});
