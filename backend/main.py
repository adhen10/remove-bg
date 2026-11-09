import io
import logging
import os
import threading
import warnings

import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps
from rembg import new_session, remove

logger = logging.getLogger(__name__)


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


# CORS
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")
    if origin.strip()
]

# Remove background limits
MAX_IMAGE_BYTES = positive_int_env("MAX_IMAGE_MB", 10) * 1024 * 1024
MAX_IMAGE_PIXELS = positive_int_env("MAX_IMAGE_PIXELS", 25_000_000)
MAX_IMAGE_SIDE = positive_int_env("MAX_IMAGE_SIDE", 2000)
IMAGE_WORKERS = positive_int_env("IMAGE_WORKERS", 1)
ALLOWED_IMAGE_FORMATS = ("JPEG", "PNG", "WEBP")
_image_slots = threading.BoundedSemaphore(IMAGE_WORKERS)

# Let Pillow reject decompression bombs at the same pixel limit used by
# this service. The warning is promoted to an exception per decode below.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

# Compress PDF limits
MAX_PDF_BYTES = positive_int_env("MAX_PDF_MB", 50) * 1024 * 1024
MAX_PDF_PAGES = positive_int_env("MAX_PDF_PAGES", 500)
PDF_WORKERS = positive_int_env("PDF_WORKERS", 2)
_pdf_slots = threading.BoundedSemaphore(PDF_WORKERS)

# Images above dpi_threshold are downsampled to dpi_target.
PDF_LEVELS = {
    "low": {"dpi_threshold": 200, "dpi_target": 150, "quality": 85},
    "medium": {"dpi_threshold": 150, "dpi_target": 110, "quality": 70},
    "high": {"dpi_threshold": 120, "dpi_target": 72, "quality": 50},
}

app = FastAPI(title="Remove BG & PDF Tools API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Load the model once at startup, not for every request.
session = new_session("u2net")


def image_too_large() -> HTTPException:
    return HTTPException(
        413, f"Resolusi gambar terlalu besar. Maksimal {MAX_IMAGE_PIXELS:,} piksel."
    )


def _remove_background(data: bytes) -> bytes:
    """Decode, validate, process, and encode an uploaded image."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)

            with Image.open(
                io.BytesIO(data),
                formats=ALLOWED_IMAGE_FORMATS,
            ) as source:
                if source.format not in ALLOWED_IMAGE_FORMATS:
                    raise HTTPException(
                        400, "Format gambar yang didukung: JPG, PNG, dan WEBP."
                    )

                if source.width * source.height > MAX_IMAGE_PIXELS:
                    raise image_too_large()

                if getattr(source, "n_frames", 1) > 1:
                    raise HTTPException(
                        400,
                        "Gambar animasi belum didukung. Gunakan JPG, PNG, atau WEBP statis.",
                    )

                source.load()
                image = ImageOps.exif_transpose(source).convert("RGBA")

    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise image_too_large() from exc
    except (
        Image.UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        raise HTTPException(
            400, "File bukan gambar yang valid. Gunakan JPG, PNG, atau WEBP."
        ) from exc

    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))

    result = remove(image, session=session)
    output = io.BytesIO()
    # Do not copy source EXIF / metadata into the generated image.
    result.save(output, format="PNG")
    return output.getvalue()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    if not _image_slots.acquire(blocking=False):
        await file.close()
        raise HTTPException(
            503, "Server sedang memproses gambar lain. Coba lagi sebentar."
        )

    try:
        # Read only one byte above the limit. The slot is held during the
        # upload read and model inference to bound concurrent memory use.
        data = await file.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                413,
                f"File terlalu besar. Maksimal {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
            )

        try:
            # rembg / ONNX inference is synchronous. Keep it off the ASGI
            # event loop so health checks and other requests can still respond.
            output = await run_in_threadpool(_remove_background, data)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Background removal failed.")
            raise HTTPException(
                500, "Gagal memproses gambar. Silakan coba lagi."
            ) from exc
        return Response(content=output, media_type="image/png")
    finally:
        await file.close()
        _image_slots.release()


# A sync route is dispatched through Starlette's worker thread pool.
@app.post("/compress-pdf")
def compress_pdf(file: UploadFile = File(...), level: str = Form("medium")):
    if level not in PDF_LEVELS:
        file.file.close()
        raise HTTPException(400, "Level harus low, medium, atau high.")

    if not _pdf_slots.acquire(blocking=False):
        file.file.close()
        raise HTTPException(503, "Server sedang sibuk, coba lagi sebentar lagi.")

    try:
        data = file.file.read(MAX_PDF_BYTES + 1)
        if len(data) > MAX_PDF_BYTES:
            raise HTTPException(
                413,
                f"File terlalu besar, maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
            )
        if not data.startswith(b"%PDF-"):
            raise HTTPException(400, "File bukan PDF yang valid.")

        try:
            doc = pymupdf.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise HTTPException(400, "PDF rusak atau tidak bisa dibaca.") from exc

        try:
            if doc.needs_pass:
                raise HTTPException(
                    400, "PDF diproteksi password, tidak bisa dikompres."
                )

            if doc.page_count > MAX_PDF_PAGES:
                raise HTTPException(
                    413,
                    f"PDF terlalu banyak halaman. Maksimal {MAX_PDF_PAGES} halaman.",
                )

            # If image rewriting is unsupported for a particular PDF, keep
            # going with structural compression and record the reason.
            try:
                doc.rewrite_images(**PDF_LEVELS[level])
            except Exception:
                logger.warning(
                    "Could not rewrite embedded PDF images; "
                    "continuing with structural compression.",
                    exc_info=True,
                )

            try:
                output = doc.tobytes(
                    garbage=4,
                    deflate=True,
                    deflate_images=True,
                    deflate_fonts=True,
                )
            except Exception as exc:
                logger.exception("PDF serialization failed.")
                raise HTTPException(500, "Gagal mengompres PDF.") from exc
        finally:
            doc.close()

        # If compression did not reduce the file, return the original.
        if len(output) >= len(data):
            output = data

        return Response(content=output, media_type="application/pdf")
    finally:
        file.file.close()
        _pdf_slots.release()
