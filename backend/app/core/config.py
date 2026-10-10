"""Environment-backed application settings."""

from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Settings loaded from environment variables and ``backend/.env``."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Smart Wardrobe API"
    api_prefix: str = "/api"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "smart_wardrobe"
    cors_origins: list[str] = ["http://localhost:3000"]
    jwt_secret_key: SecretStr = SecretStr("")
    jwt_access_token_expire_minutes: int = Field(default=60, gt=0)
    auth_cookie_secure: bool = False
    auth_cookie_name: str = Field(default="wardrobe_access_token", min_length=1)
    uploads_dir: Path = BACKEND_ROOT / "uploads"
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = "gemini-2.5-flash"

    @field_validator("uploads_dir")
    @classmethod
    def resolve_uploads_dir(cls, value: Path) -> Path:
        return value if value.is_absolute() else BACKEND_ROOT / value


settings = Settings()
