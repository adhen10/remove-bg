import logging

import pymupdf
from fastapi import HTTPException

from config import MAX_PDF_PAGES, PDF_LEVELS

logger = logging.getLogger(__name__)


def compress_pdf_bytes(data: bytes, level: str) -> bytes:
    """Validate and compress a PDF payload."""
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File bukan PDF yang valid.")

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="PDF rusak atau tidak bisa dibaca.",
        ) from exc

    try:
        if document.needs_pass:
            raise HTTPException(
                status_code=400,
                detail="PDF diproteksi password, tidak bisa dikompres.",
            )

        if document.page_count > MAX_PDF_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF terlalu banyak halaman. Maksimal {MAX_PDF_PAGES} halaman.",
            )

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
