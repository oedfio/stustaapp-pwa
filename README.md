# StuStaApp

A Progressive Web App for residents of Studentenstadt München (StuSta) to discover and follow events from the dorm's organisations and clubs. Installable to a phone's home screen like a native app, no App Store required.

**Live**: [stustaapp.stusta.mhn.de](https://stustaapp.stusta.mhn.de)

For the full architecture, data model, and API reference, see [project_guide.md](project_guide.md).

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + Alembic + PostgreSQL + Redis
- **Frontend**: React 19 + Vite, PWA via `vite-plugin-pwa`
- **Auth**: passwordless email OTP → JWT
- **Push notifications**: Web Push (VAPID) for new events and event-start reminders
- **Server**: Debian VM, Nginx, systemd — no Docker in production

## Deployment

Deploys are git-based: the server pulls this repo over HTTPS and runs `deploy.sh`, which reinstalls dependencies, runs migrations, rebuilds the frontend, and restarts the service.

```bash
# On the server, from /srv/stustaapp
./deploy.sh
```
which does, in order: `git pull` → `pip install -r backend/requirements.txt` → `alembic upgrade head` → `npm ci && npm run build` (frontend) → `chown -R stustaapp:stustaapp /srv/stustaapp` → `systemctl restart stustaapp`.

## Running locally

Postgres and Redis run via Docker Compose:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Backend needs a `backend/.env.local` (gitignored) with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, and a VAPID keypair (`config.py` loads `.env` then layers `.env.local` on top). From there:

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

> **Known limitation**: the frontend currently hardcodes its API base URL and all image/media URLs to the production domain (`https://stustaapp.stusta.mhn.de`), and the backend hardcodes uploaded-media paths to `/srv/stustaapp/media`. A local frontend/backend pair won't actually talk to each other yet — API calls and images still resolve against production regardless of what's running locally. Making local development fully self-contained (env-driven URLs, a local media mount, OTP codes logged instead of emailed) is a known gap, not yet fixed on this branch.

## What NOT to commit

`.env`, `.env.local`, `venv/`, `node_modules/`, `dist/`, `logs/`, `*.log`, `__pycache__/`, `CLAUDE.md`, `media/logos/`, `media/events/` — all gitignored. The last two are user-uploaded content (org logos, event photos), not source — they're populated at runtime via the upload API, not by deploys, so tracking them in git was always just a stale snapshot. `media/legend.jpg` is the one exception, since it's a real static asset the app references directly. Everything else, including `docker-compose.dev.yml` and `deploy.sh`, is safe to commit (no real secrets).

## Known limitations

- **Local development isn't fully self-contained yet** — see above.
- **Event recurrence is a display label, not a real series.** Marking an event "weekly" shows a badge but doesn't generate future occurrences — each `Event` row is a single date.
- **TUM email delivery**: OTP emails via `mail.stusta.de` are sometimes dropped for `tum.de` recipients — likely an SPF/DKIM/DMARC alignment issue on the receiving end.
