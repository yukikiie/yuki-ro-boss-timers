import { bossCatalog } from "./boss-catalog.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HKT_OFFSET = 8 * HOUR;
const MAX_OVERDUE = 15 * 60 * 1000;
const MAX_BOSSES = 30;
const VALID_STATUSES = new Set(["unknown", "counting", "due", "resting", "paused"]);
const VALID_SOURCES = new Set(["manual", "kill"]);

function checkedTime(now) {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000) {
    throw new Error("Invalid timestamp.");
  }
  return now;
}

export function scheduleAt(now) {
  checkedTime(now);
  const localDay = Math.floor((now + HKT_OFFSET) / DAY) * DAY;
  const localTime = (now + HKT_OFFSET) % DAY;
  const cycleDay = localTime < 5 * HOUR ? localDay - DAY : localDay;
  const cycleStart = cycleDay + 5 * HOUR - HKT_OFFSET;
  return {
    cycle: new Date(cycleDay).toISOString().slice(0, 10),
    resting: localTime >= 3 * HOUR && localTime < 5 * HOUR,
    nextReset: cycleStart + DAY,
    restStart: cycleStart + 22 * HOUR,
  };
}

function emptyBoss(id, name, kind, favorite, cycle, status = "unknown") {
  return {
    id,
    name,
    kind,
    favorite,
    status,
    dueAt: null,
    observedAt: null,
    cycle,
    source: null,
    respawnMinutes: kind === "MVP" ? 180 : 120,
  };
}

export function defaultBosses(now) {
  const schedule = scheduleAt(now);
  const status = schedule.resting ? "resting" : "unknown";
  return bossCatalog.map((boss) => emptyBoss(boss.id, boss.name, boss.kind, boss.favorite, schedule.cycle, status));
}

function validName(name) {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 60;
}

function validKind(kind) {
  return kind === "MVP" || kind === "Mini";
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function normalizeBosses(bosses, now) {
  const schedule = scheduleAt(now);
  if (!Array.isArray(bosses)) return [];
  const seen = new Set();
  const normalized = [];
  for (const input of bosses.slice(0, MAX_BOSSES)) {
    if (!input || typeof input !== "object" || !validName(input.name) || !validKind(input.kind)) continue;
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(input.id) || seen.has(input.id)) continue;
    seen.add(input.id);
    const boss = emptyBoss(input.id, input.name.trim(), input.kind, input.favorite === true, schedule.cycle);
    if (schedule.resting) {
      boss.status = "resting";
      normalized.push(boss);
      continue;
    }
    if (input.cycle !== schedule.cycle || !VALID_STATUSES.has(input.status)) {
      normalized.push(boss);
      continue;
    }
    if (input.status === "resting" || input.status === "paused" || input.status === "unknown") {
      boss.status = input.status;
      normalized.push(boss);
      continue;
    }
    const duration = input.dueAt - input.observedAt;
    const cycleStart = schedule.nextReset - DAY;
    const validTimer = validTimestamp(input.dueAt)
      && validTimestamp(input.observedAt)
      && input.observedAt >= cycleStart
      && input.observedAt <= now
      && duration > 0
      && duration <= DAY
      && input.dueAt < schedule.restStart
      && now - input.dueAt <= MAX_OVERDUE
      && VALID_SOURCES.has(input.source)
      && (input.source !== "kill" || duration === boss.respawnMinutes * 60 * 1000);
    if (validTimer) {
      boss.dueAt = input.dueAt;
      boss.observedAt = input.observedAt;
      boss.source = input.source;
      boss.status = input.dueAt <= now ? "due" : "counting";
    }
    normalized.push(boss);
  }
  return normalized;
}

function customId(name, kind, bosses) {
  let hash = 2_166_136_261;
  for (const character of `${kind}:${name}`) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16_777_619) >>> 0;
  }
  const prefix = `custom-${hash.toString(36)}`;
  let id = prefix;
  let suffix = 2;
  while (bosses.some((boss) => boss.id === id)) {
    id = `${prefix}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function updateBoss(bosses, action, now) {
  const schedule = scheduleAt(now);
  const normalized = normalizeBosses(bosses, now);
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new Error("Invalid boss action.");
  }
  if (action.type === "add") {
    if (!validName(action.name) || !validKind(action.kind)) throw new Error("請輸入 1–60 字的名稱，並選擇 MVP 或 Mini。");
    if (normalized.length >= MAX_BOSSES) throw new Error("最多可追蹤 30 隻 Boss。");
    const name = action.name.trim();
    if (normalized.some((boss) => boss.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error("這隻 Boss 已在清單中。");
    }
    return [...normalized, emptyBoss(customId(name, action.kind, normalized), name, action.kind, false, schedule.cycle, schedule.resting ? "resting" : "unknown")];
  }
  const selected = normalized.find((boss) => boss.id === action.bossId);
  if (!selected) throw new Error("找不到這隻 Boss。");
  if (action.type === "remove") return normalized.filter((boss) => boss.id !== selected.id);
  let updated = { ...selected };
  if (action.type === "favorite") {
    if (typeof action.favorite !== "boolean") throw new Error("Invalid favorite value.");
    updated.favorite = action.favorite;
  } else if (action.type === "resting" || action.type === "clear") {
    updated = emptyBoss(selected.id, selected.name, selected.kind, selected.favorite, schedule.cycle, action.type === "resting" || schedule.resting ? "resting" : "unknown");
  } else if (action.type === "countdown" || action.type === "kill") {
    if (schedule.resting) throw new Error("每日香港時間 03:00–05:00 為休息時段，請於 05:00 更新後確認 Boss。");
    if (action.type === "countdown" && (!Number.isInteger(action.seconds) || action.seconds < 1 || action.seconds > 86_400)) {
      throw new Error("倒數必須為 1–86400 秒。");
    }
    const duration = action.type === "kill" ? selected.respawnMinutes * 60 * 1000 : action.seconds * 1000;
    const dueAt = now + duration;
    if (dueAt >= schedule.restStart) throw new Error("倒數會進入 03:00 休息時段；請等每日更新後重新確認，不會推算隔日重生。");
    updated = { ...selected, status: "counting", dueAt, observedAt: now, cycle: schedule.cycle, source: action.type === "kill" ? "kill" : "manual" };
  } else {
    throw new Error("Unknown boss action.");
  }
  return normalized.map((boss) => boss.id === selected.id ? updated : boss);
}

export function upcomingBosses(bosses, now) {
  return normalizeBosses(bosses, now)
    .filter((boss) => boss.status === "counting" && boss.dueAt !== null && boss.observedAt !== null && boss.dueAt > now)
    .sort((first, second) => first.dueAt - second.dueAt);
}

function remainingTime(duration) {
  const seconds = Math.max(0, Math.ceil(duration / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${seconds} 秒`;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分鐘`;
}

function contextName(name) {
  const characters = Array.from(name);
  return characters.length > 24 ? `${characters.slice(0, 24).join("")}…` : name;
}

function upcomingContext(bosses, now) {
  const [first, next] = bosses;
  if (!first) return "目前沒有其他已確認的未來倒數。";
  const destination = `行程：先前往 ${contextName(first.name)}（剩 ${remainingTime(first.dueAt - now)}）`;
  if (!next) return `${destination}。`;
  const gap = next.dueAt - first.dueAt;
  if (gap <= 300_000) {
    const interval = gap === 0 ? "同時重生" : `相隔 ${remainingTime(gap)}`;
    return `${destination}；接著準備 ${contextName(next.name)}（剩 ${remainingTime(next.dueAt - now)}；${interval}）。`;
  }
  return `${destination}；下一隻 ${contextName(next.name)}（剩 ${remainingTime(next.dueAt - now)}）。`;
}

export function reminderCandidates(bosses, now) {
  const normalized = normalizeBosses(bosses, now);
  const context = upcomingContext(upcomingBosses(normalized, now), now);
  const candidates = [];
  for (const boss of normalized) {
    if ((boss.status !== "counting" && boss.status !== "due") || boss.dueAt === null || boss.observedAt === null) continue;
    const remaining = boss.dueAt - now;
    let threshold;
    if (remaining <= 0 && remaining >= -120_000) threshold = 0;
    else if (remaining > 0 && remaining <= 60_000) threshold = 60;
    else if (remaining > 60_000 && remaining <= 300_000) threshold = 300;
    else if (remaining > 300_000 && remaining <= 600_000) threshold = 600;
    else continue;
    const title = threshold === 0 ? `${boss.name} · 重生時間到` : `${boss.name} · ${threshold / 60} 分鐘提醒`;
    const description = threshold === 0
      ? `${boss.kind} ${boss.name} 的已確認倒數已結束，請確認遊戲中的 Boss 狀態。`
      : `${boss.kind} ${boss.name} 的已確認倒數剩餘 ${remainingTime(remaining)}，請準備。`;
    candidates.push({
      bossId: boss.id,
      cycleKey: `${boss.cycle}:${boss.id}:${boss.dueAt}:${boss.observedAt}`,
      threshold,
      title,
      message: `${description} ${context}`,
      dueAt: boss.dueAt,
    });
  }
  return candidates.sort((first, second) => first.dueAt - second.dueAt);
}
