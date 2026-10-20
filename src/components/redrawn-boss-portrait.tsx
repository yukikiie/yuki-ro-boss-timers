"use client";

import { useId } from "react";

export const redrawnMainRegions = [
  [48, 109, 392, 379], [489, 75, 371, 402], [875, 94, 433, 392], [1344, 158, 416, 330],
  [47, 506, 379, 363], [453, 482, 424, 392], [916, 495, 445, 379], [1423, 502, 321, 373],
] as const;

export const redrawnExpansionRegions = [
  [62, 99, 362, 335], [497, 90, 352, 341], [923, 108, 359, 328], [1368, 198, 338, 202],
  [55, 477, 387, 324],
] as const;

export function RedrawnBossPortrait({ spriteIndex }: { spriteIndex: number }) {
  const clipId = `redrawn-boss-${useId().replace(/:/g, "")}`;
  const expansion = spriteIndex >= 11;
  const region = expansion ? redrawnExpansionRegions[spriteIndex - 11] : redrawnMainRegions[spriteIndex - 3];
  if (!region) return null;
  const [left, top, width, height] = region;
  return <svg className="boss-figure" viewBox={`${left} ${top} ${width} ${height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" data-redrawn-portrait={spriteIndex}>
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={left} y={top} width={width} height={height} /></clipPath></defs>
    <image href={expansion ? "/art/ro-redrawn-expansion.png" : "/art/ro-redrawn-main.png"} width="1774" height="887" clipPath={`url(#${clipId})`} />
  </svg>;
}
