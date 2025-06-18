import { prisma } from './db.js';

const ROUND_CACHE_TTL_MS = Number(process.env.ROUND_CACHE_TTL_MS || 1000);
const COOLDOWN_DURATION_SEC = Number(process.env.COOLDOWN_DURATION_SEC || 30) * 1000;

interface CachedRound {
  id: string;
  startAt: number;
  endAt: number;
  status: RoundStatus;
  updatedAt: number;
}

const cache = new Map<string, CachedRound>();

export async function getRoundCached(id: string): Promise<CachedRound | null> {
  const now = Date.now();
  const cached = cache.get(id);

  if (cached && now - cached.updatedAt < ROUND_CACHE_TTL_MS) {
    return cached;
  }

  const round = await prisma.round.findUnique({ where: { id } });
  if (!round) return null;

  const start = round.startAt.getTime();
  const end = round.endAt.getTime();
  const status = getRoundStatus(start, end);

  const result: CachedRound = {
    id: round.id,
    startAt: start,
    endAt: end,
    status,
    updatedAt: now,
  };

  cache.set(id, result);
  return result;
}

export type RoundStatus = 'waiting' | 'cooldown' | 'active' | 'finished';

export function getRoundStatus(start: Date | number, end: Date | number): RoundStatus {
  const now = Date.now();
  const s = typeof start === 'number' ? start : start.getTime();
  const e = typeof end === 'number' ? end : end.getTime();

  if (now < s - COOLDOWN_DURATION_SEC) return 'waiting';
  if (now < s) return 'cooldown';
  if (now <= e) return 'active';
  return 'finished';
}