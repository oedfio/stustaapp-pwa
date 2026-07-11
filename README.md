# StuStaApp

A Progressive Web App for residents of Studentenstadt München (StuSta) to discover and follow events from the dorm's organisations and clubs. Installable to a phone's home screen like a native app, no App Store required.

**Live**: [stustaapp.stusta.mhn.de](https://stustaapp.stusta.mhn.de)

For the full architecture, data model, and API reference, see [project_guide.md](project_guide.md).

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + Alembic + PostgreSQL + Redis
- **Frontend**: React 19 + Vite, PWA via `vite-plugin-pwa`, icons via `lucide-react`
- **Auth**: passwordless email OTP → JWT
- **Notifications**: Web Push (VAPID) + an in-app notification center (bell icon, `/notifications`), plus a dev-admin broadcast-to-everyone endpoint
- **Descriptions**: event/org descriptions render as a restricted Markdown subset (bold, italic, links, lists)
- **Onboarding**: first-visit welcome modal + a `/guide` walkthrough page (install steps, tabs, admin roles)
- **Server**: Debian VM, Nginx, systemd — no Docker in production

## Running locally

Postgres and Redis run via Docker Compose; the backend and frontend run natively.

```bash
# 1. Start Postgres + Redis
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.local.example .env.local   # then fill in values, see below
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the local backend automatically.

`backend/.env.local` is gitignored and needed for local dev — it overrides production's `backend/.env` without touching it. At minimum you need `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, and a VAPID keypair (dummy values will crash push notifications, but everything else works fine without real ones). Setting `ENVIRONMENT=local` skips real OTP emails and logs the code to the console instead — there's no route to the production mail relay from a laptop. Set `MEDIA_ROOT=../media` so uploaded logos/photos are read from the repo's own `media/` folder instead of a `/srv/stustaapp/media` path that doesn't exist on a laptop.

Full local setup details (Docker Compose, `.env.local` reference, generating a local VAPID keypair, why the frontend needs no config) are in **[project_guide.md §6 — Local Development](project_guide.md#6-local-development)**.

## Deployment

Deploys are git-based: the server pulls from GitHub over HTTPS and runs `deploy.sh`, which reinstalls dependencies, runs migrations, rebuilds the frontend, and restarts the service. See [project_guide.md §8](project_guide.md#8-quick-reference) for the exact commands, and [project_guide.md §5](project_guide.md#5-server-infrastructure) for server layout.

```bash
# On the server, from /srv/stustaapp
./deploy.sh
```

## What NOT to commit

`.env`, `.env.local`, `venv/`, `node_modules/`, `dist/`, `logs/`, `*.log`, `__pycache__/`, `media/logos/`, `media/events/` — all gitignored. The last two are user-uploaded content (org logos, event photos), not source — they're populated at runtime via the upload API, not by deploys, so tracking them in git was always just a stale snapshot. `media/legend.jpg` is the one exception, since it's a real static asset the app references directly. Everything else, including `docker-compose.dev.yml`, `deploy.sh`, and `frontend/.env.production`, is safe to commit (no real secrets).

## Known limitations

- **Event recurrence is a display label, not a real series.** Marking an event "weekly" shows a badge but doesn't generate future occurrences — each `Event` row is a single date. See [project_guide.md §3](project_guide.md#3-data-model) for details and what a real fix would involve.
- **TUM email delivery**: OTP emails via `mail.stusta.de` are sometimes dropped for `tum.de` recipients — likely an SPF/DKIM/DMARC alignment issue on the receiving end.
