import type { BakedCharacterBuffers } from '@ulf/assets/characterBakery';
import type { CharacterVisualRecipe } from '@ulf/rpg/characterData';

export function isWolfRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const title = (recipe.title ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return (
    id.includes('wilk') ||
    id.startsWith('wolf_') ||
    title.includes('wataha') ||
    name.includes('wilk') ||
    name.includes('basior')
  );
}

export function isDogRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return id.startsWith('npc_pies_burek') || name.includes('burek');
}

export function isBoarRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return id.includes('dzik') || name.includes('dzik');
}

export function isViperRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return (
    id.includes('zmija') ||
    id.includes('viper') ||
    name.includes('żmij') ||
    name.includes('zmij')
  );
}

export function isBlednikRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return id.includes('blednik') || name.includes('błędnik') || name.includes('blednik');
}

export function isSkrzatRecipe(recipe: { id?: string; name?: string; title?: string }): boolean {
  const id = (recipe.id ?? '').toLowerCase();
  const name = (recipe.name ?? '').toLowerCase();
  return (
    id.includes('skrzat') ||
    name.includes('skrzat') ||
    name.includes('chochlik')
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

function recolorCanineFur(buffers: BakedCharacterBuffers, redScale: number, greenScale: number, blueScale: number): void {
  for (let i = 0; i < buffers.albedoRGBA.length; i += 4) {
    if (buffers.albedoRGBA[i + 3] < 200) continue;
    const red = buffers.albedoRGBA[i];
    const green = buffers.albedoRGBA[i + 1];
    const blue = buffers.albedoRGBA[i + 2];
    if (red > blue * 1.35 || green > blue * 1.3) continue;
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    buffers.albedoRGBA[i] = Math.min(255, Math.round(luminance * redScale));
    buffers.albedoRGBA[i + 1] = Math.min(255, Math.round(luminance * greenScale));
    buffers.albedoRGBA[i + 2] = Math.min(255, Math.round(luminance * blueScale));
  }
}

export function bakeDogCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const buffers = bakeWolfCharacterBuffers(recipe);
  recolorCanineFur(buffers, 1.38, 1.02, 0.68);

  for (let dir = 0; dir < buffers.directions; dir++) {
    const angle = (dir / buffers.directions) * Math.PI * 2;
    const fx = Math.sin(angle);
    const fy = -Math.cos(angle) * 0.58;
    for (let frame = 0; frame < buffers.framesPerDirection; frame++) {
      const ox = frame * buffers.frameWidth;
      const oy = dir * buffers.frameHeight;
      const cx = ox + 32;
      const groundY = oy + 78;
      const shoulderX = cx + fx * 7.5;
      const shoulderY = groundY - 14 + fy * 5.5;
      const neckX = shoulderX + fx * 1.5;
      const neckY = shoulderY + fy * 1.2;
      fillSegment(
        buffers.albedoRGBA,
        buffers.normalMaterialRGBA,
        buffers.sheetWidth,
        buffers.sheetHeight,
        neckX - fy * 4,
        neckY + fx * 4,
        neckX + fy * 4,
        neckY - fx * 4,
        1.6,
        122,
        38,
        40
      );
    }
  }

  return { ...buffers, recipeHash: `dog_${recipe.id}` };
}

export function bakeBoarCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const buffers = bakeWolfCharacterBuffers(recipe);
  recolorCanineFur(buffers, 1.2, 0.72, 0.48);

  for (let dir = 0; dir < buffers.directions; dir++) {
    const angle = (dir / buffers.directions) * Math.PI * 2;
    const fx = Math.sin(angle);
    const fy = -Math.cos(angle) * 0.58;
    const perpX = -fy * 0.75;
    const perpY = fx * 0.35;
    for (let frame = 0; frame < buffers.framesPerDirection; frame++) {
      const ox = frame * buffers.frameWidth;
      const oy = dir * buffers.frameHeight;
      const cx = ox + 32;
      const groundY = oy + 78;
      const shoulderX = cx + fx * 7.5;
      const shoulderY = groundY - 14 + fy * 5.5;
      const headX = shoulderX + fx * 6.5;
      const headY = shoulderY + fy * 4.5 - 5.5;

      fillEllipse(
        buffers.albedoRGBA,
        buffers.normalMaterialRGBA,
        buffers.sheetWidth,
        buffers.sheetHeight,
        headX + fx * 5,
        headY + fy * 3,
        5.4,
        4.4,
        116,
        66,
        42
      );
      for (const side of [-1, 1]) {
        fillSegment(
          buffers.albedoRGBA,
          buffers.normalMaterialRGBA,
          buffers.sheetWidth,
          buffers.sheetHeight,
          headX + fx * 1.5 + perpX * side * 3,
          headY + fy * 1.5 + perpY * side * 3,
          headX + fx * 7 + perpX * side * 4.5,
          headY + fy * 4 + perpY * side * 4.5,
          1.6,
          228,
          216,
          180
        );
      }
    }
  }

  return { ...buffers, recipeHash: `boar_${recipe.id}` };
}

/**
 * Generates an 8-direction × 4-frame 2.5D coiled forest viper (`zmija_lesna`) sprite sheet.
 */
export function bakeViperCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const frameWidth = 64;
  const frameHeight = 96;
  const directions = 8;
  const framesPerDirection = 4;
  const sheetWidth = frameWidth * framesPerDirection;
  const sheetHeight = frameHeight * directions;

  const albedoRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);

  const scaleMain = { r: 74, g: 104, b: 56 };
  const scaleDark = { r: 34, g: 44, b: 26 };
  const scaleBelly = { r: 142, g: 154, b: 98 };

  for (let dir = 0; dir < directions; dir++) {
    const ang = (dir / directions) * Math.PI * 2;
    const fx = Math.sin(ang);
    const fy = -Math.cos(ang) * 0.58;
    const perpX = -fy * 1.15;
    const perpY = fx * 0.65;

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 80;
      const phase = (frame / framesPerDirection) * Math.PI * 2;

      // Ground shadow under coils
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, groundY + 1, 15, 7, 10, 14, 12, 108);

      // Build S-curved spine from tail (t=0) to neck (t=1)
      const segments = 10;
      const points: Array<{ x: number; y: number; r: number }> = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const along = (t - 0.5) * 20;
        const wave = Math.sin(t * Math.PI * 2.2 + phase) * (5.2 - Math.abs(t - 0.45) * 3.2);
        const lift = t > 0.78 ? (t - 0.78) * 34 : 0;
        const px = cx + fx * along + perpX * wave;
        const py = groundY - 2 + fy * along * 0.85 + perpY * wave * 0.55 - lift;
        const radius = 1.6 + Math.sin(t * Math.PI) * 2.4;
        points.push({ x: px, y: py, r: radius });
      }

      // Belly underside & main scaly body
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        fillSegment(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          a.x,
          a.y + 1.2,
          b.x,
          b.y + 1.2,
          a.r * 0.9,
          scaleBelly.r,
          scaleBelly.g,
          scaleBelly.b
        );
        fillSegment(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          a.x,
          a.y,
          b.x,
          b.y,
          a.r,
          scaleMain.r,
          scaleMain.g,
          scaleMain.b
        );
        // Dark dorsal zigzag diamond markings
        if (i % 2 === 1) {
          fillEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            (a.x + b.x) * 0.5,
            (a.y + b.y) * 0.5 - 0.8,
            a.r * 0.65,
            a.r * 0.55,
            scaleDark.r,
            scaleDark.g,
            scaleDark.b
          );
        }
      }

      // Raised triangular viper head
      const neck = points[points.length - 1];
      const strikeLift = frame === 1 ? -2.2 : frame === 3 ? -1.0 : 0;
      const headX = neck.x + fx * 3.8;
      const headY = neck.y + fy * 2.2 - 1.5 + strikeLift;
      fillEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY,
        4.2,
        3.1,
        scaleMain.r,
        scaleMain.g,
        scaleMain.b
      );
      fillEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY - 0.8,
        2.2,
        1.5,
        scaleDark.r,
        scaleDark.g,
        scaleDark.b
      );

      // Forked crimson tongue on frames 1 & 3
      if (frame === 1 || frame === 3) {
        const tx = headX + fx * 6.5;
        const ty = headY + fy * 3.8 + 0.6;
        fillSegment(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX + fx * 3, headY + fy * 2, tx, ty, 0.8, 215, 48, 56);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, tx + perpX * 1.1, ty + perpY * 1.1, 230, 62, 68, 255);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, tx - perpX * 1.1, ty - perpY * 1.1, 230, 62, 68, 255);
      }

      // Bright yellow slit eyes
      if (fy > -0.45) {
        const eyeX = headX + fx * 1.5;
        const eyeY = headY + fy * 1.0 - 0.8;
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeX - 1.4, eyeY, 248, 224, 62, 255);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeX + 1.4, eyeY, 248, 224, 62, 255);
      }
    }
  }

  return {
    recipeHash: `viper_${recipe.id}`,
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

/**
 * Generates an 8-direction × 4-frame 2.5D hovering marsh wisp (`blednik`) sprite sheet.
 */
export function bakeBlednikCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const frameWidth = 64;
  const frameHeight = 96;
  const directions = 8;
  const framesPerDirection = 4;
  const sheetWidth = frameWidth * framesPerDirection;
  const sheetHeight = frameHeight * directions;

  const albedoRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);

  for (let dir = 0; dir < directions; dir++) {
    const ang = (dir / directions) * Math.PI * 2;
    const fx = Math.sin(ang);
    const fy = -Math.cos(ang) * 0.55;

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 79;
      const phase = (frame / framesPerDirection) * Math.PI * 2;
      const hoverY = groundY - 26 + Math.sin(phase) * 3.5;

      // Pale teal marsh-glow reflection on the ground
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, groundY + 1, 13, 5.5, 46, 154, 144, 78);

      // Trailing spectral wisps below core
      for (const offset of [-5, 0, 5]) {
        const sway = Math.sin(phase + offset * 0.6) * 2.5;
        const tailEndX = cx + offset * 0.8 - fx * 4.5 + sway;
        const tailEndY = hoverY + 15 + (offset === 0 ? 4 : 0);
        fillSegment(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + offset * 0.6,
          hoverY + 3,
          tailEndX,
          tailEndY,
          offset === 0 ? 2.8 : 1.9,
          54,
          172,
          160
        );
      }

      // Outer translucent cyan-emerald aura
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, hoverY, 12.5, 14.5, 48, 184, 168, 92);
      // Mid flame body
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, hoverY - 1, 8.2, 10.2, 98, 232, 214, 210);
      // Flame crown taper
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + Math.cos(phase) * 1.2, hoverY - 11, 3.6, 5.8, 128, 245, 228, 185);
      // Luminous white-cyan inner core
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + fx * 1.2, hoverY - 1 + fy * 0.8, 4.4, 5.2, 226, 255, 248, 255);

      // Hollow eerie eyes when facing camera
      if (fy > -0.3) {
        const eyeX = cx + fx * 2.2;
        const eyeY = hoverY - 1.5 + fy * 1.2;
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeX - 2, eyeY, 18, 52, 56, 230);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, eyeX + 2, eyeY, 18, 52, 56, 230);
      }

      // Orbiting marsh sparks
      const orb1X = cx + Math.cos(phase + dir * 0.4) * 11;
      const orb1Y = hoverY - 3 + Math.sin(phase + dir * 0.4) * 5;
      const orb2X = cx + Math.cos(phase + Math.PI + dir * 0.4) * 9.5;
      const orb2Y = hoverY + 4 + Math.sin(phase + Math.PI + dir * 0.4) * 4;
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, orb1X, orb1Y, 1.8, 1.8, 210, 255, 236, 235);
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, orb2X, orb2Y, 1.5, 1.5, 130, 244, 218, 215);
    }
  }

  return {
    recipeHash: `blednik_${recipe.id}`,
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

/**
 * Generates an 8-direction × 4-frame 2.5D hunched forest imp (`skrzat_zlosnik`) sprite sheet.
 */
export function bakeSkrzatCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const frameWidth = 64;
  const frameHeight = 96;
  const directions = 8;
  const framesPerDirection = 4;
  const sheetWidth = frameWidth * framesPerDirection;
  const sheetHeight = frameHeight * directions;

  const albedoRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);

  const skin = { r: 122, g: 132, b: 96 };
  const tunic = { r: 84, g: 64, b: 46 };
  const moss = { r: 66, g: 94, b: 54 };
  const cap = { r: 138, g: 44, b: 38 };

  for (let dir = 0; dir < directions; dir++) {
    const ang = (dir / directions) * Math.PI * 2;
    const fx = Math.sin(ang);
    const fy = -Math.cos(ang) * 0.58;
    const perpX = -fy * 0.9;
    const perpY = fx * 0.4;

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 79;
      const stride = frame === 1 ? 2.8 : frame === 3 ? -2.8 : 0;
      const hop = frame === 1 || frame === 3 ? -2.2 : 0;

      // Ground shadow
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx, groundY + 1, 11, 5.2, 10, 12, 14, 115);

      // Short bent imp legs
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx - 3.5,
        groundY - 11 + hop,
        cx - 3.8 + fx * stride,
        groundY,
        2.1,
        tunic.r - 16,
        tunic.g - 12,
        tunic.b - 10
      );
      fillSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx + 3.5,
        groundY - 11 + hop,
        cx + 3.8 - fx * stride,
        groundY,
        2.1,
        tunic.r - 10,
        tunic.g - 8,
        tunic.b - 6
      );

      // Hunched compact torso & mossy cloak rag
      const torsoX = cx + fx * 1.5;
      const torsoY = groundY - 16 + hop;
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, torsoX, torsoY, 6.8, 6.2, tunic.r, tunic.g, tunic.b);
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, torsoX - fx * 1.2, torsoY - 3, 6.4, 3.6, moss.r, moss.g, moss.b);

      // Nimble clawed arms reaching slightly forward
      for (const side of [-1, 1]) {
        const shX = torsoX + perpX * side * 5.2;
        const shY = torsoY - 2 + perpY * side * 2;
        const handX = shX + fx * 4.2 + perpX * side * 1.4;
        const handY = shY + 5.5 + (side === 1 ? -stride * 0.6 : stride * 0.6);
        fillSegment(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, shX, shY, handX, handY, 1.8, skin.r, skin.g, skin.b);
      }

      // Large mischievous imp head hunched forward
      const headX = torsoX + fx * 3.2;
      const headY = torsoY - 8.5;
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX, headY, 5.4, 4.8, skin.r, skin.g, skin.b);

      // Long pointed sideways ears
      fillSegment(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX - 4, headY, headX - 9.5, headY - 2.5, 1.6, skin.r - 12, skin.g - 10, skin.b - 10);
      fillSegment(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX + 4, headY, headX + 9.5, headY - 2.5, 1.6, skin.r - 12, skin.g - 10, skin.b - 10);

      // Tall pointed red-brown imp cap leaning slightly back
      fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX, headY - 4.2, 5.6, 3.2, cap.r, cap.g, cap.b);
      fillSegment(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, headX, headY - 5, headX - fx * 4.5, headY - 13.5, 2.6, cap.r, cap.g, cap.b);

      // Glowing amber eyes & pointy nose
      if (fy > -0.35) {
        const faceX = headX + fx * 2.2;
        const faceY = headY + fy * 1.4;
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, faceX - 1.8, faceY - 0.8, 252, 198, 56, 255);
        setPixel(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, faceX + 1.8, faceY - 0.8, 252, 198, 56, 255);
        fillEllipse(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, faceX + fx * 1.4, faceY + 1.2, 1.4, 1.1, skin.r - 14, skin.g - 14, skin.b - 10);
      }
    }
  }

  return {
    recipeHash: `skrzat_${recipe.id}`,
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
