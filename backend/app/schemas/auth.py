"""Authentication request and response schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Credentials(BaseModel):
    """Email and password submitted to register or sign in."""

    email: Annotated[EmailStr, Field(max_length=254)]
    password: Annotated[str, Field(min_length=8, max_length=72)]

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("password")
    @classmethod
    def validate_bcrypt_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes when UTF-8 encoded.")
        return value


class UserResponse(BaseModel):
    """Safe public representation of the signed-in user."""

    id: str
    email: EmailStr
    created_at: datetime
    display_name: str = ""
    city: str = ""
    bio: str = ""


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    display_name: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=120)
    bio: str = Field(default="", max_length=500)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("current_password", "new_password")
    @classmethod
    def valid_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes when UTF-8 encoded.")
        return value
