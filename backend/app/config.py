from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    app_env: str = "development"  # development | staging | production

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()