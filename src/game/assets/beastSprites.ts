import type { BakedCharacterBuffers } from '@ulf/assets/characterBakery';
import type { CharacterVisualRecipe } from '@ulf/rpg/characterData';

export function isWolfRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const title = (recipe.title ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return (
    id.startsWith('enemy_wilk') ||
    id.startsWith('wolf_') ||
    title.includes('wataha') ||
    name.includes('wilk') ||
    name.includes('basior')
  );
}

function setPixel(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  px: number,
  py: number,
  r: number,
  g: number,
  b: number,
  a: number,
  nx = 0,
  ny = -0.35,
  roughness = 205
): void {
  const ix = Math.round(px);
  const iy = Math.round(py);
  if (ix < 0 || iy < 0 || ix >= sheetW || iy >= sheetH) return;
  const idx = (iy * sheetW + ix) * 4;
  if (a < 255 && albedo[idx + 3] > 0) {
    const srcA = a / 255;
    const dstA = 1 - srcA;
    albedo[idx] = Math.round(r * srcA + albedo[idx] * dstA);
    albedo[idx + 1] = Math.round(g * srcA + albedo[idx + 1] * dstA);
    albedo[idx + 2] = Math.round(b * srcA + albedo[idx + 2] * dstA);
    albedo[idx + 3] = Math.min(255, Math.round(a + albedo[idx + 3] * dstA));
    return;
  }
  albedo[idx] = r;
  albedo[idx + 1] = g;
  albedo[idx + 2] = b;
  albedo[idx + 3] = a;

  normalMat[idx] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
  normalMat[idx + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
  normalMat[idx + 2] = roughness;
  normalMat[idx + 3] = 255;
}

function fillEllipse(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  r: number,
  g: number,
  b: number,
  a = 255
): void {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / Math.max(0.5, rx);
      const dy = (y - cy) / Math.max(0.5, ry);
      const d2 = dx * dx + dy * dy;
      if (d2 <= 1.0) {
        const shade = 1.06 - dy * 0.16 - d2 * 0.12;
        setPixel(
          albedo,
          normalMat,
          sheetW,
          sheetH,
          x,
          y,
          Math.max(0, Math.min(255, Math.round(r * shade))),
          Math.max(0, Math.min(255, Math.round(g * shade))),
          Math.max(0, Math.min(255, Math.round(b * shade))),
          a,
          dx * 0.65,
          dy * 0.65 - 0.2,
          208
        );
      }
    }
  }
}

function fillSegment(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t,
      radius,
      radius,
      r,
      g,
      b
    );
  }
}

/**
 * Generates an 8-direction × 4-frame 2.5D quadruped wolf sprite sheet compatible with
 * ulfRPG's `BakedCharacterBuffers` pipeline.
 */
export function bakeWolfCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const frameWidth = 64;
  const frameHeight = 96;
  const directions = 8;
  const framesPerDirection = 4;
  const sheetWidth = frameWidth * framesPerDirection;
  const sheetHeight = frameHeight * directions;

  const albedoRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);

  const isAlpha =
    recipe.id === 'enemy_wilk_1' || (recipe.name ?? '').toLowerCase().includes('basior');
  const furMain = isAlpha ? { r: 62, g: 64, b: 70 } : { r: 108, g: 112, b: 118 };
  const furDark = isAlpha ? { r: 36, g: 38, b: 44 } : { r: 68, g: 72, b: 78 };
  const furBelly = isAlpha ? { r: 96, g: 94, b: 92 } : { r: 156, g: 152, b: 144 };

  for (let dir = 0; dir < directions; dir++) {
    // Match characterBakery.ts direction convention: dir=0 is North (-Y), dir=2 is East (+X), dir=4 is South (+Y facing camera), dir=6 is West (-X)
    const ang = (dir / 8) * Math.PI * 2;
    const fx = Math.sin(ang);
    const fy = -Math.cos(ang) * 0.58; // isometric foreshortening

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 78;
      const stride = frame === 1 ? 3.2 : frame === 3 ? -3.2 : 0;
      const bob = frame === 1 || frame === 3 ? -1.5 : 0;

      // Ground contact shadow
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, groundY + 1, 16, 7, 10, 12, 16, 115);

      const torsoY = groundY - 14 + bob;
      const shoulderX = cx + fx * 7.5;
      const shoulderY = torsoY + fy * 5.5;
      const hipX = cx - fx * 8.5;
      const hipY = torsoY - fy * 6.0;

      // Bushy tail behind hips
      const tailTipX = hipX - fx * 11 - fy * 2;
      const tailTipY = hipY - fy * 6 + 3;
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX,
        hipY - 1,
        tailTipX,
        tailTipY,
        3.2,
        furDark.r,
        furDark.g,
        furDark.b
      );

      // Far-side legs
      const perpX = -fy * 0.75;
      const perpY = fx * 0.35;
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX - perpX * 4,
        hipY - perpY * 4,
        hipX - perpX * 4 - fx * stride,
        groundY - 1,
        2.3,
        furDark.r,
        furDark.g,
        furDark.b
      );
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderX - perpX * 4,
        shoulderY - perpY * 4,
        shoulderX - perpX * 4 + fx * stride,
        groundY - 1,
        2.3,
        furDark.r,
        furDark.g,
        furDark.b
      );

      // Torso (spine, ribcage & lighter underbelly)
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX,
        hipY + 2,
        shoulderX,
        shoulderY + 2,
        6.2,
        furBelly.r,
        furBelly.g,
        furBelly.b
      );
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX,
        hipY,
        shoulderX,
        shoulderY,
        7.2,
        furMain.r,
        furMain.g,
        furMain.b
      );
      // Dark dorsal stripe
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX,
        hipY - 3,
        shoulderX,
        shoulderY - 3,
        3.6,
        furDark.r,
        furDark.g,
        furDark.b
      );

      // Near-side legs
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        hipX + perpX * 4,
        hipY + perpY * 4,
        hipX + perpX * 4 + fx * stride,
        groundY,
        2.5,
        furMain.r,
        furMain.g,
        furMain.b
      );
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderX + perpX * 4,
        shoulderY + perpY * 4,
        shoulderX + perpX * 4 - fx * stride,
        groundY,
        2.5,
        furMain.r,
        furMain.g,
        furMain.b
      );

      // Head, pointed ears, elongated snout & glowing amber eyes
      const headX = shoulderX + fx * 6.5;
      const headY = shoulderY + fy * 4.5 - 5.5;
      fillEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY,
        5.8,
        5.0,
        furMain.r,
        furMain.g,
        furMain.b
      );

      // Pointed wolf ears
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX - 3,
        headY - 3,
        headX - 4.5,
        headY - 8.5,
        1.7,
        furDark.r,
        furDark.g,
        furDark.b
      );
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX + 3,
        headY - 3,
        headX + 4.5,
        headY - 8.5,
        1.7,
        furDark.r,
        furDark.g,
        furDark.b
      );

      // Elongated snout & nose
      const snoutX = headX + fx * 5.8;
      const snoutY = headY + fy * 3.8 + 1.2;
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY + 0.5,
        snoutX,
        snoutY,
        2.6,
        furBelly.r,
        furBelly.g,
        furBelly.b
      );
      fillEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        snoutX + fx * 1.2,
        snoutY + fy * 0.8,
        1.5,
        1.3,
        22,
        20,
        22
      );

      // Amber wolf eyes (visible when not facing directly North)
      if (fy > -0.35) {
        const eyeBaseX = headX + fx * 2.2;
        const eyeBaseY = headY + fy * 1.6 - 1.2;
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeBaseX - 1.6, eyeBaseY, 245, 195, 65, 255);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeBaseX + 1.6, eyeBaseY, 245, 195, 65, 255);
      }
    }
  }

  return {
    recipeHash: `wolf_${recipe.id}_${isAlpha ? 'alpha' : 'pack'}`,
    frameWidth,
    frameHeight,
    directions,
    framesPerDirection,
    sheetWidth,
    sheetHeight,
    albedoRGBA,
    normalMaterialRGBA
  };
}
