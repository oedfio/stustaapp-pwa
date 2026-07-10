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
6. [Development Timeline](#6-development-timeline)
7. [Cost Breakdown](#7-cost-breakdown)
8. [Quick Reference](#8-quick-reference)

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

The application uses PostgreSQL as its primary database. The schema is kept intentionally simple. There are four main tables.

### Table: users

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| email | text | Unique, used for login |
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
| starts_at | timestamp | Event start date and time |
| location | text | Location or room name |
| photo_url | text | Optional event photo stored on the VM filesystem |

### How roles are stored

- **Dev admins** have `is_dev_admin = true` in the `users` table. They have no `org_memberships` row — they bypass all organisation checks.
- **Boss admins** have one row in `org_memberships` with `role = 'boss_admin'` per organisation they manage. A user can have multiple boss admin rows for different organisations.
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
| Pydantic v2 | Validates incoming request data and shapes outgoing responses. Built into FastAPI. |
| PyJWT | Creates and verifies JWT tokens for authentication. |
| redis-py (async) | Python client for Redis. Used to store and retrieve OTP hashes. |
| aiosmtplib | Async SMTP client. Sends OTP emails via mail.stusta.de port 25. |
| uvicorn | ASGI server that runs the FastAPI application as a process. |

### Infrastructure

| Component | Role |
|---|---|
| PostgreSQL | Primary relational database. Stores users, organisations, memberships, events. |
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

### Project Folder Structure

```
stustaapp/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app init, router registration, scheduler
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── dependencies.py      # Auth dependencies (require_org_admin, etc.)
│   │   ├── config.py            # Settings loaded from .env file
│   │   ├── auth.py              # JWT and OTP helper functions
│   │   ├── tasks.py             # Background tasks (weekly media cleanup)
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /api/auth/send-otp  +  /api/auth/verify-otp
│   │   │   ├── events.py        # CRUD endpoints for events + photo upload
│   │   │   ├── organizations.py # CRUD endpoints for orgs + logo upload + admin management
│   │   │   └── users.py         # GET /api/users/me + /api/users/me/memberships
│   │   ├── models/              # SQLAlchemy ORM table definitions
│   │   │   ├── user.py
│   │   │   ├── organization.py
│   │   │   ├── membership.py
│   │   │   └── event.py
│   │   └── schemas/             # Pydantic request/response shapes
│   │       ├── auth.py
│   │       ├── event.py
│   │       └── organization.py
│   ├── migrations/              # Alembic generated migration scripts
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env                     # Secret keys, DB URL, Redis URL — never commit this
├── media/                       # Uploaded images served by Nginx
│   ├── logos/                   # Organisation logo files
│   └── events/                  # Event photo files
└── frontend/                    # React PWA
    ├── public/
    │   └── manifest.json        # PWA manifest (name, icons, theme colour)
    └── src/
```

---

## 6. Development Timeline

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

## 7. Cost Breakdown

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

## 8. Quick Reference

### Key URLs

| URL | What it is |
|---|---|
| https://stustaapp.stusta.mhn.de | The live app (frontend) |
| https://stustaapp.stusta.mhn.de/api/docs | Swagger UI — interactive API documentation |
| https://stustaapp.stusta.mhn.de/api/health | Health check endpoint |

### Key API Endpoints

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/users/me/memberships | Authenticated | Get current user's org memberships and roles |
| POST | /api/auth/verify-otp | None | Verify OTP, get JWT |
| GET | /api/events | None | List all upcoming events |
| GET | /api/organizations | None | List all organisations with logo and location |
| POST | /api/organizations | Dev admin | Create organisation |
| PATCH | /api/organizations/{id} | Boss admin | Edit org name, description, location |
| POST | /api/organizations/{id}/logo | Boss admin | Upload org logo image |
| POST | /api/organizations/{id}/events | Org admin | Create event |
| PATCH | /api/organizations/{id}/events/{event_id} | Org admin | Edit event |
| DELETE | /api/organizations/{id}/events/{event_id} | Org admin | Delete event |
| POST | /api/organizations/{id}/events/{event_id}/photo | Org admin | Upload event photo |
| POST | /api/organizations/{id}/admins | Boss admin | Invite org admin |
| DELETE | /api/organizations/{id}/admins/{user_id} | Boss admin | Remove org admin |

### requirements.txt

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
pydantic-settings
PyJWT
redis
aiosmtplib
```

Install with:
```bash
pip install -r requirements.txt
```

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

**Frontend deployment:**
```bash
# Build the React app for production
npm run build

# Copy the build output to the server (run from your local machine)
rsync -av dist/ root@stustaapp.stusta.mhn.de:/var/www/stustaapp/
```

> **Tip:** Always activate your virtual environment before running any Python commands: `source backend/venv/bin/activate` — you should see `(venv)` at the start of your terminal prompt.