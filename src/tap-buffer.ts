import { prisma } from './db.js';

const TAP_BLOCK_SIZE = Number(process.env.TAP_BLOCK_SIZE || 10);
const TAP_BLOCK_TTL_MS = Number(process.env.TAP_BLOCK_TTL_MS || 1000);

type TapKey = string; // `${roundId}_${userId}`

type TapBufferEntry = {
  count: number;
  updatedAt: number; // timestamp
};

const buffer = new Map<TapKey, TapBufferEntry>();
const roundFlushTimers = new Map<string, NodeJS.Timeout>();

function makeKey(roundId: string, userId: string): TapKey {
  return `${roundId}_${userId}`;
}

export async function bufferTap(roundId: string, userId: string, count: number) {
  await ensureFlushScheduled(roundId);

  const key = makeKey(roundId, userId);
  const existing = buffer.get(key);

  const now = Date.now();
  const newCount = (existing?.count || 0) + count;

  if (newCount >= TAP_BLOCK_SIZE) {
    buffer.delete(key);

    await prisma.userTap.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId, tapCount: newCount },
      update: { tapCount: { increment: newCount } },
    });
  } else {
    buffer.set(key, { count: newCount, updatedAt: now });
  }
}

export async function flushTapsByRound(roundId: string) {
  const entries = Array.from(buffer.entries()).filter(([key]) =>
    key.startsWith(`${roundId}_`)
  );

  for (const [key] of entries) {
    buffer.delete(key);
  }

  await Promise.all(entries.map(([key, entry]) => {
    const [, userId] = key.split('_');
    return prisma.userTap.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId, tapCount: entry.count },
      update: { tapCount: { increment: entry.count } },
    });
  }));
}

async function ensureFlushScheduled(roundId: string) {
  if (roundFlushTimers.has(roundId)) return;

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return;

  const now = Date.now();
  const delay = new Date(round.endAt).getTime() - now;
  if (delay <= 0) {
    await flushTapsByRound(roundId);
    return;
  }

  const timer = setTimeout(() => {
    flushTapsByRound(roundId);
    roundFlushTimers.delete(roundId);
  }, delay);

  roundFlushTimers.set(roundId, timer);
}

// 🕓 Таймер сброса по TTL
setInterval(async () => {
  const now = Date.now();
  const expired: [TapKey, TapBufferEntry][] = [];

  for (const [key, entry] of buffer.entries()) {
    if (now - entry.updatedAt >= TAP_BLOCK_TTL_MS) {
      expired.push([key, entry]);
      buffer.delete(key);
    }
  }

  await Promise.all(expired.map(([key, entry]) => {
    const [roundId, userId] = key.split('_');
    return prisma.userTap.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId, tapCount: entry.count },
      update: { tapCount: { increment: entry.count } },
    });
  }));
}, TAP_BLOCK_TTL_MS);
