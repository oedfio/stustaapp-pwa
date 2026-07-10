from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Redis: default value because it doesn't contain any specific information in it. for example, database usl had password, user, etc.
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

    class Config:
        env_file = ".env"


settings = Settings()