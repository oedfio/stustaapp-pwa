from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.routers import auth, organizations, users, events
from app.tasks import cleanup_unused_media, send_event_reminder_notifications
import logging
import logging.handlers
from app.routers import auth, organizations, users, events, notifications
from app.config import settings

LOG_PATH = settings.log_path

# ── Logging setup ─────────────────────────────────────────────────────────────

def setup_logging():
    log_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # File handler — rotates daily, keeps 30 days of logs
    file_handler = logging.handlers.TimedRotatingFileHandler(
        LOG_PATH,
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
    )
    file_handler.setFormatter(log_formatter)
    root_logger.addHandler(file_handler)

    # Console handler — still visible in journalctl
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    root_logger.addHandler(console_handler)

setup_logging()
logger = logging.getLogger(__name__)

# ── Scheduler ─────────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("StuStaApp starting up")
    scheduler.add_job(
        cleanup_unused_media,
        trigger="interval",
        weeks=1,
        id="cleanup_unused_media",
    )
    scheduler.add_job(
        send_event_reminder_notifications,
        trigger="interval",
        minutes=5,
        id="send_event_reminder_notifications",
    )
    scheduler.start()
    yield
    logger.info("StuStaApp shutting down")
    scheduler.shutdown()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="StuStaApp",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(users.router)
app.include_router(events.router)
app.include_router(notifications.router)

# In production, Nginx serves /media/* directly from disk and this route is
# never reached. Locally there's no Nginx, so FastAPI serves it instead.
app.mount("/media", StaticFiles(directory=settings.media_root), name="media")

@app.get("/api/health")
async def health():
    return {"status": "ok"}