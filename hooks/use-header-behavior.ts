"use client";

import { createContext, createElement, createRef, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { advanceHeaderCrowd, createHeaderCrowd, type HeaderCrowd } from "../lib/header-crowd";
import type { ScenePhase } from "../lib/scene-time";

type HeaderBinding = {
  movement: RefObject<SVGGElement | null>;
  activity: HeaderCrowd["actors"][number]["activity"];
  facing: "left" | "right";
  transform: string;
};

const HeaderBehaviorContext = createContext<HeaderBinding[] | null>(null);

function actorTransform(actor: HeaderCrowd["actors"][number]) {
  return `translate(${Math.round(actor.position.x - actor.origin.x)} ${Math.round(actor.position.y - actor.origin.y)})`;
}

export function HeaderBehaviorProvider({ phase, active, tall = false, children }: { phase: ScenePhase; active: boolean; tall?: boolean; children: ReactNode }) {
  const layout = tall ? "tall" : "standard";
  const world = useRef(createHeaderCrowd(phase, 7091, layout));
  const movements = useRef(world.current.actors.map(() => createRef<SVGGElement>()));
  const signature = useRef("");
  const [bindings, setBindings] = useState<HeaderBinding[]>(() => world.current.actors.map((actor, index) => ({
    movement: movements.current[index], activity: actor.activity, facing: actor.facing, transform: actorTransform(actor),
  })));

  useEffect(() => {
    const sync = () => {
      for (const [index, actor] of world.current.actors.entries()) movements.current[index].current?.setAttribute("transform", actorTransform(actor));
      const nextSignature = `${world.current.layout}:${world.current.phase}:${world.current.actors.map(actor => `${actor.activity}:${actor.facing}`).join("|")}`;
      if (nextSignature !== signature.current) {
        signature.current = nextSignature;
        setBindings(world.current.actors.map((actor, index) => ({
          movement: movements.current[index], activity: actor.activity, facing: actor.facing, transform: actorTransform(actor),
        })));
      }
    };
    world.current = world.current.layout === layout ? advanceHeaderCrowd(world.current, 0, phase) : createHeaderCrowd(phase, world.current.seed, layout);
    sync();
    if (!active || phase === "night") return;
    let frame = 0;
    let previousTime: number | null = null;
    const step = (time: number) => {
      if (previousTime !== null) world.current = advanceHeaderCrowd(world.current, Math.min(100, time - previousTime), phase);
      previousTime = time;
      sync();
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, phase, layout]);

  return createElement(HeaderBehaviorContext.Provider, { value: bindings }, children);
}

export function useHeaderBehavior(actorIndex: number) {
  const bindings = useContext(HeaderBehaviorContext);
  if (!bindings?.[actorIndex]) throw new Error("Header actors require a shared behavior provider");
  return bindings[actorIndex];
}
