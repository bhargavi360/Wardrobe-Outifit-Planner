"""Upload paths must remain stable when the API is launched from another folder."""

from pathlib import Path

from app.core.config import BACKEND_ROOT, Settings


def test_relative_uploads_path_is_resolved_from_backend_root() -> None:
    settings = Settings(_env_file=None, uploads_dir=Path("uploads"))
    assert settings.uploads_dir == BACKEND_ROOT / "uploads"


def test_absolute_uploads_path_is_preserved(tmp_path: Path) -> None:
    settings = Settings(_env_file=None, uploads_dir=tmp_path)
    assert settings.uploads_dir == tmp_path
