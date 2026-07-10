import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


def create_jwt(user_id: str) -> str:
    # Build the payload — sub is the standard JWT field for the subject (user ID)
    # exp is the expiry timestamp — after this date the token is invalid
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_jwt(token: str) -> str:
    # Verify the signature and expiry — raises jwt.ExpiredSignatureError
    # or jwt.InvalidTokenError if anything is wrong
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    return payload["sub"]


def generate_otp() -> str:
    # secrets.randbelow is cryptographically secure — never use random for this
    # 900000 gives us a range of 100000–999999 (always 6 digits)
    code = secrets.randbelow(900000) + 100000
    return str(code)


def hash_otp(code: str) -> str:
    # We never store the raw code — only its SHA-256 hash
    # This way even if Redis is compromised the codes are useless
    return hashlib.sha256(code.encode()).hexdigest()