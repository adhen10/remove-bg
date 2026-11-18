import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from config import PDF_LEVELS
from services.pdf_compressor import compress_pdf_bytes
from utils.pdf_runtime import acquire_pdf_slot, read_pdf_file, release_pdf_slot

logger = logging.getLogger(__name__)
router = APIRouter(tags=["PDF"])


@router.post("/compress-pdf")
def compress_pdf(file: UploadFile = File(...), level: str = Form("medium")):
    if level not in PDF_LEVELS:
        file.file.close()
        raise HTTPException(status_code=400, detail="Level harus low, medium, atau high.")

    acquire_pdf_slot()
    try:
        output = compress_pdf_bytes(read_pdf_file(file), level)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="compressed-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF compression failed.")
        raise HTTPException(status_code=500, detail="Gagal mengompres PDF. Silakan coba lagi.") from exc
    finally:
        release_pdf_slot()
