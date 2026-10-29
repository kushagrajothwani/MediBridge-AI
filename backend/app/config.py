from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    app_env: str = "development"  # development | staging | production
    frontend_url: str = "http://localhost:5173"  # comma-separated list allowed
    seed_on_startup: bool = False  # loads the synthetic demo data (never in production)
    allow_registration: bool = True

    model_config = SettingsConfigDict(env_file=".env")

    @model_validator(mode="after")
    def check_secret(self):
        if self.app_env != "development" and len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters outside development")
        return self


settings = Settings()