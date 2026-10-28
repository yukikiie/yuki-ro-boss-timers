"use client";

import { useId } from "react";
import type { ImportedHeaderPlacement } from "../../lib/imported-header-placements";
import { importedHeaderArtDetails } from "../../lib/imported-header-art";
import type { ScenePhase } from "../../lib/scene-time";

export const importedHeaderMotionStyles = `
  @media (prefers-reduced-motion:reduce) {
    .living-scene .imported-illustrated-frame { animation:none!important; opacity:0!important }
    .living-scene .imported-illustrated-frame-0 { opacity:1!important }
  }
`;

export function ImportedHeaderResident({ placement, phase, active }: { placement: ImportedHeaderPlacement; phase: ScenePhase; active: boolean }) {
  const identifier = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const details = importedHeaderArtDetails(placement);
  if (!details) return null;
  const durationMs = Math.round(details.duration * 1000);
  const phaseOffset = [...placement.fileId].reduce((offset, character) => (offset * 31 + character.charCodeAt(0)) % durationMs, 0) / 1000;
  return <g data-imported-header-resident={placement.fileId} data-imported-art-style="illustrated" data-imported-support={placement.support} data-imported-landmark={placement.landmark} data-imported-depth={placement.depth} data-anchor={`${placement.x},${placement.y}`} data-imported-phase={phase} data-routine="idle" data-imported-occupied-area={details.occupiedIdleArea}>
    {placement.support !== "air" && <path d={`M${placement.x - details.effectiveReferenceWidth * .18} ${placement.y - .8}h${details.effectiveReferenceWidth * .36}v1.6h${-details.effectiveReferenceWidth * .36}Z`} fill="#19243e" opacity=".17" />}
    <svg x={details.left} y={details.top} width={details.width} height={details.height} viewBox={`0 0 ${details.cellWidth} ${details.cellHeight}`} preserveAspectRatio="xMidYMax meet" overflow="visible" data-imported-viewport={placement.fileId}>
      <defs>{details.frames.map((frame, index) => <clipPath key={index} id={`imported-header-${identifier}-${index}`} clipPathUnits="userSpaceOnUse"><rect x={frame.offsetLeft} y={frame.offsetTop} width={frame.width} height={frame.height} /></clipPath>)}</defs>
      {details.frames.map((frame, index) => <g key={index} clipPath={`url(#imported-header-${identifier}-${index})`} className={`scene-motion creature-frame creature-frame-${index} imported-illustrated-frame imported-illustrated-frame-${index}`} style={{ animationDuration: `${details.duration}s`, animationDelay: `${-phaseOffset - (index ? (4 - index) * details.duration / 4 : 0)}s`, animationPlayState: active ? "running" : "paused" }} data-imported-frame={index}>
        <image href={details.source} x={frame.offsetLeft - frame.left} y={frame.offsetTop - frame.top} width={details.atlasWidth} height={details.atlasHeight} style={{ imageRendering: "pixelated" }} />
      </g>)}
    </svg>
  </g>;
}
