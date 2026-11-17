import logging

from fastapi import HTTPException

from config import PDF_LEVELS
from utils.pdf_validation import open_validated_pdf

logger = logging.getLogger(__name__)


def compress_pdf_bytes(data: bytes, level: str) -> bytes:
    """Validate and compress a PDF payload."""
    if level not in PDF_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Level harus low, medium, atau high.",
        )

    document = open_validated_pdf(data)

    try:
        try:
            document.rewrite_images(**PDF_LEVELS[level])
        except Exception:
            logger.warning(
                "Could not rewrite embedded PDF images; continuing with structural compression.",
                exc_info=True,
            )

        try:
            output = document.tobytes(
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
            )
        except Exception as exc:
            logger.exception("PDF serialization failed.")
            raise HTTPException(
                status_code=500,
                detail="Gagal mengompres PDF.",
            ) from exc
    finally:
        document.close()

    # If compression did not reduce the file, return the original.
    return output if len(output) < len(data) else data
