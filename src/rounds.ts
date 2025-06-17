import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { getRoundCached, getRoundStatus } from './round-cache.js';
import { bufferTap } from './tap-buffer.js';

const roundDuration = Number(process.env.ROUND_DURATION || 60) * 1000;
const cooldownDuration = Number(process.env.COOLDOWN_DURATION || 30) * 1000;

function getRole(username: string): 'admin' | 'nikita' | 'user' {
  if (username === 'admin') return 'admin';
  if (username === 'Никита') return 'nikita';
  return 'user';
}

function calcScore(taps: number): number {
  return Math.floor(taps / 11) * 10 + (taps % 11);
}

export async function roundRoutes(app: FastifyInstance) {
  // Получить все раунды
  app.get('/', async () => {
    return prisma.round.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // Создать раунд (только admin)
  app.post('/', async (req, res) => {
    if (!req.userEntry) return res.status(401).send({ error: 'Unauthorized' });
    if (getRole(req.userEntry.username) !== 'admin') {
      return res.status(403).send({ error: 'Only admin can create rounds' });
    }

    const { startAt, endAt } = req.body as {
      startAt: string;
      endAt: string;
    };

    if (!startAt || !endAt) {
      return res.status(400).send({ error: 'startAt and endAt required' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).send({ error: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).send({ error: 'startAt must be before endAt' });
    }

    if (start < now || end < now) {
      return res.status(400).send({ error: 'startAt and endAt must be in the future' });
    }

    // Проверка на пересечение с существующими раундами
    const overlapping = await prisma.round.findFirst({
      where: {
        OR: [
          {
            startAt: { lt: end },
            endAt: { gt: start },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(409).send({ error: 'Round time overlaps with existing round' });
    }

    const round = await prisma.round.create({
      data: {
        startAt: start,
        endAt: end,
      },
    });

    return res.send(round);
  });

  // Инфо по раунду
  app.get('/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    const round = await prisma.round.findUnique({ where: { id } });
    if (!round) return res.status(404).send({ error: 'Round not found' });

    const status = getRoundStatus(round.startAt, round.endAt);

    let myScore = 0;
    let topUser = null;

    if (status === 'finished') {
      const taps = await prisma.userTap.findMany({
        where: { roundId: id },
        orderBy: { tapCount: 'desc' },
        include: { User: true },
      });

      const isNikita = req.user && getRole(req.userEntry.username) === 'nikita';

      for (const t of taps) {
        if (req.userEntry && t.userId === req.userEntry.id) {
          myScore = isNikita ? 0 : calcScore(t.tapCount);
        }

        if (!topUser && getRole(t.User.username) !== 'nikita') {
          topUser = {
            username: t.User.username,
            score: calcScore(t.tapCount),
          };
        }
      }
    }

    return res.send({ ...round, status, myScore, topUser });
  });

  // Тап по гусю
  app.post('/:id/tap', async (req, res) => {
    const { id } = req.params as { id: string };
    if (!req.user) return res.status(401).send({ error: 'Unauthorized' });

    const round = await getRoundCached(id);
    if (!round) return res.status(404).send({ error: 'Round not found' });

    if (round.status !== 'active') {
      return res.status(400).send({ error: 'Round not active' });
    }

    const role = getRole(req.userEntry.username);
    const count = (role === 'nikita') ? 0 : 1;

    if (count > 0) {
      await bufferTap(id, req.userEntry.id, count);
    }

    return res.send({ ok: true });
  });

  app.delete('/', async (req, res) => {
    if (!req.userEntry) return res.status(401).send({ error: 'Unauthorized' });
    if (getRole(req.userEntry.username) !== 'admin') {
      return res.status(403).send({ error: 'Only admin can delete rounds' });
    }

    await prisma.userTap.deleteMany(); // удалить связанные записи
    await prisma.round.deleteMany();

    return res.send({ ok: true });
  });
  app.delete('/:id', async (req, res) => {
    if (!req.userEntry) return res.status(401).send({ error: 'Unauthorized' });
    if (getRole(req.userEntry.username) !== 'admin') {
      return res.status(403).send({ error: 'Only admin can delete rounds' });
    }

    const { id } = req.params as { id: string };

    try {
      await prisma.round.delete({ where: { id } });
      return res.send({ ok: true });
    } catch (err) {
      return res.status(404).send({ error: 'Round not found' });
    }
  });
}
