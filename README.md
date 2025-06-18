# 🦢 TheLastOfGuss – Backend

This is the backend for **TheLastOfGuss**, a tap-based multiplayer goose game.

---
## ✨ Features

- **Stateless Backend**  
  The server is completely stateless — all user identification is handled via JWT cookies, allowing horizontal scaling without session management.

- **Tap Caching with Buffering**  
  User taps during a round are not written to the database immediately. Instead, they are buffered in memory and flushed periodically to reduce database load and allow high-frequency interactions.

- **Safe Concurrent Upserts (PostgreSQL)**  
  Tap counts and round participation are stored via atomic PostgreSQL upserts using `INSERT ... ON CONFLICT DO UPDATE`, ensuring safe concurrent updates with no data loss.

- **Round Status Handling**  
  Round status (`waiting`, `cooldown`, `active`, `finished`) is computed dynamically from timestamps, requiring no background jobs.

- **Minimal Dependencies**  
  The backend is built using Fastify, Prisma, and native Node.js modules — no heavy frameworks involved.
  
## ⚙️ Setup

### 1. Clone the repo and prepare environment

```bash
cp .env.example .env
```

Edit `.env` if you want to use a custom PostgreSQL connection string (`DATABASE_URL`).

---

### 2. Start PostgreSQL (Docker)

You can spin up a local database using Docker:

```bash
docker-compose up -d
```

---

### 3. Install dependencies

```bash
npm ci
```

---

### 4. Start the server

```bash
npm run dev
```

The server will run on [http://localhost:3000](http://localhost:3000)

---

## 🗄️ Database

- Uses **PostgreSQL**
- Database URL is configured via the `.env` file
- Prisma is used as the ORM — you can introspect or migrate schemas as needed

---

## 📁 Project structure

```
.
├── prisma/              # Prisma schema and migrations
├── src/                 # Source code
│   ├── db.ts            # Prisma client setup
│   ├── auth.ts          # Auth routes
│   ├── rounds.ts        # Round logic and tap tracking
│   ├── round-cache.ts   # Round cache logic
│   ├── tap-buffer.ts    # Tap buffer logic
│   └── ...
├── .env.example         # Environment variable template
└── docker-compose.yml   # Local PostgreSQL & pgAdmin setup
```

---

## 🧪 Scripts

- `npm run build` — build
- `npm start` — run the server (compiled js)
- `npm run dev` — (if configured) development mode with hot reload (ts)
- `npx prisma migrate dev` — run local DB migrations

---

## ✅ Requirements

- Node.js 18+
- PostgreSQL (local or Docker)
