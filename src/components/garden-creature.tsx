"use client";

import { useId } from "react";
import { gardenCreatureDetails, gardenCreatures } from "../../lib/garden-creatures";
import { gardenPersonDetails, gardenPeople } from "../../lib/garden-people";
import { addedGardenResidentDetails, addedGardenResidents } from "../../lib/garden-added-residents";
import type { ScenePhase } from "../../lib/scene-time";
import { SleepMarks, SleepBubble } from "./sleep-marks";
import { HeaderBehaviorProvider, useHeaderBehavior } from "../../hooks/use-header-behavior";

export function HeaderResidents({ phase, active, tall = false }: { phase: ScenePhase; active: boolean; tall?: boolean }) {
  return <HeaderBehaviorProvider phase={phase} active={active} tall={tall}>
    {gardenCreatures.map((creature, index) => <GardenCreature key={creature.id} index={index} phase={phase} />)}
    {gardenPeople.map((person, index) => <GardenPerson key={person.id} index={index} phase={phase} />)}
    {addedGardenResidents.map((resident, index) => <AddedGardenResident key={resident.id} index={index} phase={phase} />)}
  </HeaderBehaviorProvider>;
}

export function GardenCreature({ index, phase }: { index: number; phase: ScenePhase }) {
  const behavior = useHeaderBehavior(index);
  return <GardenSprite details={gardenCreatureDetails(index, phase, behavior.activity)} behavior={behavior} bubble={index % 2 === 0} person={false} />;
}

export function GardenPerson({ index, phase }: { index: number; phase: ScenePhase }) {
  const behavior = useHeaderBehavior(index + 6);
  return <GardenSprite details={gardenPersonDetails(index, phase, behavior.activity)} behavior={behavior} bubble={index === 0} person />;
}

export function AddedGardenResident({ index, phase }: { index: number; phase: ScenePhase }) {
  const behavior = useHeaderBehavior(index + 8);
  const details = addedGardenResidentDetails(index, phase, behavior.activity);
  return <GardenSprite details={details} behavior={behavior} bubble person={details?.person ?? false} />;
}

function GardenSprite({ details, behavior, bubble, person }: { details: ReturnType<typeof gardenCreatureDetails> | ReturnType<typeof gardenPersonDetails> | ReturnType<typeof addedGardenResidentDetails>; behavior: ReturnType<typeof useHeaderBehavior>; bubble: boolean; person: boolean }) {
  const identifier = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!details) return null;
  const duration = details.sleeping ? 5.6 : behavior.activity === "walk" ? person ? .9 : .8 : 2.4;
  const frameCount = details.frames.length;
  const nose = "sleepNose" in details ? details.sleepNose : person ? [.5, .62] : ({ "purple-poring": [.466, .818], "hat-poring": [.501, .840], "blue-ghost": [.407, .815], "leaf-poring": [.464, .824], lunatic: [.409, .839], "peco-chick": [.282, .829] } as Record<string, number[]>)[details.id];
  const bubbleSize = details.cellWidth * .26;
  return <g data-header-resident={details.id} data-locomotion={details.id === "angel-poring" && !details.sleeping ? "fly" : "ground"} data-garden-creature={person ? undefined : details.id} data-garden-person={person ? details.id : undefined} data-header-activity={behavior.activity} data-routine={details.sleeping ? "sleep" : "play"}>
    <g ref={behavior.movement} transform={behavior.transform} className="garden-actor" data-facing={behavior.facing}>
      <svg x={details.left} y={details.top} width={details.width} height={details.height} viewBox={`0 0 ${details.cellWidth} ${details.cellHeight}`} preserveAspectRatio="xMidYMax meet" overflow="visible">
        <defs>{details.frames.map((frame, frameIndex) => <clipPath key={frameIndex} id={`creature-${identifier}-${frameIndex}`} clipPathUnits="userSpaceOnUse"><rect x={frame.offsetLeft} y={frame.offsetTop} width={frame.width} height={frame.height} /></clipPath>)}</defs>
        <g transform={!details.sleeping && behavior.facing === "left" ? `translate(${details.cellWidth} 0) scale(-1 1)` : undefined}>
        {details.frames.map((frame, frameIndex) => <g key={frameIndex} clipPath={`url(#creature-${identifier}-${frameIndex})`} className={`scene-motion creature-frame creature-frame-${frameIndex}${frameCount === 1 ? " creature-static-frame" : frameCount === 2 ? " creature-sleep-frame" : ""}`} style={{ animationDuration: `${duration}s`, animationDelay: `${frameIndex ? -(frameCount - frameIndex) * duration / frameCount : 0}s` }} data-creature-frame={frameIndex}>
          <image href={details.source} x={frame.offsetLeft - frame.left} y={frame.offsetTop - frame.top} width={details.atlasWidth} height={details.atlasHeight} />
        </g>)}
        </g>
        {details.sleeping && bubble && <svg x={details.cellWidth * nose[0]} y={details.cellHeight * nose[1] - bubbleSize} width={bubbleSize} height={bubbleSize} viewBox="0 0 32 32" overflow="visible"><SleepBubble /></svg>}
      </svg>
      {behavior.activity === "play" && <svg className="scene-motion creature-play-effect" x={details.left + details.width * .62} y={details.top + details.height * .12} width={details.width * .45} height={details.height * .45} viewBox="0 0 40 40" overflow="visible"><path d="M20 1h3v10h10v3H23v10h-3V14H10v-3h10ZM4 25h3v5h5v3H7v5H4v-5H0v-3h4Z" fill="#fff0a9" stroke="#b58f46" strokeWidth="1" /></svg>}
      {details.id === "purple-poring" && !details.sleeping && <g data-affection-mark="purple-poring" transform={`translate(${details.left + details.width * .64} ${details.top - 45})`}>
        <path d="M0 0h46v37H29l-8 9v-9H0Z" fill="#fff8f7" stroke="#342047" strokeWidth="3" />
        <path d="M10 10h8v4h9v-4h8v12h-5v5h-5v5h-6v-5h-5v-5h-4Z" fill="#f85c7c" />
        <path d="M12 12h5v3h-5Z" fill="#ffe6e8" />
      </g>}
      {details.sleeping && <svg x={details.left + details.width * .56} y={details.top - details.height * .1} width={details.width * .56} height={details.height * .5} viewBox="0 0 64 48" overflow="visible"><SleepMarks /></svg>}
    </g>
  </g>;
}
