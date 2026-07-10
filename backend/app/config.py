from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # "local" skips sending real emails (see auth.py); anything else behaves as production
    environment: str = "production"

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret_key: str
    jwt_expire_days: int = 30

    # SMTP
    smtp_host: str = "mail.stusta.de"
    smtp_port: int = 25

    # for notifications
    vapid_private_key: str
    vapid_public_key: str
    vapid_claim_email: str

    # Logging
    log_path: str = "logs/app.log"

    class Config:
        env_file = (".env", ".env.local")


settings = Settings()