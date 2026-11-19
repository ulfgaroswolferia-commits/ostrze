/**
 * Deterministic low-frequency organic noise in [-1, 1] for natural terrain clustering,
 * avoiding modulo stripe and checkerboard artifacts.
 */
export function organicPatchNoise(x: number, y: number, seed = 0): number {
  const a =
    Math.sin(x * 0.72 + y * 0.41 + seed * 1.7) * Math.cos(x * 0.37 - y * 0.68 + seed * 0.9);
  const b = Math.sin(x * 0.31 - y * 0.53 + seed * 2.3) * 0.45;
  return (a + b) / 1.45;
}

/**
 * Smooth edge wobble in [-amplitude, +amplitude] for organic clearings and courtyards.
 */
export function organicEdgeWobble(x: number, y: number, amplitude: number, freq = 0.65): number {
  return (Math.sin(x * freq) * 0.5 + Math.cos(y * freq) * 0.5) * amplitude;
}
