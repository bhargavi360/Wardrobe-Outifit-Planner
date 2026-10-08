"""Local image storage implementation behind a cloud-swappable interface."""

import asyncio
import io
import logging
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi.responses import FileResponse, Response

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
CHUNK_SIZE = 1024 * 1024
SUPPORTED_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}


class InvalidImageError(ValueError):
    """Raised when an upload is not a supported, decodable image."""


class ImageTooLargeError(ValueError):
    """Raised when an upload exceeds its configured byte or pixel limit."""


class UploadStorageError(OSError):
    """Raised when an image cannot be written to local upload storage."""


@dataclass(frozen=True)
class StoredImage:
    """Metadata for a sanitized file stored locally."""

    filename: str
    media_type: str


class ImageStorageAdapter(Protocol):
    """Interface implemented by local or future cloud image storage."""

    async def save(self, upload: UploadFile) -> StoredImage: ...

    async def delete(self, filename: str) -> None: ...

    async def response_for(self, filename: str, media_type: str) -> Response: ...


class ImageStorage:
    """Store sanitized uploads locally; a cloud adapter can implement this API."""

    def __init__(self, root: Path) -> None:
        self._root = root

    async def save(self, upload: UploadFile) -> StoredImage:
        """Read a bounded upload, validate its actual image content, and save it."""
        chunks: list[bytes] = []
        byte_count = 0
        while True:
            chunk = await upload.read(CHUNK_SIZE)
            if not chunk:
                break
            byte_count += len(chunk)
            if byte_count > MAX_IMAGE_BYTES:
                raise ImageTooLargeError("Image must be 10 MB or smaller.")
            chunks.append(chunk)
        if not chunks:
            raise InvalidImageError("Choose a non-empty JPEG, PNG, or WebP image.")

        contents = await asyncio.to_thread(_sanitize_image, b"".join(chunks))
        image_format, sanitized = contents
        extension, media_type = SUPPORTED_FORMATS[image_format]
        filename = f"{uuid4().hex}{extension}"
        try:
            await asyncio.to_thread(self._write_file, filename, sanitized)
        except OSError as exc:
            try:
                await asyncio.to_thread(self._delete_file, filename)
            except OSError:
                logger.exception("Could not remove a partially written wardrobe image")
            logger.exception("Could not save uploaded wardrobe image")
            raise UploadStorageError("Image storage is unavailable.") from exc
        return StoredImage(filename=filename, media_type=media_type)

    async def delete(self, filename: str) -> None:
        """Delete a file previously returned by this storage adapter."""
        if Path(filename).name != filename:
            raise ValueError("Invalid stored image name.")
        await asyncio.to_thread(self._delete_file, filename)

    def _path_for(self, filename: str) -> Path:
        """Resolve a generated upload filename inside the storage directory."""
        if Path(filename).name != filename:
            raise ValueError("Invalid stored image name.")
        return self._root / filename

    async def response_for(self, filename: str, media_type: str) -> Response:
        """Return a private file response for an existing image."""
        image_path = self._path_for(filename)
        if not await asyncio.to_thread(image_path.is_file):
            raise FileNotFoundError("Stored wardrobe image is missing.")
        return FileResponse(
            image_path,
            media_type=media_type,
            headers={"Cache-Control": "private, no-store"},
        )

    def _write_file(self, filename: str, contents: bytes) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        with self._path_for(filename).open("xb") as image_file:
            image_file.write(contents)

    def _delete_file(self, filename: str) -> None:
        self._path_for(filename).unlink(missing_ok=True)


def _sanitize_image(contents: bytes) -> tuple[str, bytes]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(contents)) as source:
                image_format = source.format
                if image_format is None or image_format not in SUPPORTED_FORMATS:
                    raise InvalidImageError("Choose a JPEG, PNG, or WebP image.")
                if source.width * source.height > MAX_IMAGE_PIXELS:
                    raise ImageTooLargeError("Image dimensions exceed the 40 megapixel limit.")
                source.verify()

            with Image.open(io.BytesIO(contents)) as source:
                source.load()
                image = ImageOps.exif_transpose(source)
                if image_format == "JPEG":
                    image = image.convert("RGB")
                elif image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                output = io.BytesIO()
                save_options: dict[str, object] = {"optimize": True}
                if image_format == "WEBP":
                    save_options["quality"] = 90
                image.save(output, format=image_format, **save_options)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageTooLargeError("Image dimensions exceed the safe processing limit.") from exc
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise InvalidImageError("The uploaded file is not a valid image.") from exc

    sanitized = output.getvalue()
    if len(sanitized) > MAX_IMAGE_BYTES:
        raise ImageTooLargeError("Processed image must be 10 MB or smaller.")
    return image_format, sanitized
