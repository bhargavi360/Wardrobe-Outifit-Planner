"""Password hashing and JWT primitives for the authentication phase."""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt


def hash_password(password: str) -> str:
    """Hash a UTF-8 password with bcrypt."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Bcrypt passwords must be at most 72 bytes when UTF-8 encoded.")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("ascii"))


def create_access_token(
    subject: str,
    secret_key: str,
    expires_minutes: int,
    session_version: int = 0,
) -> str:
    """Create a signed JWT access token for a non-empty subject."""
    _validate_secret_key(secret_key)
    if not subject.strip():
        raise ValueError("Token subject must not be empty.")
    if expires_minutes <= 0:
        raise ValueError("Token expiration must be a positive number of minutes.")

    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "version": session_version,
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")


def decode_access_token(token: str, secret_key: str) -> dict[str, object]:
    """Validate and decode a JWT access token."""
    _validate_secret_key(secret_key)
    return jwt.decode(token, secret_key, algorithms=["HS256"])


def validate_jwt_secret_key(secret_key: str) -> None:
    """Ensure the configured signing key is not a placeholder or weak value."""
    _validate_secret_key(secret_key)


def _validate_secret_key(secret_key: str) -> None:
    if (
        len(secret_key.encode("utf-8")) < 32
        or "generate-a-random-secret" in secret_key.lower()
        or "replace-with-a-random-secret" in secret_key.lower()
    ):
        raise ValueError(
            "JWT_SECRET_KEY must be a unique secret containing at least 32 bytes."
        )
