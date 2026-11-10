import os
import warnings
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

load_dotenv(Path(__file__).resolve().parent / ".env")


def positive_int_env(name: str, default: int) -> int:
    """Read a positive integer environment variable."""
    raw_value = os.getenv(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer.") from exc

    if value < 1:
        raise RuntimeError(f"{name} must be a positive integer.")
    return value


ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Shared image limits for background removal and conversion.
MAX_IMAGE_BYTES = positive_int_env("MAX_IMAGE_MB", 10) * 1024 * 1024
MAX_IMAGE_PIXELS = positive_int_env("MAX_IMAGE_PIXELS", 25_000_000)
MAX_IMAGE_SIDE = positive_int_env("MAX_IMAGE_SIDE", 2000)
IMAGE_WORKERS = positive_int_env("IMAGE_WORKERS", 1)
ALLOWED_IMAGE_FORMATS = ("JPEG", "PNG", "WEBP")

# Make Pillow enforce the same decoded-pixel limit for every image endpoint.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)

MAX_PDF_BYTES = positive_int_env("MAX_PDF_MB", 200) * 1024 * 1024
MAX_PDF_PAGES = positive_int_env("MAX_PDF_PAGES", 500)
PDF_WORKERS = positive_int_env("PDF_WORKERS", 1)

PDF_LEVELS = {
    "low": {"dpi_threshold": 200, "dpi_target": 150, "quality": 85},
    "medium": {"dpi_threshold": 150, "dpi_target": 110, "quality": 70},
    "high": {"dpi_threshold": 120, "dpi_target": 72, "quality": 50},
}
