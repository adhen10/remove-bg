import logging
import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from config import MAX_PDF_BYTES, PDF_LEVELS, PDF_WORKERS
from services.pdf_compressor import compress_pdf_bytes

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

        try:
            output = compress_pdf_bytes(data, level)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("PDF compression failed.")
            raise HTTPException(
                status_code=500,
                detail="Gagal mengompres PDF. Silakan coba lagi.",
            ) from exc

        return Response(content=output, media_type="application/pdf")
    finally:
        try:
            file.file.close()
        finally:
            _pdf_slots.release()
