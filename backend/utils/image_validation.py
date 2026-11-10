from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps

from config import ALLOWED_IMAGE_FORMATS, MAX_IMAGE_PIXELS


def image_too_large() -> HTTPException:
    return HTTPException(
        status_code=413,
        detail=f"Resolusi gambar terlalu besar. Maksimal {MAX_IMAGE_PIXELS:,} piksel.",
    )


def decode_image(data: bytes) -> Image.Image:
    """Decode a supported, static image and normalize its EXIF orientation."""
    try:
        with Image.open(BytesIO(data), formats=ALLOWED_IMAGE_FORMATS) as source:
            if source.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail="Format gambar yang didukung: JPG, PNG, dan WEBP.",
                )

            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise image_too_large()

            if getattr(source, "n_frames", 1) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="Gambar animasi belum didukung. Gunakan JPG, PNG, atau WEBP statis.",
                )

            source.load()
            return ImageOps.exif_transpose(source).copy()

    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise image_too_large() from exc
    except (Image.UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="File bukan gambar yang valid. Gunakan JPG, PNG, atau WEBP.",
        ) from exc
