import { prisma } from './db.js';

const TTL = Number(process.env.ROUND_CACHE_TTL_MS || 1000);

type RoundStatus = 'waiting' | 'active' | 'finished';

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

  if (cached && now - cached.updatedAt < TTL) {
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

export function getRoundStatus(start: Date | number, end: Date | number): RoundStatus {
  const now = Date.now();
  const s = typeof start === 'number' ? start : start.getTime();
  const e = typeof end === 'number' ? end : end.getTime();

  if (now < s) return 'waiting';
  if (now <= e) return 'active';
  return 'finished';
}
