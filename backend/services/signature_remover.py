import io

import numpy as np
from fastapi import HTTPException
from PIL import Image

from config import MAX_SIGNATURE_PIXELS
from utils.image_validation import decode_image


def remove_light_background(data: bytes, sensitivity: int = 18) -> bytes:
    """Remove a mostly white/light paper background while preserving ink detail.

    Sensitivity controls how much faint background variation is discarded.
    Higher values can also trim very light antialiased strokes.
    """
    if not 0 <= sensitivity <= 100:
        raise HTTPException(
            status_code=400,
            detail="Sensitivitas harus berada pada rentang 0 sampai 100.",
        )

    image = decode_image(data)
    if image.width * image.height > MAX_SIGNATURE_PIXELS:
        raise HTTPException(
            status_code=413,
            detail=(
                "Resolusi terlalu besar untuk mode Signature / Document. "
                f"Maksimal {MAX_SIGNATURE_PIXELS:,} piksel."
            ),
        )

    rgba_image = image.convert("RGBA")
    rgb_image = rgba_image.convert("RGB")
    rgb = np.asarray(rgb_image, dtype=np.uint8)
    source_alpha = np.asarray(rgba_image.getchannel("A"), dtype=np.uint8)
    height, width = rgb.shape[:2]

    # Sample a narrow band from all four edges to estimate the paper color.
    border_width = max(1, min(24, min(width, height) // 20))
    border_pixels = np.concatenate(
        (
            rgb[:border_width, :, :].reshape(-1, 3),
            rgb[-border_width:, :, :].reshape(-1, 3),
            rgb[:, :border_width, :].reshape(-1, 3),
            rgb[:, -border_width:, :].reshape(-1, 3),
        ),
        axis=0,
    )
    border_alpha = np.concatenate(
        (
            source_alpha[:border_width, :].reshape(-1),
            source_alpha[-border_width:, :].reshape(-1),
            source_alpha[:, :border_width].reshape(-1),
            source_alpha[:, -border_width:].reshape(-1),
        ),
        axis=0,
    )
    opaque_border_pixels = border_pixels[border_alpha == 255]
    if opaque_border_pixels.size == 0:
        raise HTTPException(
            status_code=400,
            detail="Tidak ditemukan area kertas terang untuk memperkirakan background.",
        )
    background_rgb = np.median(opaque_border_pixels, axis=0).astype(np.float32)

    background_luminance = float(
        np.dot(background_rgb, np.array([0.299, 0.587, 0.114], dtype=np.float32))
    )
    if background_luminance < 175:
        raise HTTPException(
            status_code=400,
            detail=(
                "Mode tanda tangan/dokumen dirancang untuk background putih atau terang. "
                "Gunakan mode AI untuk background gelap atau kompleks."
            ),
        )

    # Keep temporary floating-point arrays limited to a few image rows at a time.
    # This avoids large memory spikes when users process high-resolution scans.
    output_pixels = np.empty((height, width, 4), dtype=np.uint8)
    background_safe = np.maximum(background_rgb, 1.0)
    alpha_cutoff = (sensitivity / 100.0) * 0.12

    for top in range(0, height, 256):
        bottom = min(top + 256, height)
        pixels = rgb[top:bottom].astype(np.float32)

        # Contrast against the estimated paper color produces an opacity mask.
        normalized = pixels / background_safe[None, None, :]
        alpha = 1.0 - np.min(normalized, axis=2)
        alpha = np.clip(alpha, 0.0, 1.0)
        alpha[alpha < alpha_cutoff] = 0.0

        # Retain alpha already present in transparent PNG inputs.
        if np.any(source_alpha[top:bottom] < 255):
            alpha *= source_alpha[top:bottom].astype(np.float32) / 255.0

        # Un-matte antialiased edge pixels so the pen color does not retain
        # a pale paper fringe when composited onto a dark surface.
        alpha_expanded = np.maximum(alpha[:, :, None], 1e-6)
        foreground = (
            pixels - (1.0 - alpha[:, :, None]) * background_rgb[None, None, :]
        ) / alpha_expanded
        foreground = np.clip(foreground, 0, 255)
        foreground[alpha == 0] = 0

        output_pixels[top:bottom, :, :3] = np.rint(foreground).astype(np.uint8)
        output_pixels[top:bottom, :, 3] = np.rint(alpha * 255.0).astype(np.uint8)

    output = io.BytesIO()
    Image.fromarray(output_pixels, mode="RGBA").save(
        output,
        format="PNG",
        optimize=True,
    )
    return output.getvalue()
