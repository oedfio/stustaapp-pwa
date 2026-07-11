# StuStaApp — Project Development Guide
**Studentenstadt München · 2025**

| | |
|---|---|
| Platform | Progressive Web App (PWA) |
| Backend | Python · FastAPI |
| Database | PostgreSQL + Redis |
| Hosting | StuSta VM · Debian · stustaapp.stusta.mhn.de |
| Timeline | ~14 weeks · 2–4 hours per week |
| Cost | Completely free |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Authentication](#2-authentication)
3. [Data Model](#3-data-model)
4. [Technology Stack](#4-technology-stack)
5. [Server Infrastructure](#5-server-infrastructure)
6. [Local Development](#6-local-development)
7. [Push Notifications & Notification Center](#7-push-notifications--notification-center)
8. [Development Timeline (historical)](#8-development-timeline-historical)
9. [Cost Breakdown](#9-cost-breakdown)
10. [Quick Reference](#10-quick-reference)

---

## 1. Project Overview

StuStaApp is a Progressive Web App built specifically for the residents of Studentenstadt (StuSta) in Munich. Its primary purpose is to serve as a central hub where residents can discover and follow events organised by the various organisations and clubs that operate within StuSta. The app is designed to be installed on a smartphone — just like a native app — but without requiring any App Store submission or installation process.

The app supports two broad categories of users: common residents who browse events, and admins who belong to organisations and manage event listings. There is also a developer admin role that has unrestricted access to the entire system.

### User Roles

The permission system has four levels. Roles are scoped per organisation — a user can be an org admin in one organisation and a boss admin in another at the same time. The only global roles are common user and dev admin.

| Role | Scope | What they can do |
|---|---|---|
| Common user | Global | Browse and view all events |
| Org admin | Per organisation | Create and manage events for that org. A user can hold this role in multiple orgs simultaneously. |
| Boss admin | Per organisation | Everything org admin can do, plus edit org info, upload logo, and invite/remove org admins. A user can hold this role in multiple orgs simultaneously. |
| Dev admin | All organisations | Superuser — unrestricted access to everything. Set via a flag on the user record, not a membership row. |

### What is a PWA?

A Progressive Web App is a website that behaves like a native mobile app. When a user visits stustaapp.stusta.mhn.de on their phone, the browser will prompt them to add the app to their home screen. Once installed it opens fullscreen with no browser chrome, can cache content for offline use, and can receive push notifications. This approach means you only need to build one app — not separate iOS and Android versions — and there is no App Store approval process to deal with.

> **Important:** PWAs require HTTPS to function. The browser will not allow installation over plain HTTP. Make sure SSL is configured before testing the PWA install flow.

### Onboarding

New users see a one-time welcome modal on first visit (`WelcomeModal.jsx`, gated by a `localStorage` flag) with a link into `/guide` (`Guide.jsx`) — a static walkthrough covering PWA install steps for Android/iOS, the main tabs, following orgs for notifications, and a role-specific "For Admins" section (Org Admin / Boss Admin / Dev Admin). Also linked from the Footer and Profile page for anyone who dismissed the modal and wants to revisit it.

---

## 2. Authentication

StuStaApp uses a passwordless email OTP (One-Time Password) flow. There are no passwords to store, no password reset flows to build, and no risk of password leaks.

### Step-by-step OTP Flow

| Step | What happens |
|---|---|
| 1. Enter email | User types their email address into the login screen and taps Send Code. |
| 2. Generate OTP | The backend generates a random 6-digit code and stores a SHA-256 hash of it in Redis with a 10-minute expiry (TTL). The raw code is never stored. |
| 3. Send email | The backend sends the code to the user's email via the StuSta SMTP server at mail.stusta.de on port 25 with TLS. This is completely free — no external email service needed. |
| 4. User submits | User enters the 6-digit code in the app. |
| 5. Verify | Backend hashes the submitted code and compares it to the stored hash. If it matches and has not expired, the code is deleted from Redis (one-time use only). |
| 6. Issue JWT | Backend creates a signed JWT (JSON Web Token) containing the user's ID and an expiry date, and returns it to the app. |
| 7. Authenticated | The app stores the JWT and sends it in the Authorization header of every subsequent request. The backend verifies the signature on each request to identify the user. |

### Why Redis for OTPs?

Redis is an in-memory key-value store. Storing OTPs there rather than in PostgreSQL has three concrete advantages. First, Redis has a built-in TTL (time to live) mechanism — when you store a key with `SETEX` you specify an expiry in seconds and Redis automatically deletes the key when it expires. This means expired OTPs are cleaned up without any cron jobs or scheduled tasks. Second, Redis lookups are extremely fast — O(1) in memory with no disk I/O. Third, after successful verification the key is deleted immediately, enforcing single-use semantics.

The key design in Redis:
```
Key:   otp:{email}         e.g.  otp:resident@gmail.com
Value: sha256(6_digit_code)
TTL:   600 seconds (auto-deleted by Redis after 10 minutes)
```

### Why JWTs?

A JWT is a self-contained token that encodes the user's identity and is cryptographically signed with a secret key known only to the server. When the client sends the token back on each request, the server verifies the signature — if it is valid, the server knows who the user is without needing to look anything up in the database for every request. The token contains an expiry timestamp so old tokens automatically become invalid.

---

## 3. Data Model

The application uses PostgreSQL as its primary database. The schema is kept intentionally simple.

### Table: users

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| email | text | Unique, used for login |
| first_name | text | Optional, editable via `PATCH /api/users/me` |
| last_name | text | Optional, editable via `PATCH /api/users/me` |
| is_dev_admin | boolean | True only for superusers |
| created_at | timestamp | Set automatically on insert |

### Table: organizations

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | text | Display name of the organisation |
| description | text | Short description |
| location_name | text | Human readable location e.g. "Egon's Underground, Haus 3" |
| latitude | float | Geographic coordinate |
| longitude | float | Geographic coordinate |
| logo_url | text | Path to the org logo image stored on the VM filesystem |

The frontend builds a Google Maps link from the coordinates — `https://www.google.com/maps?q={latitude},{longitude}` — so users can tap the location and get turn-by-turn navigation. No Google Maps API key is needed for this.

### Table: org_memberships

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| org_id | UUID FK | References organizations.id |
| role | enum | boss_admin or org_admin |
| created_at | timestamp | Set automatically |

### Table: events

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| org_id | UUID FK | References organizations.id |
| created_by | UUID FK | References users.id |
| title | text | Event title |
| description | text | Full description |
| starts_at | timestamp (tz-aware) | Event start date and time |
| ends_at | timestamp (tz-aware), nullable | Optional event end time. See [Event visibility rules](#event-visibility-rules) below for how a missing value is handled. |
| location | text | Location or room name |
| photo_url | text | Optional event photo stored on the VM filesystem. Automatically cleared ~30 days after the event ends — see [Media Cleanup](#media-cleanup) below |
| recurrence | enum | `none` / `weekly` / `biweekly` / `monthly` — **display label only**, see note below |
| start_notification_sent | boolean | Set once the "event starting now" push has been sent, so the scheduler doesn't resend it |

> **`recurrence` is metadata, not a real recurring series.** Each `Event` row is a single occurrence with one `starts_at`. Marking an event `weekly` shows a "🔁 Every week" badge in the UI, but the backend does **not** generate future occurrences — if you want the event to actually reappear every week, you currently have to create a new row each time. This is a known simplification, not a bug; a proper recurring-series implementation (a `recurrence_parent_id` + generated occurrences, or an `RRULE`-style expansion) would be the natural next step if this is worth building out.

> **`description` (and organizations' `description`) support Markdown.** The frontend renders them with `react-markdown`, restricted to a safe subset — bold, italic, links, lists. No raw HTML or headings/images; see `frontend/src/components/MarkdownText.jsx`.

#### Event visibility rules

`GET /api/events` and `GET /api/organizations/{id}/events` only return events happening in the next 7 days. An event is visible if:
- it hasn't ended yet (`ends_at >= now`), **or**
- it has no `ends_at` at all, in which case it's treated as lasting 24 hours from `starts_at` (so it doesn't vanish from the list the instant its start time passes, but also doesn't stay listed forever).

The **admin management view** (`GET /api/organizations/{id}/events/manage`, org-admin only) intentionally applies **no date filter** — it returns every event for the org, past and future, so admins can find and edit anything they've created regardless of when it happens. `EventsManager.jsx` on the frontend uses this endpoint, not the public one.

#### Media Cleanup

`cleanup_unused_media` (`app/tasks.py`, runs weekly via APScheduler) has two passes:

1. **`purge_old_event_photos()`** — for any event whose `ends_at` (or `starts_at` if it has no end time) is more than **30 days** in the past, deletes its photo file *and* clears `photo_url` in the same transaction. Without the DB-clearing half, an old event's page would show a broken image once the file is gone. Org logos are intentionally excluded — an org doesn't "end" the way an event does, so there's no equivalent retention window.
2. **Orphan sweep** — deletes any file in `media/logos/` or `media/events/` that isn't referenced by *any* row at all (covers deleted orgs/events, and old files left behind when a logo/photo gets replaced by a new upload).

Both passes only run once a week, so a deleted/replaced file can linger up to ~7 days before actually being removed from disk — this is expected, not a bug.

### Table: org_follows

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| org_id | UUID FK | References organizations.id |
| created_at | timestamp | Set automatically |

Lets a resident "follow" an organisation (`POST /api/organizations/{id}/follow` / `DELETE .../follow`) to receive push notifications when that org posts a new event. `GET /api/organizations/me/follows` lists the current user's follows.

### Table: push_subscriptions

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| endpoint | text | Unique — the browser's push service URL |
| p256dh | text | Public key for encrypting push payloads (Web Push spec) |
| auth | text | Auth secret for the push subscription |
| created_at | timestamp | Set automatically |

One row per browser/device subscription. See [Push Notifications & Notification Center](#7-push-notifications--notification-center) below.

### Table: notifications

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| title | text | Notification title |
| body | text | Notification body |
| url | text, nullable | Where tapping the notification navigates to |
| created_at | timestamp | Set automatically |
| read_at | timestamp, nullable | Null until the user marks it read |

The in-app notification center: whenever `send_push_to_all` fires (new event posted, event starting now, or a dev-admin broadcast), it writes one row per targeted user here — **regardless of whether that user has a push subscription** — so the bell icon and `/notifications` page work even for users who never granted browser notification permission. See [Push Notifications & Notification Center](#7-push-notifications--notification-center).

### How roles are stored

- **Dev admins** have `is_dev_admin = true` in the `users` table. They have no `org_memberships` row — they bypass all organisation checks.
- **Boss admins** have one row in `org_memberships` with `role = 'boss_admin'` per organisation they manage. A user can have multiple boss admin rows for different organisations. Boss admins can invite and remove **both** `org_admin` and `boss_admin` members within their own organisation(s) — this is not restricted to dev admins.
- **Org admins** have one row in `org_memberships` with `role = 'org_admin'` per organisation they belong to. A user can have multiple org admin rows for different organisations.
- **A user can mix roles across organisations** — for example, one row with `role = 'boss_admin'` for Egon's Underground and another row with `role = 'org_admin'` for Kade. Both rows belong to the same user.
- **Common users** have no row in `org_memberships` at all.

### Multi-device Support

A user can use StuStaApp on as many devices as they want — a phone, a tablet, a laptop — simultaneously. This works out of the box with no extra effort because the authentication is stateless.

When a user logs in on a second device they go through the OTP flow again, receive a new JWT, and that token is stored independently on that device. The backend does not track sessions or devices anywhere — it simply verifies the JWT signature on each request and does not care how many devices are doing so at the same time.

**Logout behaviour in v1:** Logging out on one device deletes the JWT from that device's local storage only. The JWT on other devices remains valid until it naturally expires (30 days). This is an intentional simplification for the first version — the security requirements for a student events app do not justify the added complexity of cross-device session management.

**Future optional addition — sessions table:** If you later want to support "log out all devices" or the ability to see and revoke individual device sessions, you can add a `sessions` table without changing anything else in the architecture:

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID FK | References users.id |
| token_hash | text | SHA-256 of the refresh token |
| device_hint | text | Optional — e.g. "iPhone", "Chrome on Linux" |
| created_at | timestamp | When this session was created |
| expires_at | timestamp | When this session expires |

With this table in place, logout would delete the row for that device, and "log out all devices" would delete all rows for that user. This is a self-contained addition that does not require changing the rest of the data model, the permission system, or any existing endpoints.

---

## 4. Technology Stack

Every component in the stack is open source and free. Nothing requires a paid licence or external account — including email, which goes through the StuSta SMTP server.

### Backend Libraries

| Library | Purpose |
|---|---|
| FastAPI | The web framework. Handles routing, request parsing, and automatic API documentation at /api/docs. |
| SQLAlchemy (async) | ORM — defines database tables as Python classes and translates queries to SQL. |
| asyncpg | The actual PostgreSQL driver. Async-native and very fast. |
| Alembic | Migration tool. Tracks schema changes and generates SQL scripts to apply them. |
| Pydantic v2 / pydantic-settings | Validates incoming request data, shapes outgoing responses, and loads `Settings` from `.env`/`.env.local`. |
| PyJWT | Creates and verifies JWT tokens for authentication. |
| redis-py (async) | Python client for Redis. Used to store and retrieve OTP hashes. |
| aiosmtplib | Async SMTP client. Sends OTP emails via mail.stusta.de port 25. |
| APScheduler | In-process job scheduler — runs `cleanup_unused_media` (weekly) and `send_event_start_notifications` (every 5 min). |
| pywebpush / py-vapid | Sends Web Push notifications and generates/handles VAPID key pairs. |
| uvicorn | ASGI server that runs the FastAPI application as a process. |

### Frontend Libraries

| Library | Purpose |
|---|---|
| React 19 | UI framework. |
| React Router | Client-side routing between pages/tabs. |
| Axios | HTTP client for talking to the backend API (`frontend/src/api/client.js`). |
| Vite | Dev server and production bundler. |
| vite-plugin-pwa + Workbox | Generates the service worker (`frontend/src/sw.js`), app manifest, and offline caching; also handles push/notificationclick events. |
| lucide-react | SVG icon set — every icon in the app (tab bar, buttons, badges) uses this instead of emoji. |
| react-markdown + remark-breaks | Renders event/org descriptions as a restricted Markdown subset (see §3). |

### Design System

The color palette (`#0064BC` primary, `#F2F2F7` backgrounds, `#1A1C1E`/`#555555` text, `#E3E3E4` borders) is deliberately sourced from [tum-dev/campus_flutter](https://github.com/tum-dev/campus_flutter)'s light theme (`lib/base/theme/constants.dart`), not invented from scratch — the intent is visual consistency with other TUM-affiliated student apps. There's no shared theme/tokens file yet; colors are still hardcoded per-component in inline style objects, so a future palette change means a project-wide find-and-replace rather than editing one file.

The app icon (`frontend/public/favicon.svg`, rasterized to `pwa-192x192.png`/`pwa-512x512.png`) is a hand-authored SVG recreation of the original PNG mark — four diagonal stripes in a rounded square, transparent outside it (not a flattened white background, which is what a naive screenshot-based rasterization produces).

### Infrastructure

| Component | Role |
|---|---|
| PostgreSQL | Primary relational database. Stores users, organisations, memberships, events, follows, push subscriptions. |
| Redis | In-memory store for OTP codes. Auto-expiry via TTL means no cleanup needed. |
| Nginx | Reverse proxy. Forwards /api/* to FastAPI and serves the React app as static files. |
| certbot | Tool that obtains free SSL certificates from Let's Encrypt (a non-profit Certificate Authority trusted by all browsers) and auto-renews them before expiry. Required because PWAs only work over HTTPS and because sensitive data like OTP codes must be encrypted in transit. |
| systemd | Process manager. Keeps FastAPI running, restarts it on crash, starts it on boot. |
| React PWA | Frontend. Served as static files by Nginx. Installed on phone via browser prompt. |

### Permission Dependency Chain

The permission system in FastAPI is implemented as a chain of reusable dependencies. Each endpoint declares which dependency it requires and FastAPI enforces it automatically:

```python
# dependencies.py

async def get_current_user(token, db) -> User:
    # Decode JWT → fetch user from DB → return User or raise HTTP 401
    ...

async def require_dev_admin(user = Depends(get_current_user)) -> User:
    if not user.is_dev_admin:
        raise HTTPException(403)
    return user

async def require_boss_admin(org_id, user = Depends(get_current_user), db) -> User:
    if user.is_dev_admin:
        return user  # dev admins pass everything
    membership = await get_membership(db, user.id, org_id)
    if not membership or membership.role != "boss_admin":
        raise HTTPException(403)
    return user

async def require_org_admin(org_id, user = Depends(get_current_user), db) -> User:
    if user.is_dev_admin:
        return user
    membership = await get_membership(db, user.id, org_id)
    if not membership or membership.role not in ("boss_admin", "org_admin"):
        raise HTTPException(403)
    return user
```

Then in the routers it becomes very clean:

```python
@router.post("/organizations/{org_id}/events")
async def create_event(
    org_id: UUID,
    payload: EventCreate,
    user: User = Depends(require_org_admin),  # enforced here
    db: AsyncSession = Depends(get_db),
):
    ...
```

---

## 5. Server Infrastructure

### Virtual Machine Specs

| Property | Value |
|---|---|
| OS | Debian Linux |
| CPU | 4 vCPUs (QEMU/KVM) |
| RAM | 3 GB |
| Disk | 20 GB |
| Domain | stustaapp.stusta.mhn.de |
| Ports open | 80 (HTTP), 443 (HTTPS) |
| IP | Public IP (being assigned) |
| Email | mail.stusta.de port 25 with TLS |
| SSL | TLS certificate provided by StuSta at /etc/ssl/stustaapp.stusta.mhn.de/ |
| Processes | Managed by systemd (no Docker) |

### Architecture

All components run on the single Debian VM. Nginx is the only process that listens on public ports 80 and 443. Everything else communicates internally on localhost.

```
Internet
    │
    │  HTTP → redirected to HTTPS (301)
    │  HTTPS (port 443, TLS certificate from StuSta)
    ▼
Nginx
    ├── /           →  serves React PWA static files
    ├── /api/*      →  proxies to FastAPI (unix socket)
    │                         ├── PostgreSQL  (localhost:5432)
    │                         └── Redis       (localhost:6379)
    │                                   │
    │                         OTP emails via mail.stusta.de:25
    └── /media/*    →  serves uploaded images directly from disk
```

Locally there's no Nginx, so FastAPI itself serves `/media/*` via a `StaticFiles` mount in `main.py` (see §6). That route is unreachable in production since Nginx intercepts `/media/*` before it ever reaches the app socket.

### Project Folder Structure

```
stustaapp/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app init, router registration, scheduler
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── dependencies.py      # Auth dependencies (require_org_admin, etc.)
│   │   ├── config.py            # Settings loaded from .env / .env.local
│   │   ├── auth.py              # JWT and OTP helper functions
│   │   ├── uploads.py           # Shared image upload validation + async file write
│   │   ├── tasks.py             # Background jobs (media cleanup, event-start pushes)
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /api/auth/send-otp  +  /api/auth/verify-otp
│   │   │   ├── events.py        # CRUD endpoints for events + photo upload
│   │   │   ├── organizations.py # CRUD for orgs + logo upload + admin mgmt + follows
│   │   │   ├── notifications.py # VAPID key, push subscribe/unsubscribe, notification center, broadcast
│   │   │   └── users.py         # GET/PATCH /api/users/me + /api/users/me/memberships
│   │   ├── models/              # SQLAlchemy ORM table definitions
│   │   │   ├── user.py
│   │   │   ├── organization.py
│   │   │   ├── membership.py
│   │   │   ├── event.py
│   │   │   ├── org_follow.py
│   │   │   ├── push_subscription.py
│   │   │   └── notification.py
│   │   └── schemas/             # Pydantic request/response shapes
│   │       ├── auth.py
│   │       ├── event.py
│   │       └── organization.py
│   ├── migrations/              # Alembic generated migration scripts
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env                     # Production secrets — never commit this
│   └── .env.local                # Local dev overrides — gitignored, see §6
├── media/                       # Uploaded images (path configurable via MEDIA_ROOT)
│   ├── logos/                   # Organisation logo files
│   └── events/                  # Event photo files
├── docker-compose.dev.yml       # Local Postgres + Redis for development, see §6
├── deploy.sh                    # Server-side deploy script (git pull → migrate → build → restart)
└── frontend/                    # React PWA
    ├── public/
    │   └── manifest.json        # PWA manifest (name, icons, theme colour)
    ├── .env.production          # VITE_API_BASE_URL / VITE_MEDIA_BASE_URL for the production build
    └── src/
        ├── media.js              # mediaUrl() — env-driven media URL helper, see §6
        └── components/
            └── MarkdownText.jsx  # Restricted Markdown renderer for descriptions
```

---

## 6. Local Development

Postgres and Redis run in Docker locally instead of being installed directly, so the dev machine doesn't need either service installed system-wide.

```bash
# Start Postgres + Redis (data persists across restarts)
docker compose -f docker-compose.dev.yml up -d

# Stop them (keeps data)
docker compose -f docker-compose.dev.yml down

# Stop and wipe all data
docker compose -f docker-compose.dev.yml down -v
```

### Backend config: `.env.local`

`Settings` (in `config.py`) loads `env_file = (".env", ".env.local")` — if both exist, `.env.local` wins. This means production's `backend/.env` never needs to change for local dev to work; instead, create a gitignored `backend/.env.local` with local-only values:

```
ENVIRONMENT=local
DATABASE_URL=postgresql+asyncpg://stustaapp:devpassword@localhost:5432/stustaapp
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=dev-secret-change-me
LOG_PATH=../logs/app.log
MEDIA_ROOT=../media
VAPID_PRIVATE_KEY=<generate your own, see below>
VAPID_PUBLIC_KEY=<generate your own, see below>
VAPID_CLAIM_EMAIL=mailto:dev@localhost
```

Two settings exist specifically to make local dev behave differently from production, both defaulting to production-safe values so `backend/.env` on the server never needs to change:

- **`ENVIRONMENT`** (default `"production"`) — when set to `"local"`, `POST /api/auth/send-otp` skips the real SMTP send (there's no route to `mail.stusta.de:25` from a laptop) and instead logs the OTP code: `logger.info(f"[local] OTP code for {email}: {code}")`. Check the uvicorn console for the code after requesting one.
- **`MEDIA_ROOT`** (default `/srv/stustaapp/media`) — where uploaded logos/photos are read from and written to. Locally this should point at the repo's own `media/` folder (`MEDIA_ROOT=../media` when running uvicorn from `backend/`), since `/srv/stustaapp/media` doesn't exist on a laptop.

Run the backend:
```bash
cd backend
source venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend config

`frontend/src/api/client.js` reads `VITE_API_BASE_URL` (empty string by default) so local dev talks to the backend through Vite's dev-server proxy instead of hitting production and getting CORS-blocked. `frontend/src/media.js`'s `mediaUrl()` does the same thing for uploaded images (`VITE_MEDIA_BASE_URL`) — every `<img>` in the app goes through this helper rather than hardcoding a host. `frontend/.env.production` sets both explicitly for the real deployed build, so nothing needs to change there.

`vite.config.js` has three dev-only additions (they don't affect `vite build`/production, since Nginx serves the built static files and never runs `vite dev`):
- `server.proxy['/api'] → http://localhost:8000` — so relative `/api/...` calls reach the local backend.
- `server.proxy['/media'] → http://localhost:8000` — same idea for uploaded images, served locally by FastAPI's `StaticFiles` mount (§5) since there's no Nginx.
- `VitePWA({ devOptions: { enabled: true, type: 'module' } })` — the service worker (needed to test push notifications) is normally only built in production; this flag makes it register under `vite dev` too.

> **Service worker cache gotcha**: `frontend/src/sw.js` caches `/media/*` responses with a `NetworkFirst` strategy (deliberately not `CacheFirst` — that used to permanently cache a broken cross-origin image request from before this fix existed, which persisted even after unregistering the service worker, since Cache Storage isn't cleared by unregistering). If an uploaded image seems to vanish or never update while testing locally, check DevTools → Application → Clear site data, not just re-registering the service worker.

Run the frontend:
```bash
cd frontend
npm run dev
```

### Generating a local VAPID keypair

Push notifications require a real VAPID keypair (the placeholder `dummy-for-local-dev` value doesn't work with `pywebpush`). Generate one with `py-vapid` (already a backend dependency):

```bash
cd backend && source venv/bin/activate
python - <<'EOF'
from py_vapid import Vapid02
import base64

v = Vapid02()
v.generate_keys()

priv_raw = v.private_key.private_numbers().private_value.to_bytes(32, "big")
from cryptography.hazmat.primitives import serialization
pub_raw = v.public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint,
)

def b64url(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
print("VAPID_PRIVATE_KEY=" + b64url(priv_raw))
print("VAPID_PUBLIC_KEY=" + b64url(pub_raw))
EOF
```
Paste the output into `backend/.env.local`. This is a **local-only** keypair — production has its own, already set in the server's `backend/.env`, and the two are unrelated (a browser's push subscription is tied to whichever public key served it).

---

## 7. Push Notifications & Notification Center

Web Push (via VAPID + `pywebpush`) and an in-app notification center are both driven by the same function, `send_push_to_all` (`app/routers/notifications.py`). It's used for three kinds of notifications:

1. **New event posted** — `create_event` (`events.py`) fires `send_push_to_all(..., org_id=org.id)` as a background task, which notifies everyone following that org (`org_follows` table).
2. **Event starting now** — the `send_event_start_notifications` APScheduler job runs every 5 minutes, finds events where `starts_at <= now` and `start_notification_sent = False`, sends a push to that event's followers, and flips the flag so it isn't resent.
3. **Dev-admin broadcast** — `POST /api/notifications/broadcast` (dev-admin only) calls `send_push_to_all(org_id=None)`, which targets **every user**. Has a confirm prompt in the UI (`DevAdminSection.jsx`) since it reaches everyone.

### Flow

1. `send_push_to_all` first resolves the target user IDs (org followers, or literally every user for a broadcast) and writes one row per user into the `notifications` table — this happens **regardless of push subscription status**, so the in-app bell/`/notifications` page works even for users who never granted browser notification permission.
2. It then looks up push subscriptions only for those same target users and sends each via `pywebpush`, pruning subscriptions that come back `404`/`410` (the browser unsubscribed or the endpoint expired).
3. Separately, on the subscribe side: frontend calls `GET /api/notifications/vapid-public-key` and passes it to `pushManager.subscribe()` (see `Profile.jsx`) after the user grants the browser's notification permission. The resulting subscription (`endpoint`, `p256dh`, `auth`) is sent to `POST /api/notifications/subscribe` and stored in `push_subscriptions`.
4. The service worker (`frontend/src/sw.js`) handles the `push` event (shows the OS notification) and `notificationclick` (focuses/opens the app to the relevant URL).

### In-app notification center

`Header.jsx` shows a bell icon with an unread-count badge (polls `GET /api/notifications/unread-count` every 30s while logged in) and links to `/notifications` (`Notifications.jsx`), which lists recent notifications and supports marking one or all as read. See the Notifications endpoints in [§10 Quick Reference](#10-quick-reference).

### Debugging

`POST /api/notifications/debug-send` (dev-admin only) manually triggers a push to a hardcoded org's followers — useful for confirming the whole chain works end to end without waiting for a real event. See [Local Development](#6-local-development) for generating a local VAPID keypair, which is required before any push will actually send locally.

---

## 8. Development Timeline (historical)

> This section documents the original build plan and is kept for historical reference. The actual implementation has since diverged in places — e.g. push notifications, event recurrence labels, and org-follow were added, and the deployment approach described in §5/§10 (git-based, not rsync) reflects what's actually in use. Treat this section as "how it was planned," not "how it currently works."

The total estimated timeline is 14 weeks at an average of 3 hours per week (your stated range is 2–4 hours). The timeline is divided into four phases. Do not worry if individual weeks slip — this is a side project and the phases are designed with some buffer built in.

---

### Phase 1 — Server Setup & Project Scaffold (Weeks 1–2)

Before writing a single line of application code, the server needs to be in a working state with all dependencies installed. This phase is mostly terminal work on the VM.

#### Week 1 (~3h)

Run `apt update && apt upgrade` to make sure the system is fully up to date before installing anything. This avoids version conflicts later.

Install PostgreSQL 16 via apt. Once installed, create a database called `stustaapp` and a dedicated database user with a strong password. Never use the default postgres superuser for the application — it is a security risk.

Install Redis 7 via apt. Confirm it is running with `systemctl status redis`. Redis requires almost no configuration for this use case — the defaults are fine.

Install Python 3.11 or newer and pip. Create the project folder structure as shown in section 5. Create a Python virtual environment inside the backend folder with `python -m venv venv` and install all dependencies from requirements.txt inside it.

#### Week 2 (~3h)

Install Nginx via apt. Write a basic `nginx.conf` that proxies `/api/*` to `localhost:8000` and serves static files from the `frontend/dist` folder for all other paths. The `try_files $uri /index.html` directive is important — it makes React's client-side routing work correctly.

Install certbot and obtain an SSL certificate for `stustaapp.stusta.mhn.de`. Certbot will modify your Nginx config automatically and set up a cron job for auto-renewal. Confirm HTTPS is working before moving on.

Write a systemd unit file for the FastAPI process (uvicorn). Enable it with `systemctl enable stustaapp` so FastAPI starts automatically on boot and is restarted automatically if it crashes.

Write a placeholder FastAPI app with a single `GET /api/health` endpoint returning `{"status": "ok"}`. Deploy it and confirm you can reach it at `https://stustaapp.stusta.mhn.de/api/health` from your browser. This confirms the full Nginx → FastAPI path is working before you write real code.

---

### Phase 2 — Backend Core (Weeks 3–6)

This is the most technically dense phase. You will build the full API — database models, authentication, permission checks, and all CRUD endpoints. By the end of Week 6 the entire backend is testable via the Swagger UI at `/api/docs`.

#### Week 3 (~3h)

Write the four SQLAlchemy models: `User`, `Organization`, `OrgMembership`, `Event`. Each model maps directly to one PostgreSQL table. Use `Mapped` type annotations (SQLAlchemy 2.0 style) — they are cleaner and give better IDE support than the older Column() syntax.

The `Organization` model now includes a `location` field (the physical venue location, e.g. "Haus 14, Erdgeschoss") and a `logo_url` field pointing to a file on the VM filesystem. The `Event` model includes an optional `photo_url` field for an event photo. Both image fields store a file path, not a URL — images are served as static files by Nginx.

Create the image upload directory on the server and make sure the `stustaapp` user owns it:

```bash
mkdir -p /srv/stustaapp/media/logos
mkdir -p /srv/stustaapp/media/events
chown -R stustaapp:stustaapp /srv/stustaapp/media
```

Configure Alembic by running `alembic init migrations` inside the backend folder. Point it at your database URL in `alembic.ini`. Then run `alembic revision --autogenerate -m "initial schema"` to generate the first migration file. Always review the generated file before applying it — autogenerate is good but not perfect. Run `alembic upgrade head` to create the tables in PostgreSQL.

Write the Pydantic schemas for each model. Keep input schemas (for creating/updating) separate from output schemas (for reading). This gives you control over exactly what data is accepted and what is returned — for example, you never want to return `is_dev_admin` to a common user.

#### Week 4 (~3h)

Implement `POST /api/auth/send-otp`. This endpoint takes an email address, generates a random 6-digit code using Python's `secrets` module (never use `random` for security-sensitive values), hashes it with SHA-256, stores the hash in Redis with a 600-second TTL, and sends the raw code to the user's email via `aiosmtplib` using `mail.stusta.de`.

Implement `POST /api/auth/verify-otp`. This endpoint takes an email and a code, retrieves the hash from Redis, hashes the submitted code and compares them, deletes the Redis key on success (enforcing one-time use), creates the user in PostgreSQL if this is their first login, and returns a signed JWT.

Write `create_jwt` and `decode_jwt` helper functions using PyJWT. The JWT payload should contain the user's ID and an expiry timestamp. Store the secret signing key in the `.env` file — never hardcode it. Set the expiry to 30 days for convenience (users won't need to log in again frequently).

Test the full OTP flow end to end using the Swagger UI — send yourself a real email via the StuSta SMTP server and verify the code works.

#### Week 5 (~3h)

Write the `get_current_user` FastAPI dependency. This function extracts the Bearer token from the `Authorization` header, decodes the JWT using `decode_jwt`, fetches the corresponding user from PostgreSQL, and returns the User object. If anything fails — missing token, invalid signature, expired token, user not found — it raises HTTP 401.

Write the three permission dependencies that build on `get_current_user`: `require_dev_admin`, `require_boss_admin(org_id)`, and `require_org_admin(org_id)`. Each one calls `get_current_user` first, then checks the user's role. Dev admins pass all permission checks automatically.

Implement the organisation endpoints: `GET /api/organizations` (public, lists all orgs with logo and location), `POST /api/organizations` (dev admin only, creates a new org), `PATCH /api/organizations/{id}` (boss admin only, updates org name, description, and location), `POST /api/organizations/{id}/logo` (boss admin only, uploads a logo image — saves the file to `/srv/stustaapp/media/logos/` and stores the path in the database).

#### Week 6 (~3h)

Implement the event endpoints: `GET /api/events` (public, lists all upcoming events including org logo), `GET /api/organizations/{id}/events` (public, events for one org), `POST /api/organizations/{id}/events` (org admin only), `PATCH /api/organizations/{id}/events/{event_id}` (org admin only), `DELETE /api/organizations/{id}/events/{event_id}` (org admin only), `POST /api/organizations/{id}/events/{event_id}/photo` (org admin only, uploads an event photo — saves to `/srv/stustaapp/media/events/` and stores the path in the database).

Implement the admin management endpoints: `POST /api/organizations/{id}/admins` (boss admin invites a user as org_admin by email), `DELETE /api/organizations/{id}/admins/{user_id}` (boss admin removes an admin).

Spend the remaining time in Week 6 testing every endpoint through `/api/docs`. Create test users for each role, test all the permission boundaries (confirm a common user cannot create events, confirm an org_admin cannot edit a different org's events, etc.), and fix any bugs found.

---

### Phase 3 — Frontend (Weeks 7–11)

The frontend is a React app configured as a PWA. It communicates with the backend exclusively via the REST API. It does not know anything about the database or business logic — all of that lives in the backend.

#### Week 7 (~3h)

Scaffold the React app using Vite: `npm create vite@latest frontend -- --template react`. Vite is significantly faster than Create React App and is now the standard tool for new React projects.

Configure the PWA setup. Write `public/manifest.json` with the app name ("StuStaApp"), short name, theme colour, background colour, display mode ("standalone" — this removes the browser chrome), and icon paths. Install `vite-plugin-pwa` and configure it to generate a service worker that caches the app shell for offline use.

Set up React Router for client-side navigation. Install with `npm install react-router-dom`. Create placeholder page components for all screens: Events list, Event detail, Places list, Organisation detail, Login, Profile, and Admin Dashboard.

Build the bottom tab bar — the main navigation of the app. Common users see three tabs: **Events**, **Places**, and **Profile**. Any user with at least one admin role sees a fourth tab: **Manage**. The tab bar checks the user's memberships on login and shows or hides the Manage tab accordingly. Wire all tabs up to their respective pages using React Router.

#### Week 8 (~3h)

Build the Login screen. It is a two-step form: first the user enters their email and submits, then they enter the 6-digit code they received. Both steps can live on the same page with the second step appearing after the first is submitted.

Connect the login form to the backend. Call `POST /api/auth/send-otp` when the user submits their email, and `POST /api/auth/verify-otp` when they submit their code. On success, store the returned JWT in `localStorage`.

After login, immediately fetch `GET /api/users/me/memberships` to get the full list of the user's organisation memberships and roles. Store this in the auth context alongside the JWT. This is what the Manage tab uses to know which organisations to show and which controls to render for each one.

Create a React auth context (using `createContext` and `useContext`) that wraps the whole app and provides the current user's data, their memberships list, and a logout function to any component that needs it. On app load, check if a valid JWT exists in `localStorage` and restore the logged-in state.

Set up protected routes: wrap admin pages in a component that checks whether the user has the required role for that organisation, and redirects to the login screen if not.

#### Week 9 (~3h)

Build the **Events tab** — the main screen users see first. Fetch `GET /api/events` and display upcoming events as cards. Each card shows the event title, the organisation's logo, the date and time, and the location. Sort events by start date ascending so the soonest events appear first.

Build the **Event Detail page**. When a user taps an event card they navigate to `/events/{id}`. This page shows the full event information: title, full description, date and time, location, the organising organisation's name and logo, and the event photo if one has been uploaded. The event photo should be displayed prominently at the top of the page.

Add basic filtering on the Events tab — a way to filter events by organisation so residents can quickly see what a specific club has coming up.

#### Week 10 (~3h)

Build the **Places tab** — a list of all organisations. Fetch `GET /api/organizations` and display each org as a card showing the logo, name, location, and short description. Tapping a card navigates to the Organisation Detail page.

Build the **Organisation Detail page**. Shows the full organisation info: name, full description, physical location, and logo. Below the org info, show a list of upcoming events from that organisation so users can see what is coming up from a specific venue without leaving the page.

Build the **Manage tab** — this is the most complex part of the frontend. The tab fetches the user's memberships list and renders one section per organisation the user belongs to. The label at the top of each section shows the organisation name and role (e.g. "Egon's Underground — Boss Admin"). The controls within each section depend on the role for that specific organisation:

For each **org admin** section:
- List of that org's upcoming events with edit and delete buttons on each
- Create New Event button
- Tapping an event opens an edit form with fields for title, description, date, time, location, and a photo upload button

For each **boss admin** section:
- Everything in the org admin section above, plus:
- Edit Organisation Info form — name, description, location, logo upload
- Admin Management — list of current org admins with a remove button on each, and an Invite New Admin form that takes an email address

If the user is a **dev admin**, a global section appears at the top of the Manage tab above all org sections:
- List of all organisations in the system
- Create New Organisation button — form with name, description, location, logo upload, and assign first boss admin by email
- Tapping an org shows its current admins and allows removing them

#### Week 11 (~3h)

Build the **Profile tab**. Shows the user's email address. Includes a notification settings section — in v1 this can be a placeholder with a toggle that does nothing yet, reserving the space for when push notifications are implemented later.

Add loading states throughout the app — show a spinner or skeleton while data is being fetched from the API. Add error states — show a user-friendly message if an API call fails. Add empty states — show a helpful message on the events list when there are no upcoming events yet.

Polish the UI for consistency: make sure spacing, font sizes, and colours are consistent across all screens. Pay special attention to the Manage tab — test it with a user who belongs to multiple organisations with different roles to make sure each section renders correctly. Test on a real phone to make sure touch targets are large enough and the layout works at mobile screen sizes.

---

### Phase 4 — Testing & Launch (Weeks 12–14)

The focus shifts from building to hardening. You will test every user role manually, review security, set up logging, and do a soft launch.

#### Week 12 (~3h)

End-to-end testing: go through every user flow manually for each role. Create test accounts covering these scenarios: a common user, a user who is org admin in one org, a user who is boss admin in one org, a user who is org admin in one org AND boss admin in another, and the dev admin. Go through every feature of the app for each account and verify that permissions are enforced correctly and that the Manage tab shows the right sections and controls for each scenario. Write down every bug you find and fix them in priority order.

Test the PWA install flow on both Android (using Chrome) and iOS (using Safari). On Android, Chrome shows an "Add to Home Screen" banner automatically. On iOS, the user must tap the Share button and then "Add to Home Screen" manually. Verify the app opens correctly from the home screen on both platforms and that the status bar and theme colour look correct.

#### Week 13 (~3h)

Set up logging in FastAPI using Python's built-in `logging` module. Configure uvicorn to write access logs (every request) and error logs to files on disk so you can diagnose problems in production without having to reproduce them locally. Also log when OTPs are sent and when logins succeed or fail — this helps detect abuse.

Security review. Add rate limiting to the OTP send endpoint to prevent someone from spamming the email server — store a counter in Redis and reject requests if a given email has requested more than 5 codes in a 10-minute window. Confirm that JWT expiry is set correctly. Confirm that the `.env` file containing the JWT secret is not readable by other users on the server (`chmod 600 .env`).

Run a final check that HTTPS is working correctly and that plain HTTP automatically redirects to HTTPS. Nginx handles this with a second server block that listens on port 80 and returns a 301 redirect.

#### Week 14 (~3h)

Build the React frontend one final time with `npm run build` and copy the output to the server so Nginx serves the latest version. Restart Nginx to make sure it picks up any config changes.

Create the first dev admin account. Log in with your own email to create your user account, then open a PostgreSQL shell and run `UPDATE users SET is_dev_admin = true WHERE email = 'your@email.com';`.

Onboard the first organisations: use the dev admin screen to create their organisation records, then use the boss admin invite flow to assign their admin users.

Soft launch — share the URL with a small group of residents first rather than announcing it to everyone at once. Collect feedback, watch the logs for errors, and fix any last issues before the wider announcement.

---

### Timeline Summary

| Phase | Weeks | Hours | Deliverable |
|---|---|---|---|
| 1 — Server setup | 1–2 | ~6h | Server running, full stack installed and verified |
| 2 — Backend | 3–6 | ~12h | Complete REST API, all endpoints tested via /api/docs |
| 3 — Frontend | 7–11 | ~15h | React PWA built and connected to backend |
| 4 — Testing & launch | 12–14 | ~9h | App live at stustaapp.stusta.mhn.de |
| **Total** | **14 weeks** | **~42h** | |

---

## 9. Cost Breakdown

The entire project runs at zero cost. All software is open source, the server is provided by StuSta, and email goes through the StuSta SMTP server.

| Component | Cost | Notes |
|---|---|---|
| FastAPI, SQLAlchemy, etc. | Free | Open source Python libraries |
| PostgreSQL | Free | Open source, self-hosted on VM |
| Redis | Free | Open source, self-hosted on VM |
| Nginx | Free | Open source, self-hosted on VM |
| React | Free | Open source |
| SSL certificate | Free | Let's Encrypt via certbot, auto-renewing |
| Email (OTP sending) | Free | StuSta SMTP server at mail.stusta.de |
| VM hosting | Free | Provided by StuSta infrastructure |
| Domain name | Free | stustaapp.stusta.mhn.de provided by StuSta |
| **Total** | **€0/month** | No ongoing costs |

---

## 10. Quick Reference

### Key URLs

| URL | What it is |
|---|---|
| https://stustaapp.stusta.mhn.de | The live app (frontend) |
| https://stustaapp.stusta.mhn.de/api/docs | Swagger UI — interactive API documentation |
| https://stustaapp.stusta.mhn.de/api/health | Health check endpoint |

### API Endpoints

**Auth** (`app/routers/auth.py`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | /api/auth/send-otp | None | Send a 6-digit login code to an email (rate-limited) |
| POST | /api/auth/verify-otp | None | Verify the code, get a JWT |

**Users** (`app/routers/users.py`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/users/me | Authenticated | Current user's profile |
| PATCH | /api/users/me | Authenticated | Update first/last name |
| GET | /api/users/me/memberships | Authenticated | Current user's org memberships and roles |

**Organizations** (`app/routers/organizations.py`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/organizations | None | List all organisations |
| GET | /api/organizations/{id} | None | Get one organisation |
| POST | /api/organizations | Dev admin | Create organisation |
| PATCH | /api/organizations/{id} | Boss admin | Edit org name, description, location |
| DELETE | /api/organizations/{id} | Dev admin | Delete org (cascades memberships, follows, events) |
| POST | /api/organizations/{id}/logo | Boss admin | Upload org logo image |
| GET | /api/organizations/{id}/memberships | Boss admin | List the org's admins |
| POST | /api/organizations/{id}/admins | Boss admin | Invite an admin (org_admin **or** boss_admin) by email |
| DELETE | /api/organizations/{id}/admins/{user_id} | Boss admin | Remove an admin |
| POST | /api/organizations/{id}/follow | Authenticated | Follow an org (for push notifications) |
| DELETE | /api/organizations/{id}/follow | Authenticated | Unfollow an org |
| GET | /api/organizations/me/follows | Authenticated | List orgs the current user follows |

**Events** (`app/routers/events.py`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/events | None | Upcoming events (next 7 days) across all orgs |
| GET | /api/events/{id} | None | Get one event |
| GET | /api/organizations/{id}/events | None | Upcoming events for one org (next 7 days) |
| GET | /api/organizations/{id}/events/manage | Org admin | **All** events for the org, unfiltered by date — used by the manage UI |
| POST | /api/organizations/{id}/events | Org admin | Create event (triggers a push to followers) |
| PATCH | /api/organizations/{id}/events/{event_id} | Org admin | Edit event |
| DELETE | /api/organizations/{id}/events/{event_id} | Org admin | Delete event |
| POST | /api/organizations/{id}/events/{event_id}/photo | Org admin | Upload event photo |

**Notifications** (`app/routers/notifications.py`)

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/notifications/vapid-public-key | None | Public VAPID key for `pushManager.subscribe()` |
| POST | /api/notifications/subscribe | Authenticated | Register a push subscription |
| DELETE | /api/notifications/unsubscribe | Authenticated | Remove a push subscription |
| GET | /api/notifications | Authenticated | List the current user's notifications (newest first, up to 50) |
| GET | /api/notifications/unread-count | Authenticated | Unread notification count, polled by the header bell |
| POST | /api/notifications/{id}/read | Authenticated | Mark one notification read |
| POST | /api/notifications/read-all | Authenticated | Mark all of the current user's notifications read |
| POST | /api/notifications/broadcast | Dev admin | Send a notification + push to **every** user (see §7) |
| POST | /api/notifications/debug-send | Dev admin | Manually trigger a push to a hardcoded org's followers (see §7) |

### requirements.txt

Install with `pip install -r requirements.txt`. Key packages (see `backend/requirements.txt` for the full pinned list): `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pydantic-settings`, `PyJWT`, `redis`, `aiosmtplib`, `APScheduler`, `pywebpush`, `py-vapid`.

### Useful Commands

**Server management:**
```bash
# Restart FastAPI after code changes
systemctl restart stustaapp

# View live FastAPI logs
journalctl -u stustaapp -f

# Reload Nginx after config changes
systemctl reload nginx

# Renew SSL certificate manually
certbot renew
```

**Database migrations:**
```bash
# After changing a SQLAlchemy model, generate a migration
alembic revision --autogenerate -m "describe what changed"

# Apply all pending migrations to the database
alembic upgrade head

# Check current migration version
alembic current
```

**Deployment** — see `deploy.sh` at the repo root. Deploy is git-based, not a manual file copy: the server clones/pulls this repo over HTTPS (using a fine-grained PAT, since the StuSta proxy blocks SSH-over-443), then the script reinstalls dependencies, runs migrations, rebuilds the frontend, and restarts the service:
```bash
# Run on the server, from /srv/stustaapp
./deploy.sh
```
which does, in order: `git pull` → `pip install -r backend/requirements.txt` → `alembic upgrade head` → `npm ci && npm run build` (frontend) → `chown -R stustaapp:stustaapp /srv/stustaapp` → `systemctl restart stustaapp`.

> **Tip:** Always activate your virtual environment before running any Python commands: `source backend/venv/bin/activate` — you should see `(venv)` at the start of your terminal prompt.