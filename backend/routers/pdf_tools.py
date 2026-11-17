import logging
import threading

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from config import MAX_PDF_BYTES
from services.pdf_tools import get_pdf_tool_catalog, merge_pdf_bytes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf-tools", tags=["PDF Tools"])
_merge_slots = threading.BoundedSemaphore(1)


@router.get("/capabilities")
def get_pdf_tools():
    """Expose the PDF tools catalog and their current availability."""
    return {"tools": get_pdf_tool_catalog()}


@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Pilih minimal 2 file PDF untuk digabungkan.")

    if not _merge_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")

    try:
        payloads = []
        total_size = 0
        for uploaded in files:
            try:
                data = await uploaded.read(MAX_PDF_BYTES + 1)
            finally:
                await uploaded.close()

            total_size += len(data)
            if total_size > MAX_PDF_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Total ukuran file terlalu besar. Maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
                )
            payloads.append(data)

        try:
            output = merge_pdf_bytes(payloads)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("PDF merge failed.")
            raise HTTPException(status_code=500, detail="Gagal menggabungkan PDF. Silakan coba lagi.") from exc

        return Response(
            content=output,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="merged-document.pdf"'},
        )
    finally:
        _merge_slots.release()
