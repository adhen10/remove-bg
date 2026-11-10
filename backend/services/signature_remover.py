import io

import numpy as np
from fastapi import HTTPException
from PIL import Image

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
    if "A" in image.getbands() and image.getchannel("A").getextrema() != (255, 255):
        # Keep existing transparency when the input already contains alpha.
        source_alpha = np.asarray(image.getchannel("A"), dtype=np.float32) / 255.0
    else:
        source_alpha = None

    rgb = image.convert("RGB")
    pixels = np.asarray(rgb, dtype=np.float32)
    height, width = pixels.shape[:2]

    # Sample a narrow band from all four edges to estimate the paper color.
    border_width = max(1, min(24, min(width, height) // 20))
    border_pixels = np.concatenate(
        (
            pixels[:border_width, :, :].reshape(-1, 3),
            pixels[-border_width:, :, :].reshape(-1, 3),
            pixels[:, :border_width, :].reshape(-1, 3),
            pixels[:, -border_width:, :].reshape(-1, 3),
        ),
        axis=0,
    )
    background_rgb = np.median(border_pixels, axis=0)

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

    # Estimate opacity from the strongest channel difference to the paper.
    # This also helps recover the original pen color from JPEG edge blending.
    background_safe = np.maximum(background_rgb, 1.0)
    normalized = pixels / background_safe[None, None, :]
    alpha = 1.0 - np.min(normalized, axis=2)
    alpha = np.clip(alpha, 0.0, 1.0)

    # Discard faint compression noise; stronger settings trade fine edges for
    # a cleaner paper removal.
    alpha_cutoff = (sensitivity / 100.0) * 0.12
    alpha[alpha < alpha_cutoff] = 0.0

    if source_alpha is not None:
        alpha *= source_alpha

    # Remove the light paper matte from partially covered edge pixels.
    alpha_expanded = np.maximum(alpha[:, :, None], 1e-6)
    foreground = (
        pixels - (1.0 - alpha[:, :, None]) * background_rgb[None, None, :]
    ) / alpha_expanded
    foreground = np.clip(foreground, 0, 255)

    # RGB values are not visible where alpha is zero; black avoids storing
    # leftover paper color in fully transparent pixels.
    foreground[alpha == 0] = 0

    rgba = np.dstack(
        (
            np.rint(foreground).astype(np.uint8),
            np.rint(alpha * 255.0).astype(np.uint8),
        )
    )

    output = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(output, format="PNG", optimize=True)
    return output.getvalue()
