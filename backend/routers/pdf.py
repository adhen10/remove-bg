import logging
import threading

import pymupdf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from config import MAX_PDF_BYTES, MAX_PDF_PAGES, PDF_LEVELS, PDF_WORKERS

logger = logging.getLogger(__name__)
router = APIRouter(tags=["PDF"])
_pdf_slots = threading.BoundedSemaphore(PDF_WORKERS)


@router.post("/compress-pdf")
def compress_pdf(file: UploadFile = File(...), level: str = Form("medium")):
    if level not in PDF_LEVELS:
        file.file.close()
        raise HTTPException(
            status_code=400,
            detail="Level harus low, medium, atau high.",
        )

    if not _pdf_slots.acquire(blocking=False):
        file.file.close()
        raise HTTPException(
            status_code=503,
            detail="Server sedang sibuk, coba lagi sebentar lagi.",
        )

    try:
        data = file.file.read(MAX_PDF_BYTES + 1)
        if len(data) > MAX_PDF_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File terlalu besar, maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
            )
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

        if len(output) >= len(data):
            output = data

        return Response(content=output, media_type="application/pdf")
    finally:
        try:
            file.file.close()
        finally:
            _pdf_slots.release()
