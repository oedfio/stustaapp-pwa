import asyncio
import io
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageChops

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

PIL_FORMAT_BY_EXTENSION = {
    "jpg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
}

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

# Skip trimming if the visible content already fills more than this
# fraction of the canvas in either dimension — it's a real photo, not a
# logo with padding, and diffing against a guessed background risks
# cropping into actual content.
TRIM_SKIP_THRESHOLD = 0.92

# Uniform margin (relative to the trimmed content's larger dimension) kept
# around the cropped result, so the logo isn't flush against its own edges.
TRIM_PADDING_RATIO = 0.06


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


def _content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Bounding box of the image's actual visible content, discounting a
    uniform surrounding margin (transparent, if the image has an alpha
    channel, or solid-colored — sampled from the top-left corner pixel).
    Returns None if no such margin is detected.
    """
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        alpha = image.convert("RGBA").getchannel("A")
        return alpha.getbbox()

    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    return ImageChops.difference(rgb, background).getbbox()


def _trim_logo_whitespace(data: bytes, extension: str) -> bytes:
    """Crop a uniform border of padding (transparent or solid-colored) from
    around a logo's actual visible content, so a logo saved on a much
    larger padded canvas doesn't render as mostly empty space. Leaves the
    image untouched if it doesn't look like it has that kind of padding —
    e.g. a photo with no uniform margin, or one already tightly cropped.
    """
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        return data

    width, height = image.size
    bbox = _content_bbox(image)
    if bbox is None:
        return data

    left, top, right, bottom = bbox
    content_width, content_height = right - left, bottom - top
    if content_width <= 0 or content_height <= 0:
        return data

    # Content already fills the canvas in both dimensions — nothing to trim.
    if content_width >= width * TRIM_SKIP_THRESHOLD and content_height >= height * TRIM_SKIP_THRESHOLD:
        return data

    padding = round(max(content_width, content_height) * TRIM_PADDING_RATIO)
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(width, right + padding)
    bottom = min(height, bottom + padding)

    cropped = image.crop((left, top, right, bottom))
    buffer = io.BytesIO()
    cropped.save(buffer, format=PIL_FORMAT_BY_EXTENSION[extension])
    return buffer.getvalue()


async def trim_logo_whitespace(data: bytes, extension: str) -> bytes:
    """Async wrapper for _trim_logo_whitespace — Pillow is sync/CPU-bound,
    so this runs off the event loop like save_image does.
    """
    return await asyncio.to_thread(_trim_logo_whitespace, data, extension)


def _write_file(filepath: str, data: bytes) -> None:
    with open(filepath, "wb") as buffer:
        buffer.write(data)


async def save_image(filepath: str, data: bytes) -> None:
    """Write validated image bytes to disk without blocking the event loop."""
    await asyncio.to_thread(_write_file, filepath, data)