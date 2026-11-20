import type { WorldPropEntity } from '@ulf/core/worldMap';

export interface PropVisualTransform {
  scaleX: number;
  scaleY: number;
  centerOnFootprint: boolean;
  offsetY: number;
  aoScale: number;
}

const IDENTITY_TRANSFORM: PropVisualTransform = {
  scaleX: 1,
  scaleY: 1,
  centerOnFootprint: false,
  offsetY: 0,
  aoScale: 1
};

/**
 * Computes purpose-appropriate visual scale & footprint anchoring for architectural props
 * based on their tile footprint (sizeX × sizeY) and elevation height (heightZ).
 *
 * Architectural scale tiers for `slavic_cottage`:
 *  - Monumental / Grand Institution (4×2, heightZ >= 4 — e.g. Szkoła Ostrzy): 1.62×
 *  - Large Public / Garrison Hall (3×2, heightZ >= 3 — e.g. Karczma, Koszary, Młyn): 1.34×
 *  - Medium-Large Wing / Dormitory / Lodge (2×2): 1.12×
 *  - Standard Village Cottage / Forge / Workshop (2×1): 0.98×
 *  - Compact Outbuilding / Shed (1×1, heightZ <= 1 — e.g. Szopa): 0.85×
 *
 * Architectural scale tiers for `watchtower`:
 *  - Main Fortress Keep / Command Bastion (2×2 or heightZ >= 4): 1.38×
 *  - Standard Defensive Watchtower (2×1, heightZ 3): 1.16×
 */
export function getPropVisualTransform(
  prop: Pick<WorldPropEntity, 'kind' | 'sizeX' | 'sizeY' | 'heightZ'>
): PropVisualTransform {
  const area = Math.max(1, prop.sizeX * prop.sizeY);

  if (prop.kind === 'slavic_cottage') {
    if (area >= 8 || prop.heightZ >= 4) {
      return {
        scaleX: 1.62,
        scaleY: 1.62,
        centerOnFootprint: true,
        offsetY: 14,
        aoScale: 1.25
      };
    }
    if (area >= 6 || prop.heightZ >= 3) {
      return {
        scaleX: 1.34,
        scaleY: 1.34,
        centerOnFootprint: true,
        offsetY: 10,
        aoScale: 1.15
      };
    }
    if (area >= 4) {
      return {
        scaleX: 1.12,
        scaleY: 1.12,
        centerOnFootprint: true,
        offsetY: 6,
        aoScale: 1.05
      };
    }
    if (area <= 1 && prop.heightZ <= 1) {
      return {
        scaleX: 0.85,
        scaleY: 0.85,
        centerOnFootprint: false,
        offsetY: 0,
        aoScale: 0.85
      };
    }
    return {
      scaleX: 0.98,
      scaleY: 0.98,
      centerOnFootprint: true,
      offsetY: 2,
      aoScale: 1.0
    };
  }

  if (prop.kind === 'watchtower') {
    if (area >= 4 || prop.heightZ >= 4) {
      return {
        scaleX: 1.38,
        scaleY: 1.38,
        centerOnFootprint: true,
        offsetY: 10,
        aoScale: 1.2
      };
    }
    return {
      scaleX: 1.16,
      scaleY: 1.16,
      centerOnFootprint: true,
      offsetY: 4,
      aoScale: 1.05
    };
  }

  return IDENTITY_TRANSFORM;
}
