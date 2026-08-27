import asyncio
from fastapi import HTTPException, UploadFile

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


async def read_validated_image(file: UploadFile) -> tuple[bytes, str]:
    """Validate an uploaded image's type and size, and return its bytes
    plus a safe file extension derived from the content type (never from
    the client-supplied filename).
    """
    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=400, detail="Only JPEG, PNG and WebP images are allowed"
        )

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5MB or smaller")

    return data, extension


def _write_file(filepath: str, data: bytes) -> None:
    with open(filepath, "wb") as buffer:
        buffer.write(data)


async def save_image(filepath: str, data: bytes) -> None:
    """Write validated image bytes to disk without blocking the event loop."""
    await asyncio.to_thread(_write_file, filepath, data)