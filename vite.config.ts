import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: path.resolve(__dirname, '../ulfRPG/public'),
  resolve: {
    alias: {
      '@ulf': path.resolve(__dirname, '../ulfRPG/src'),
      'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js')
    }
  },
  server: {
    port: 5174,
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  },
  build: {
    target: 'es2022'
  }
});
