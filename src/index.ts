import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { authRoutes } from './auth.js';
import { roundRoutes } from './rounds.js';

dotenv.config();

const app = Fastify();

// Плагины
app.register(cookie);
app.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret', // для тестов
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

app.addHook('preHandler', async (req, res) => {
  try {
    const decoded = await req.jwtVerify<{ id: string; username: string }>();
    req.userEntry = decoded;
  } catch {
    // без токена можно заходить на /login, остальное — нужно проверять в маршрутах
  }
});

// Роуты
app.register(authRoutes, { prefix: '/auth' });
app.register(roundRoutes, { prefix: '/rounds' });

// Старт сервера
const PORT = Number(process.env.PORT || 3000);
app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`Server running on port ${PORT}`);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
