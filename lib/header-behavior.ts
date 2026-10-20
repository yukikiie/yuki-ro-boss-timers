import type { ScenePhase } from "./scene-time";

export type HeaderPoint = { x: number; y: number };
export type HeaderActorState = {
  actorId: string;
  phase: ScenePhase;
  activity: "walk" | "idle" | "play" | "sleep";
  start: HeaderPoint;
  end: HeaderPoint;
  waypoints: HeaderPoint[];
  startedAt: number;
  durationMs: number;
  facing: "left" | "right";
  sequence: number;
  seedNext: number;
  targetId?: string;
  recentStops: HeaderPoint[];
};
export type ActorState = HeaderActorState;
export type HeaderActorCategory = "ground" | "person" | "flying";

export const headerActors = [
  { id: "purple-poring", left: 238, top: 686, width: 220, height: 168, category: "ground" },
  { id: "hat-poring", left: 601, top: 695, width: 177, height: 144, category: "ground" },
  { id: "blue-ghost", left: 1096, top: 754, width: 114, height: 110, category: "ground" },
  { id: "leaf-poring", left: 463, top: 814, width: 114, height: 106, category: "ground" },
  { id: "lunatic", left: 765, top: 833, width: 108, height: 100, category: "ground" },
  { id: "peco-chick", left: 95, top: 707, width: 100, height: 96, category: "ground" },
  { id: "novice", left: 774, top: 523, width: 143, height: 170, category: "person" },
  { id: "priest", left: 938, top: 565, width: 149, height: 189, category: "person" },
  { id: "pink-poring", left: 100, top: 510, width: 155, height: 125, category: "ground" },
  { id: "angel-poring", left: 1100, top: 330, width: 180, height: 135, category: "flying" },
  { id: "moonlight-cat", left: 460, top: 510, width: 130, height: 165, category: "ground" },
  { id: "alice-maid", left: 640, top: 490, width: 130, height: 175, category: "ground" },
] as const;

export const headerFlightLane = { left: 180, right: 1100, top: 330, bottom: 335 } as const;
export const headerAngelRest = { x: 1260, y: 590 } as const;

export const headerFlightStops = [
  { x: 180, y: 330, targetId: "air-cherry" },
  { x: 300, y: 335, targetId: "air-west" },
  { x: 420, y: 332, targetId: "air-castle-west" },
  { x: 540, y: 330, targetId: "air-castle" },
  { x: 660, y: 330, targetId: "air-gate" },
  { x: 780, y: 335, targetId: "air-castle-east" },
  { x: 900, y: 332, targetId: "air-banner" },
  { x: 1020, y: 335, targetId: "air-waterfall" },
  { x: 1100, y: 330, targetId: "air-east" },
] as const;

const meadowStops = [
  { x: 100, y: 650, targetId: "flower-west" },
  { x: 280, y: 670, targetId: "flower-cherry" },
  { x: 460, y: 650, targetId: "flower-signpost" },
  { x: 640, y: 680, targetId: "hat-poring" },
  { x: 820, y: 640, targetId: "novice" },
  { x: 1000, y: 680, targetId: "priest" },
  { x: 1120, y: 710, targetId: "flower-riverbank" },
  { x: 140, y: 795, targetId: "flower-west-low" },
  { x: 330, y: 825, targetId: "purple-poring" },
  { x: 530, y: 780, targetId: "leaf-poring" },
  { x: 730, y: 820, targetId: "lunatic" },
  { x: 930, y: 795, targetId: "flower-meadow" },
  { x: 1100, y: 820, targetId: "blue-ghost" },
] as const;

const peopleStops = [
  { x: 610, y: 540, targetId: "flower-castle-west" },
  { x: 720, y: 610, targetId: "flower-path" },
  { x: 840, y: 535, targetId: "novice" },
  { x: 960, y: 625, targetId: "priest" },
  { x: 1080, y: 555, targetId: "flower-castle-east" },
  { x: 640, y: 645, targetId: "hat-poring" },
  { x: 1020, y: 525, targetId: "flower-gate" },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function distance(start: HeaderPoint, end: HeaderPoint) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function seededRandom(seed: number) {
  let value = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
  if (!value) value = 0x6d2b79f5;
  return {
    next() {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      value >>>= 0;
      return value / 0x100000000;
    },
    get seed() { return value; },
  };
}

export function nextHeaderBehavior(actorIndex: number, phase: ScenePhase, previous: ActorState | undefined, seed: number, nowMs: number): HeaderActorState {
  if (!Number.isInteger(actorIndex) || actorIndex < 0 || actorIndex >= headerActors.length) throw new RangeError("Unknown header actor");
  const actor = headerActors[actorIndex];
  const last = previous?.actorId === actor.id ? previous : undefined;
  const startedAt = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const anchor = phase === "night" && actor.category === "flying" ? { ...headerAngelRest } : { x: actor.left, y: actor.top };
  if (phase === "night" && last?.activity === "sleep") return last;
  if (phase !== "night" && last && last.activity !== "sleep" && startedAt < last.startedAt + last.durationMs) return last.phase === phase ? last : { ...last, phase };

  const sequence = last ? last.sequence + 1 : 0;
  const random = seededRandom((last?.seedNext ?? seed) ^ Math.imul(actorIndex + 1, 0x9e3779b1) ^ sequence);
  const facing = last?.facing ?? (actorIndex === 2 ? "left" : "right");
  if (phase === "night") return {
    actorId: actor.id, phase, activity: "sleep", start: { ...anchor }, end: { ...anchor }, waypoints: [{ ...anchor }, { ...anchor }],
    startedAt, durationMs: 86_400_000, facing, sequence, seedNext: random.seed, recentStops: [{ ...anchor }],
  };

  const waking = !last || last.activity === "sleep";
  const start = waking ? anchor : { ...last.end };
  const recentStops = waking ? [{ ...anchor }] : last.recentStops.map(point => ({ ...point }));
  if (waking || last.activity === "walk") {
    const playing = !waking && random.next() < (phase === "afternoon" ? .58 : .42);
    const durationMs = playing ? Math.round(4000 + random.next() * 3000) : Math.round(2000 + random.next() * (phase === "afternoon" ? 3000 : 4000));
    return {
      actorId: actor.id, phase, activity: playing ? "play" : "idle", start, end: { ...start }, waypoints: [{ ...start }, { ...start }],
      startedAt, durationMs, facing, sequence, seedNext: random.seed, targetId: last?.targetId, recentStops,
    };
  }

  const people = actor.category === "person";
  const flying = actor.category === "flying";
  const limits = flying ? { minX: headerFlightLane.left, maxX: headerFlightLane.right, minY: headerFlightLane.top, maxY: headerFlightLane.bottom }
    : people ? { minX: 610, maxX: 1080, minY: 523, maxY: 650 }
    : { minX: 95, maxX: Math.min(1130, 1228 - actor.width), minY: actor.id === "pink-poring" || actor.id === "moonlight-cat" || actor.id === "alice-maid" ? 490 : 640, maxY: 833 };
  const previousStop = recentStops.length > 1 ? recentStops[recentStops.length - 2] : undefined;
  const targets = (flying ? headerFlightStops : people ? peopleStops : meadowStops).map(point => ({
    x: clamp(point.x, limits.minX, limits.maxX), y: clamp(point.y, limits.minY, limits.maxY), targetId: point.targetId,
  })).filter(point => distance(start, point) >= 200 && distance(start, point) <= 400 && point.targetId !== actor.id && (!previousStop || distance(previousStop, point) >= 72));
  const freshTargets = targets.filter(point => recentStops.every(stop => distance(stop, point) >= 72));
  const nonReturningTargets = targets.filter(point => !last || distance(last.start, point) >= 72);
  const options = freshTargets.length ? freshTargets : nonReturningTargets.length ? nonReturningTargets : targets;
  const fallback = {
    x: clamp(start.x + (start.x < (limits.minX + limits.maxX) / 2 ? 260 : -260), limits.minX, limits.maxX),
    y: clamp(start.y, limits.minY, limits.maxY), targetId: "meadow-path",
  };
  const target = options[Math.floor(random.next() * options.length)] ?? fallback;
  const end = { x: target.x, y: target.y };
  const waypoints = [{ ...start }];
  if (random.next() < .6) waypoints.push({
    x: clamp((start.x + end.x) / 2 + (random.next() - .5) * 28, limits.minX, limits.maxX),
    y: clamp((start.y + end.y) / 2 + (random.next() - .5) * 24, limits.minY, limits.maxY),
  });
  waypoints.push({ ...end });
  return {
    actorId: actor.id, phase, activity: "walk", start, end, waypoints, startedAt,
    durationMs: Math.round((phase === "afternoon" ? 8000 : 10_000) + random.next() * 5000),
    facing: end.x < start.x ? "left" : "right", sequence, seedNext: random.seed, targetId: target.targetId,
    recentStops: [...recentStops, { ...end }].slice(-4),
  };
}
