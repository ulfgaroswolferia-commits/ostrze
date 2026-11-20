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
      if (norm.endsWith('/renderer/isoSceneView.ts')) {
        const injectedImport =
          "import { getPropVisualTransform } from '@ostrze/game/assets/buildingScaling';\n";
        const injectedBody = code
          .replace(
            'const scr = gridToScreen(fp.rx + 0.5, fp.ry + 0.5, prop.z);',
            `const vt = getPropVisualTransform(prop);
      const scr = vt.centerOnFootprint
        ? gridToScreen(fp.rx + fp.width * 0.5, fp.ry + fp.height * 0.5, prop.z)
        : gridToScreen(fp.rx + 0.5, fp.ry + 0.5, prop.z);`
          )
          .replace(
            'const baseRx = Math.max(16, (fp.width + fp.height) * 14);',
            'const baseRx = Math.max(16, (fp.width + fp.height) * 14 * vt.aoScale);'
          )
          .replace(
            'const baseRy = Math.max(8, (fp.width + fp.height) * 7);',
            'const baseRy = Math.max(8, (fp.width + fp.height) * 7 * vt.aoScale);'
          )
          .replace(
            'sp.position.set(scr.x, scr.y);',
            'sp.position.set(scr.x, scr.y + vt.offsetY);\n          if (vt.scaleX !== 1 || vt.scaleY !== 1) {\n            sp.scale.set(vt.scaleX, vt.scaleY);\n          }'
          )
          .replace(
            "'.top-bar button, .hero-card, .chronicle-log, .combat-top-banner, .combat-tactical-bar, .combat-live-log, .inventory-drawer, .inspector-card, .inspector-expand-btn, .dialogue-modal'",
            "'.top-bar button, .hero-card, .chronicle-log.expanded, .chronicle-log .chronicle-toggle-btn, .chronicle-log .combat-tab-btn, .chronicle-log .combat-report-tag-btn, .combat-top-banner, .combat-tactical-bar, .combat-live-log, .inventory-drawer, .inspector-card, .inspector-expand-btn, .dialogue-modal'"
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
