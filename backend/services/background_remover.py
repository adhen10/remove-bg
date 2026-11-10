import io

from PIL import Image
from rembg import new_session, remove

from config import MAX_IMAGE_SIDE
from utils.image_validation import decode_image

# The ONNX model is initialized once when the backend module is loaded.
_session = new_session("u2net")


def remove_background(data: bytes) -> bytes:
    """Remove an image background and return a transparent PNG."""
    image = decode_image(data).convert("RGBA")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)

    result = remove(image, session=_session)
    output = io.BytesIO()
    result.save(output, format="PNG")
    return output.getvalue()
