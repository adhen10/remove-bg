import io
import re

from fastapi import HTTPException
from PIL import Image

from utils.image_validation import decode_image

OUTPUT_FORMATS = {
    "png": ("PNG", "image/png", "png"),
    "jpg": ("JPEG", "image/jpeg", "jpg"),
    "jpeg": ("JPEG", "image/jpeg", "jpg"),
    "webp": ("WEBP", "image/webp", "webp"),
    "bmp": ("BMP", "image/bmp", "bmp"),
    "tiff": ("TIFF", "image/tiff", "tiff"),
}


def convert_image_bytes(
    data: bytes,
    output_format: str,
    quality: int = 90,
    background_color: str = "#ffffff",
) -> tuple[bytes, str, str]:
    """Convert a supported image to PNG, JPEG, or WEBP."""
    selected_format = OUTPUT_FORMATS.get(output_format.strip().lower())
    if selected_format is None:
        raise HTTPException(
            status_code=400,
            detail="Format tujuan harus PNG, JPG, atau WEBP.",
        )

    if not 1 <= quality <= 100:
        raise HTTPException(
            status_code=400,
            detail="Kualitas gambar harus berada pada rentang 1 sampai 100.",
        )

    if not re.fullmatch(r"#[0-9a-fA-F]{6}", background_color):
        raise HTTPException(
            status_code=400,
            detail="Warna latar harus menggunakan format HEX, misalnya #ffffff.",
        )

    pillow_format, media_type, extension = selected_format
    image = decode_image(data)
    has_alpha = "A" in image.getbands() or "transparency" in image.info

    if pillow_format in {"JPEG", "BMP"}:
        rgba_image = image.convert("RGBA")
        flattened = Image.new("RGB", rgba_image.size, background_color)
        flattened.paste(rgba_image, mask=rgba_image.getchannel("A"))
        output_image = flattened
    elif pillow_format == "PNG":
        output_image = image.convert("RGBA" if has_alpha else "RGB")
    else:
        output_image = image.convert("RGBA" if has_alpha else "RGB")

    output = io.BytesIO()
    if pillow_format == "PNG":
        output_image.save(output, format="PNG", optimize=True)
    elif pillow_format == "JPEG":
        output_image.save(
            output,
            format="JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
        )
    else:
        output_image.save(
            output,
            format="WEBP",
            quality=quality,
            method=6,
        )

    return output.getvalue(), media_type, extension
