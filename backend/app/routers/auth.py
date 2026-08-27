import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth import create_jwt, generate_otp, hash_otp
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import SendOtpRequest, TokenResponse, VerifyOtpRequest

import aiosmtplib
from email.mime.text import MIMEText
from email.utils import make_msgid, formatdate

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def get_redis() -> redis.Redis:
    client = redis.from_url(settings.redis_url)
    try:
        yield client
    finally:
        await client.aclose()


def get_client_ip(request: Request) -> str:
    # X-Real-IP is set by Nginx and contains the real client IP
    # Fall back to the direct connection IP if the header is missing
    return request.headers.get("X-Real-IP") or request.client.host


async def send_otp_email(to_email: str, code: str) -> None:
    message = MIMEText(
        f"Your StuStaApp login code is: {code}\n\nThis code expires in 10 minutes.",
        "plain"
    )
    message["From"] = "noreply@stusta.de"
    message["To"] = to_email
    message["Subject"] = "Your StuStaApp login code"
    message["Message-ID"] = make_msgid(domain="stusta.de")
    message["Date"] = formatdate(localtime=True)

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
    )


@router.post("/send-otp", status_code=200)
async def send_otp(
    request: SendOtpRequest,
    http_request: Request,
    redis_client: redis.Redis = Depends(get_redis),
):
    client_ip = get_client_ip(http_request)

    # Check per-email rate limit — max 5 requests per email per 10 minutes
    email_rate_key = f"otp_rate:{request.email}"
    email_count = await redis_client.get(email_rate_key)
    if email_count and int(email_count) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many code requests for this email. Please wait 10 minutes."
        )

    # Check per-IP rate limit — max 50 requests per IP per 10 minutes
    ip_rate_key = f"otp_rate_ip:{client_ip}"
    ip_count = await redis_client.get(ip_rate_key)
    if ip_count and int(ip_count) >= 50:
        raise HTTPException(
            status_code=429,
            detail="Too many requests from your network. Please wait 10 minutes."
        )

    # Generate a 6-digit code and hash it
    code = generate_otp()
    hashed = hash_otp(code)

    # Store the hash in Redis with a 10 minute TTL
    await redis_client.setex(f"otp:{request.email}", 600, hashed)

    # Increment both rate limit counters
    await redis_client.incr(email_rate_key)
    await redis_client.expire(email_rate_key, 600)

    await redis_client.incr(ip_rate_key)
    await redis_client.expire(ip_rate_key, 600)

    # Send the raw code to the user's email.
    # Locally there's no route to the stusta.de mail relay, so just log the
    # code instead of trying (and failing) to send a real email.
    if settings.environment == "local":
        logger.info(f"[local] OTP code for {request.email}: {code}")
    else:
        await send_otp_email(request.email, code)

    logger.info(f"OTP sent to {request.email} from IP {client_ip}")
    return {"message": "If that email is registered, a code has been sent."}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    request: VerifyOtpRequest,
    http_request: Request,
    redis_client: redis.Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_client_ip(http_request)

    # Brute force protection — tracks failed verify attempts
    attempts_key = f"otp_attempts:{request.email}"

    attempts = await redis_client.get(attempts_key)
    if attempts and int(attempts) >= 5:
        # Too many failed attempts — delete the OTP and force a new request
        await redis_client.delete(f"otp:{request.email}")
        await redis_client.delete(attempts_key)
        logger.warning(f"Too many failed OTP attempts for {request.email} from IP {client_ip}")
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Please request a new code."
        )

    # Retrieve the stored hash from Redis
    stored_hash = await redis_client.get(f"otp:{request.email}")

    if not stored_hash or stored_hash.decode() != hash_otp(request.code):
        # Wrong code — increment the failed attempts counter
        await redis_client.incr(attempts_key)
        await redis_client.expire(attempts_key, 600)
        logger.warning(f"Invalid OTP attempt for {request.email} from IP {client_ip}")
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # Correct code — clean up all Redis keys for this email
    await redis_client.delete(f"otp:{request.email}")
    await redis_client.delete(attempts_key)

    # Check if the user already exists
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(email=request.email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    logger.info(f"User logged in: {user.email}")
    token = create_jwt(str(user.id))
    return TokenResponse(access_token=token)