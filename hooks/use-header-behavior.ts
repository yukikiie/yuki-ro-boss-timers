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

const HeaderBehaviorContext = createContext<ReadonlyMap<number, HeaderBinding> | null>(null);

function actorTransform(actor: HeaderCrowd["actors"][number]) {
  return `translate(${Math.round(actor.position.x - actor.origin.x)} ${Math.round(actor.position.y - actor.origin.y)})`;
}

export function HeaderBehaviorProvider({ phase, active, tall = false, actorIndices, children }: { phase: ScenePhase; active: boolean; tall?: boolean; actorIndices?: readonly number[]; children: ReactNode }) {
  const layout = tall ? "tall" : "standard";
  const selection = actorIndices?.join(",") ?? "all";
  const previousSelection = useRef(selection);
  const world = useRef(createHeaderCrowd(phase, 7091, layout, actorIndices));
  const movements = useRef(new Map(world.current.actors.map(actor => [actor.index, createRef<SVGGElement>()])));
  const signature = useRef("");
  const [bindings, setBindings] = useState<ReadonlyMap<number, HeaderBinding>>(() => new Map(world.current.actors.map(actor => [actor.index, {
    movement: movements.current.get(actor.index)!, activity: actor.activity, facing: actor.facing, transform: actorTransform(actor),
  }])));

  useEffect(() => {
    const sync = () => {
      for (const actor of world.current.actors) {
        if (!movements.current.has(actor.index)) movements.current.set(actor.index, createRef<SVGGElement>());
        movements.current.get(actor.index)!.current?.setAttribute("transform", actorTransform(actor));
      }
      const nextSignature = `${world.current.layout}:${world.current.phase}:${world.current.actors.map(actor => `${actor.index}:${actor.activity}:${actor.facing}`).join("|")}`;
      if (nextSignature !== signature.current) {
        signature.current = nextSignature;
        setBindings(new Map(world.current.actors.map(actor => [actor.index, {
          movement: movements.current.get(actor.index)!, activity: actor.activity, facing: actor.facing, transform: actorTransform(actor),
        }])));
      }
    };
    world.current = world.current.layout === layout && previousSelection.current === selection ? advanceHeaderCrowd(world.current, 0, phase) : createHeaderCrowd(phase, world.current.seed, layout, actorIndices);
    previousSelection.current = selection;
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
  }, [active, phase, layout, selection]);

  return createElement(HeaderBehaviorContext.Provider, { value: bindings }, children);
}

export function useHeaderBehavior(actorIndex: number) {
  const bindings = useContext(HeaderBehaviorContext);
  const binding = bindings?.get(actorIndex);
  if (!binding) throw new Error("Header actors require a shared behavior provider");
  return binding;
}
