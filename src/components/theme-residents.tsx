"use client";

import { useId, type CSSProperties } from "react";
import type { BackgroundThemeId } from "../../lib/background-themes";
import { THEME_RESIDENTS, themeResidentDetails, type ThemeLayout, type ThemeResident } from "../../lib/theme-residents";
import { IMPORTED_HEADER_PLACEMENTS } from "../../lib/imported-header-placements";
import type { ScenePhase } from "../../lib/scene-time";
import { ImportedHeaderResident, importedHeaderMotionStyles } from "./imported-header-residents";

const residentMotionStyles = `
  @keyframes theme-rest { 0%,45%,100% { transform:translateY(0) } 65%,80% { transform:translateY(-.45px) } }
  @keyframes theme-perch { 0%,60%,100% { transform:translateY(0) } 72%,84% { transform:translateY(-.6px) } }
  @keyframes theme-hop { 0%,65%,100% { transform:translate(0,0) } 72%,78% { transform:translate(1px,-2.5px) } 86% { transform:translate(0,0) } }
  @keyframes theme-hover { 0%,100% { transform:translate(-1px,0) } 50% { transform:translate(1px,-2.5px) } }
  .theme-resident-local { animation-timing-function:steps(4,end); animation-iteration-count:infinite }
  @media (prefers-reduced-motion:reduce) { .theme-resident-local { animation:none!important; transform:none!important; opacity:1!important } }
`;

function ThemeResidentSprite({ placement, phase, active, index }: { placement: ThemeResident; phase: ScenePhase; active: boolean; index: number }) {
  const identifier = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const details = themeResidentDetails(placement, phase);
  const frameCount = details.frames.length;
  const duration = details.sleeping ? 5.6 : placement.id === "peco-chick" ? 3.6 : placement.id === "angel-poring" ? 2.4 : 4.4 + (index % 3) * .4;
  const animationPlayState = active ? "running" : "paused";
  const motion = details.sleeping ? "rest" : placement.motion;
  const localStyle: CSSProperties = { animationName: `theme-${motion}`, animationDuration: motion === "hover" ? "3.8s" : motion === "hop" ? "5.6s" : "4.8s", animationDelay: `${-index * .71}s`, animationPlayState };

  return <g data-theme-resident={placement.id} data-header-resident={placement.id} data-garden-creature={placement.id} data-support={placement.support} data-landmark={placement.landmark} data-depth={placement.depth} data-anchor={`${placement.x},${placement.y}`} data-routine={details.sleeping ? "sleep" : "play"} data-local-motion={motion}>
    {placement.support !== "air" && <path transform={`translate(${placement.x} ${placement.y})`} d={`M${-details.width * .19} -.8h${details.width * .38}v1.6h${-details.width * .38}Z`} fill="#19243e" opacity=".17" />}
    <g className="garden-actor scene-motion theme-resident-local" style={localStyle}>
      <svg x={details.left} y={details.top} width={details.width} height={details.height} viewBox={`0 0 ${details.cellWidth} ${details.cellHeight}`} preserveAspectRatio="xMidYMax meet" overflow="visible">
        <defs>{details.frames.map((frame, frameIndex) => <clipPath key={frameIndex} id={`theme-creature-${identifier}-${frameIndex}`} clipPathUnits="userSpaceOnUse"><rect x={frame.offsetLeft} y={frame.offsetTop} width={frame.width} height={frame.height} /></clipPath>)}</defs>
        <g transform={placement.facing === "left" ? `translate(${details.cellWidth} 0) scale(-1 1)` : undefined}>
          {details.frames.map((frame, frameIndex) => <g key={frameIndex} clipPath={`url(#theme-creature-${identifier}-${frameIndex})`} className={`scene-motion creature-frame creature-frame-${frameIndex}${frameCount === 2 ? " creature-sleep-frame" : ""}`} style={{ animationDuration: `${duration}s`, animationDelay: `${-index * .37 - (frameIndex ? (frameCount - frameIndex) * duration / frameCount : 0)}s`, animationPlayState }} data-creature-frame={frameIndex}>
            <image href={details.source} x={frame.offsetLeft - frame.left} y={frame.offsetTop - frame.top} width={details.atlasWidth} height={details.atlasHeight} style={{ imageRendering: "pixelated" }} />
          </g>)}
        </g>
      </svg>
    </g>
  </g>;
}

export function ThemeResidents({ themeId, layout, phase, active }: { themeId: BackgroundThemeId; layout: ThemeLayout; phase: ScenePhase; active: boolean }) {
  const placements = THEME_RESIDENTS[themeId][layout];
  const residents = [
    ...[...placements].sort((first, second) => first.y - second.y).map((placement, index) => ({ kind: "existing" as const, placement, index })),
    ...IMPORTED_HEADER_PLACEMENTS[themeId][layout].map((placement, index) => ({ kind: "imported" as const, placement, index })),
  ].sort((first, second) => first.placement.y - second.placement.y);
  return <g data-theme-residents={themeId} data-resident-layout={layout} data-residents-active={String(active)}>
    <style>{residentMotionStyles + importedHeaderMotionStyles}</style>
    {residents.map(resident => resident.kind === "existing" ? <ThemeResidentSprite key={resident.placement.id} placement={resident.placement} phase={phase} active={active} index={resident.index} /> : <ImportedHeaderResident key={`imported-${resident.placement.fileId}`} placement={resident.placement} phase={phase} active={active} />)}
  </g>;
}
