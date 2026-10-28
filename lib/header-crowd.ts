import { headerActors, headerAngelRest, headerFlightLane, headerFlightStops, nextHeaderBehavior, type HeaderActorCategory, type HeaderActorState, type HeaderPoint } from "./header-behavior";
import type { ScenePhase } from "./scene-time";

export const HEADER_CROWD_GAP = 20;
const STEP_MS = 20;
export type HeaderCrowdLayout = "standard" | "tall";

export type HeaderCrowdActor = {
  id: string;
  index: number;
  category: HeaderActorCategory;
  position: HeaderPoint;
  origin: HeaderPoint;
  width: number;
  height: number;
  activity: HeaderActorState["activity"];
  facing: HeaderActorState["facing"];
  plan: HeaderActorState;
  blockedMs: number;
  retryAtMs: number;
  distanceTravelled: number;
  lastMovedAtMs: number;
  layout: HeaderCrowdLayout;
  completedWalks: number;
};

export type HeaderCrowd = {
  actors: HeaderCrowdActor[];
  phase: ScenePhase;
  seed: number;
  timeMs: number;
  remainderMs: number;
  tick: number;
  layout: HeaderCrowdLayout;
};

const homePositions: HeaderPoint[] = [
  { x: 220, y: 660 }, { x: 610, y: 690 }, { x: 1098, y: 790 }, { x: 470, y: 810 },
  { x: 810, y: 820 }, { x: 100, y: 790 }, { x: 810, y: 510 }, { x: 980, y: 570 },
  { x: 100, y: 510 }, { x: 1100, y: 330 }, { x: 460, y: 510 }, { x: 640, y: 490 },
];

const tallHomePositions: HeaderPoint[] = [
  { x: 220, y: 660 }, { x: 440, y: 1090 }, { x: 1030, y: 820 }, { x: 660, y: 1110 },
  { x: 1030, y: 975 }, { x: 1030, y: 1130 }, { x: 810, y: 510 }, { x: 980, y: 570 },
  { x: 800, y: 1040 }, { x: 1100, y: 330 }, { x: 800, y: 840 }, { x: 640, y: 490 },
];

function distance(first: HeaderPoint, second: HeaderPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function limitsFor(actor: HeaderCrowdActor) {
  if (actor.category === "flying") return { ...headerFlightLane };
  const foreground = canUseForeground(actor);
  return { left: 80, right: Math.min(1130, 1228 - actor.width), top: actor.id === "alice-maid" ? 490 : 510, bottom: Math.min(foreground ? 1140 : 833, (foreground ? 1240 : 930) - actor.height) };
}

function canUseForeground(actor: HeaderCrowdActor) {
  return actor.layout === "tall" && actor.category === "ground" && actor.id !== "purple-poring";
}

function lowerResidents(actors: HeaderCrowdActor[]) {
  return actors.filter(actor => actor.category === "ground" && actor.position.y >= 950);
}

function boundedPoint(point: HeaderPoint, actor: HeaderCrowdActor) {
  const limits = limitsFor(actor);
  return { x: clamp(point.x, limits.left, limits.right), y: clamp(point.y, limits.top, limits.bottom) };
}

function overlapping(position: HeaderPoint, actor: HeaderCrowdActor, otherPosition: HeaderPoint, other: HeaderCrowdActor) {
  return position.x < otherPosition.x + other.width + HEADER_CROWD_GAP - .001 &&
    position.x + actor.width + HEADER_CROWD_GAP > otherPosition.x + .001 &&
    position.y < otherPosition.y + other.height + HEADER_CROWD_GAP - .001 &&
    position.y + actor.height + HEADER_CROWD_GAP > otherPosition.y + .001;
}

function intersectsSegment(start: HeaderPoint, end: HeaderPoint, left: number, top: number, right: number, bottom: number) {
  let entering = 0;
  let leaving = 1;
  for (const [origin, delta, minimum, maximum] of [[start.x, end.x - start.x, left + .001, right - .001], [start.y, end.y - start.y, top + .001, bottom - .001]]) {
    if (Math.abs(delta) < .00001) {
      if (origin <= minimum || origin >= maximum) return false;
    } else {
      const first = (minimum - origin) / delta;
      const second = (maximum - origin) / delta;
      entering = Math.max(entering, Math.min(first, second));
      leaving = Math.min(leaving, Math.max(first, second));
      if (entering > leaving) return false;
    }
  }
  return entering <= leaving;
}

function terrainObstacles(actor: HeaderCrowdActor) {
  if (actor.layout !== "tall" || actor.category !== "ground") return [];
  return [[380, 895, 705, 1040], [160, 1040, 450, 1254], [1150, 950, 1672, 1254]].map(([left, top, right, bottom]) => ({
    left: left - actor.width / 2, right: right - actor.width / 2, top: top - actor.height + 76, bottom: bottom - actor.height + 76,
  }));
}

function clearSegment(start: HeaderPoint, end: HeaderPoint, actor: HeaderCrowdActor, actors: HeaderCrowdActor[], reserveDestinations: boolean) {
  if (terrainObstacles(actor).some(obstacle => intersectsSegment(start, end, obstacle.left, obstacle.top, obstacle.right, obstacle.bottom))) return false;
  return actors.every(other => {
    if (other.index === actor.index) return true;
    const positions = reserveDestinations && other.activity === "walk" && other.plan.activity === "walk" && !other.blockedMs ? [other.position, other.plan.end] : [other.position];
    return positions.every(position => !intersectsSegment(start, end,
      position.x - actor.width - HEADER_CROWD_GAP, position.y - actor.height - HEADER_CROWD_GAP,
      position.x + other.width + HEADER_CROWD_GAP, position.y + other.height + HEADER_CROWD_GAP));
  });
}

function routeBetween(start: HeaderPoint, end: HeaderPoint, actor: HeaderCrowdActor, actors: HeaderCrowdActor[]) {
  if (!clearSegment(end, end, actor, actors, true)) return null;
  if (clearSegment(start, end, actor, actors, false)) return [{ ...start }, { ...end }];
  const limits = limitsFor(actor);
  const points: HeaderPoint[] = [{ ...start }, { ...end }];
  for (const obstacle of terrainObstacles(actor)) {
    for (const point of [{ x: obstacle.left - .5, y: obstacle.top - .5 }, { x: obstacle.right + .5, y: obstacle.top - .5 }, { x: obstacle.left - .5, y: obstacle.bottom + .5 }, { x: obstacle.right + .5, y: obstacle.bottom + .5 }]) {
      const bounded = boundedPoint(point, actor);
      if (clearSegment(bounded, bounded, actor, actors, false)) points.push(bounded);
    }
  }
  for (const other of actors) {
    if (other.index === actor.index) continue;
    const positions = [other.position];
    for (const position of positions) {
      const left = position.x - actor.width - HEADER_CROWD_GAP - .5;
      const right = position.x + other.width + HEADER_CROWD_GAP + .5;
      const top = position.y - actor.height - HEADER_CROWD_GAP - .5;
      const bottom = position.y + other.height + HEADER_CROWD_GAP + .5;
      for (const point of [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }]) {
        const bounded = { x: clamp(point.x, limits.left, limits.right), y: clamp(point.y, limits.top, limits.bottom) };
        if (clearSegment(bounded, bounded, actor, actors, false)) points.push(bounded);
      }
    }
  }
  const costs = new Float64Array(points.length).fill(Infinity);
  const parents = new Int32Array(points.length).fill(-1);
  const visited = new Uint8Array(points.length);
  const available = points.map(point => clearSegment(point, point, actor, actors, false));
  const open = [0];
  costs[0] = 0;
  while (open.length) {
    let best = 0;
    for (let index = 1; index < open.length; index++) if (costs[open[index]] + distance(points[open[index]], end) < costs[open[best]] + distance(points[open[best]], end)) best = index;
    const current = open.splice(best, 1)[0];
    if (visited[current]) continue;
    visited[current] = 1;
    if (current === 1) {
      const route: HeaderPoint[] = [];
      for (let cursor = current; cursor >= 0; cursor = parents[cursor]) route.unshift(points[cursor]);
      const simplified = [route[0]];
      let cursor = 0;
      while (cursor < route.length - 1) {
        let next = route.length - 1;
        while (next > cursor + 1 && !clearSegment(route[cursor], route[next], actor, actors, false)) next--;
        simplified.push(route[next]);
        cursor = next;
      }
      return simplified;
    }
    for (let neighbor = 1; neighbor < points.length; neighbor++) {
      if (visited[neighbor] || !available[neighbor] || !clearSegment(points[current], points[neighbor], actor, actors, false)) continue;
      const cost = costs[current] + distance(points[current], points[neighbor]);
      if (cost >= costs[neighbor]) continue;
      costs[neighbor] = cost;
      parents[neighbor] = current;
      open.push(neighbor);
    }
  }
  return null;
}

function pathLength(points: HeaderPoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function positionAt(plan: HeaderActorState, timeMs: number) {
  const fraction = clamp((timeMs - plan.startedAt) / plan.durationMs, 0, 1);
  let remaining = pathLength(plan.waypoints) * fraction;
  for (let index = 1; index < plan.waypoints.length; index++) {
    const start = plan.waypoints[index - 1];
    const end = plan.waypoints[index];
    const length = distance(start, end);
    if (remaining <= length && length > .0001) return { x: start.x + (end.x - start.x) * remaining / length, y: start.y + (end.y - start.y) * remaining / length };
    remaining -= length;
  }
  return { ...plan.end };
}

function selectWalk(actor: HeaderCrowdActor, actors: HeaderCrowdActor[], phase: ScenePhase, nowMs: number): HeaderActorState | null {
  const meadowStops = [
    { x: 80, y: 510 }, { x: 330, y: 510 }, { x: 560, y: 510 }, { x: 790, y: 510 }, { x: 1040, y: 510 },
    { x: 100, y: 700 }, { x: 340, y: 690 }, { x: 570, y: 700 }, { x: 800, y: 700 }, { x: 1040, y: 700 },
    { x: 100, y: 820 }, { x: 340, y: 820 }, { x: 570, y: 810 }, { x: 800, y: 810 }, { x: 1040, y: 810 },
    { x: 370, y: 560 }, { x: 650, y: 560 },
  ];
  const foregroundStops = [
    { x: 535, y: 1155 }, { x: 715, y: 1150 }, { x: 1080, y: 1150 }, { x: 1085, y: 1060 },
    { x: 800, y: 1080 }, { x: 1000, y: 1080 }, { x: 800, y: 1150 }, { x: 1000, y: 1150 },
  ].map(point => ({ x: point.x - actor.width / 2, y: point.y - actor.height + 76 }));
  const tallCreature = canUseForeground(actor);
  const foregroundResidents = lowerResidents(actors);
  const mustStayLower = tallCreature && actor.position.y >= 950 && !foregroundResidents.some(other => other.index !== actor.index);
  const preferForeground = foregroundResidents.length < 2 || actor.completedWalks % 4 !== 3;
  const preferred = preferForeground ? foregroundStops : meadowStops;
  const alternate = preferForeground ? meadowStops : foregroundStops;
  const rotate = (points: HeaderPoint[]) => {
    const first = (actor.plan.seedNext >>> 0) % points.length;
    return [...points.slice(first), ...points.slice(0, first)];
  };
  const stops = actor.category === "flying" ? [...headerFlightStops] : tallCreature ? [...rotate(preferred), ...rotate(alternate)] : meadowStops;
  const offset = (actor.plan.seedNext >>> 0) % stops.length;
  let previous: HeaderActorState = { ...actor.plan, activity: "idle", start: { ...actor.position }, end: { ...actor.position }, startedAt: nowMs - 1, durationMs: 1 };
  for (let attempt = 0; attempt <= stops.length; attempt++) {
    const proposed = nextHeaderBehavior(actor.index, phase, previous, previous.seedNext, nowMs);
    const targetId = proposed.targetId && headerActors.some(other => other.id === proposed.targetId) && !actors.some(other => other.id === proposed.targetId) ? "flower-meadow" : proposed.targetId;
    const end = boundedPoint(tallCreature ? stops[attempt % stops.length] : attempt ? stops[(offset + attempt - 1) % stops.length] : proposed.end, actor);
    if (mustStayLower && end.y < 950) continue;
    const route = distance(actor.position, end) >= 120 ? routeBetween(actor.position, end, actor, actors) : null;
    if (route && pathLength(route) <= 1400) return {
      ...proposed, start: { ...actor.position }, end, waypoints: route, durationMs: Math.max(proposed.durationMs, Math.ceil(pathLength(route) / 32 * 1000)),
      targetId: tallCreature && end.y >= 950 ? "flower-foreground" : attempt || tallCreature ? "flower-meadow" : targetId,
      recentStops: [...actor.plan.recentStops, { ...end }].slice(-4),
    };
    previous = { ...previous, seedNext: proposed.seedNext, sequence: proposed.sequence };
  }
  const directions = [{ x: 80, y: 0 }, { x: -80, y: 0 }, { x: 0, y: 60 }, { x: 0, y: -60 }, { x: 40, y: 40 }, { x: -40, y: -40 }, { x: 40, y: -40 }, { x: -40, y: 40 }, { x: 24, y: 0 }, { x: -24, y: 0 }, { x: 0, y: 24 }, { x: 0, y: -24 }];
  for (let index = 0; index < directions.length; index++) {
    const direction = directions[(index + offset) % directions.length];
    const end = boundedPoint({ x: actor.position.x + direction.x, y: actor.position.y + direction.y }, actor);
    if (mustStayLower && end.y < 950) continue;
    if (distance(actor.position, end) < 18 || !clearSegment(end, end, actor, actors, true) || !clearSegment(actor.position, end, actor, actors, false)) continue;
    return {
      ...previous, phase, activity: "walk", start: { ...actor.position }, end, waypoints: [{ ...actor.position }, { ...end }], startedAt: nowMs,
      durationMs: Math.max(2000, Math.ceil(distance(actor.position, end) / 24 * 1000)), facing: end.x < actor.position.x ? "left" : end.x > actor.position.x ? "right" : actor.facing,
      targetId: "courtesy-yield", recentStops: [...actor.plan.recentStops, { ...end }].slice(-4),
    };
  }
  return null;
}

function initialCrowd(phase: ScenePhase, seed: number, timeMs: number, layout: HeaderCrowdLayout, actorIndices?: readonly number[]): HeaderCrowd {
  const actors = headerActors.map((actor, index) => {
    const position = { ...(phase === "night" && actor.category === "flying" ? headerAngelRest : (layout === "tall" ? tallHomePositions : homePositions)[index]) };
    const initial = nextHeaderBehavior(index, phase, undefined, seed, timeMs);
    return {
      id: actor.id, index, category: actor.category, position, origin: { x: actor.left, y: actor.top }, width: actor.width, height: actor.height,
      activity: initial.activity, facing: initial.facing,
      plan: { ...initial, start: { ...position }, end: { ...position }, waypoints: [{ ...position }, { ...position }], recentStops: [{ ...position }] },
      blockedMs: 0, retryAtMs: 0, distanceTravelled: 0, lastMovedAtMs: timeMs, layout, completedWalks: 0,
    };
  }).filter(actor => !actorIndices || actorIndices.includes(actor.index));
  return { actors, phase, seed, timeMs, remainderMs: 0, tick: 0, layout };
}

export function createHeaderCrowd(phase: ScenePhase, seed = 7091, layout: HeaderCrowdLayout = "standard", actorIndices?: readonly number[]): HeaderCrowd {
  return initialCrowd(phase, Number.isFinite(seed) ? Math.trunc(seed) : 7091, 0, layout, actorIndices);
}

export function advanceHeaderCrowd(world: HeaderCrowd, deltaMs: number, phase: ScenePhase = world.phase): HeaderCrowd {
  const elapsed = Number.isFinite(deltaMs) ? clamp(deltaMs, 0, 60_000) : 0;
  if ((phase === "night") !== (world.phase === "night")) world = initialCrowd(phase, world.seed, world.timeMs, world.layout, world.actors.map(actor => actor.index));
  if (!elapsed && phase === world.phase) return world;
  const next: HeaderCrowd = { ...world, phase, actors: world.actors.map(actor => ({ ...actor, position: { ...actor.position }, plan: { ...actor.plan, phase } })) };
  if (phase === "night") return { ...next, timeMs: next.timeMs + elapsed };
  next.remainderMs += elapsed;
  while (next.remainderMs >= STEP_MS) {
    next.remainderMs -= STEP_MS;
    next.timeMs += STEP_MS;
    next.tick++;
    const priority = [...next.actors].sort((first, second) => first.lastMovedAtMs - second.lastMovedAtMs || (first.index + next.tick) % next.actors.length - (second.index + next.tick) % next.actors.length);
    for (const actor of priority) {
      if (actor.plan.activity !== "walk" && next.timeMs >= actor.plan.startedAt + actor.plan.durationMs) {
        const walk = selectWalk(actor, next.actors, phase, next.timeMs);
        if (walk) { actor.plan = walk; actor.activity = "walk"; actor.blockedMs = 0; }
        else { actor.plan.startedAt += 900; actor.activity = "idle"; }
      }
      if (actor.plan.activity !== "walk") continue;
      if (next.timeMs < actor.retryAtMs) {
        actor.plan.startedAt += STEP_MS;
        actor.blockedMs += STEP_MS;
        actor.activity = "idle";
        continue;
      }
      if (actor.blockedMs >= 900) {
        actor.plan = { ...actor.plan, activity: "idle", start: { ...actor.position }, end: { ...actor.position }, waypoints: [{ ...actor.position }, { ...actor.position }], startedAt: next.timeMs, durationMs: 500 };
        actor.activity = "idle";
        actor.blockedMs = 0;
        actor.retryAtMs = 0;
        continue;
      }
      const proposed = boundedPoint(positionAt(actor.plan, next.timeMs), actor);
      const lastLowerResident = canUseForeground(actor) && actor.position.y >= 950 && proposed.y < 950 && !lowerResidents(next.actors).some(other => other.index !== actor.index);
      const occupied = next.actors.some(other => other.index !== actor.index && overlapping(proposed, actor, other.position, other));
      if (occupied || lastLowerResident || !clearSegment(actor.position, proposed, actor, next.actors, false)) {
        actor.plan.startedAt += STEP_MS;
        actor.blockedMs += STEP_MS;
        actor.retryAtMs = next.timeMs + 360 + actor.index * 43;
        actor.activity = "idle";
        continue;
      }
      const travel = distance(actor.position, proposed);
      if (Math.abs(proposed.x - actor.position.x) > .001) actor.facing = proposed.x < actor.position.x ? "left" : "right";
      actor.position = proposed;
      actor.distanceTravelled += travel;
      if (travel > .001) actor.lastMovedAtMs = next.timeMs;
      actor.activity = "walk";
      actor.blockedMs = 0;
      if (next.timeMs >= actor.plan.startedAt + actor.plan.durationMs) {
        if (actor.plan.targetId !== "courtesy-yield") actor.completedWalks++;
        actor.plan = nextHeaderBehavior(actor.index, phase, actor.plan, actor.plan.seedNext, next.timeMs);
        actor.activity = actor.plan.activity;
      }
    }
  }
  return next;
}
