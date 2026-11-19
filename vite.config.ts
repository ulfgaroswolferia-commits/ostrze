import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function ostrzeEnginePatchesPlugin(): Plugin {
  return {
    name: 'ostrze-engine-patches',
    enforce: 'pre',
    transform(code, id) {
      const norm = id.replace(/\\/g, '/');
      if (norm.endsWith('/assets/characterBakery.ts')) {
        const injectedImport =
          "import { bakeWolfCharacterBuffers, isWolfRecipe } from '@ostrze/game/assets/beastSprites';\n";
        const injectedBody = code
          .replace(
            'export function computeCharacterRecipeHash(recipe: CharacterVisualRecipe): string {',
            "export function computeCharacterRecipeHash(recipe: CharacterVisualRecipe): string {\n  if (isWolfRecipe(recipe)) return 'wolf|' + recipe.id + '|' + recipe.name;"
          )
          .replace(
            'export function bakeCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {',
            'export function bakeCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {\n  if (isWolfRecipe(recipe)) return bakeWolfCharacterBuffers(recipe);'
          );
        return {
          code: injectedImport + injectedBody,
          map: null
        };
      }
      return null;
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [ostrzeEnginePatchesPlugin()],
  publicDir: path.resolve(__dirname, 'engine/public'),
  resolve: {
    alias: {
      '@ulf': path.resolve(__dirname, 'engine/src'),
      '@ostrze': path.resolve(__dirname, 'src'),
      'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js')
    }
  },
  server: {
    port: 5174,
    host: true
  },
  build: {
    target: 'es2022'
  }
});
