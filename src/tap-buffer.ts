import { prisma } from './db.js';

const BLOCK_SIZE = Number(process.env.TAP_BLOCK_SIZE || 10);

type TapKey = string; // `${roundId}_${userId}`

const buffer = new Map<TapKey, number>();

function makeKey(roundId: string, userId: string): TapKey {
  return `${roundId}_${userId}`;
}

export async function bufferTap(roundId: string, userId: string, count: number) {
  const key = makeKey(roundId, userId);
  const prev = buffer.get(key) || 0;
  const next = prev + count;

  if (next >= BLOCK_SIZE) {
    // Флашим в БД
    buffer.delete(key);

    await prisma.userTap.upsert({
      where: {
        roundId_userId: {
          roundId,
          userId,
        },
      },
      create: {
        roundId,
        userId,
        tapCount: next,
      },
      update: {
        tapCount: {
          increment: next,
        },
      },
    });
  } else {
    buffer.set(key, next);
  }
}

// опционально: flush all (при завершении или shutdown)
export async function flushAllTaps() {
  const entries = Array.from(buffer.entries());
  buffer.clear();

  await Promise.all(entries.map(([key, count]) => {
    const [roundId, userId] = key.split('_');
    return prisma.userTap.upsert({
      where: {
        roundId_userId: {
          roundId,
          userId,
        },
      },
      create: {
        roundId,
        userId,
        tapCount: count,
      },
      update: {
        tapCount: {
          increment: count,
        },
      },
    });
  }));
}
