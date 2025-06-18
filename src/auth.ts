import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import bcrypt from 'bcrypt';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(400).send({ error: 'Username and password required' });
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      // Новый пользователь → создать
      const hashed = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: { username, passwordHash: hashed },
      });
    } else {
      // Уже есть → проверка пароля
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).send({ error: 'Invalid password' });
      }
    }

    // В payload сохраняем id + username
    const token = await res.jwtSign(
      { id: user.id, username: user.username },
      { expiresIn: '7d' }
    );

    res.setCookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res.send({ ok: true });
  });
  app.get('/whoami', async (req, res) => {
    if (!req.userEntry) return res.status(401).send({ error: 'Unauthorized' });
    return res.send(req.userEntry);
  });
}
