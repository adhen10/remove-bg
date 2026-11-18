import json
import logging
import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from config import MAX_PDF_BYTES
from services.pdf_tools import (
    extract_pdf_pages,
    get_pdf_tool_catalog,
    merge_pdf_bytes,
    split_pdf_pages,
    rotate_pdf_pages,
    preview_pdf_pages,
    organize_pdf_pages,
    add_pdf_page_numbers,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf-tools", tags=["PDF Tools"])
_pdf_slots = threading.BoundedSemaphore(1)


@router.get("/capabilities")
def get_pdf_tools():
    """Expose the PDF tools catalog and their current availability."""
    return {"tools": get_pdf_tool_catalog()}


async def _read_pdf_upload(uploaded: UploadFile) -> bytes:
    try:
        data = await uploaded.read(MAX_PDF_BYTES + 1)
    finally:
        await uploaded.close()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file terlalu besar. Maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
        )
    return data


@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Pilih minimal 2 file PDF untuk digabungkan.")

    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")

    try:
        payloads = []
        total_size = 0
        for uploaded in files:
            data = await _read_pdf_upload(uploaded)
            total_size += len(data)
            if total_size > MAX_PDF_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Total ukuran file terlalu besar. Maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
                )
            payloads.append(data)

        output = merge_pdf_bytes(payloads)
        return Response(
            content=output,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="merged-document.pdf"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF merge failed.")
        raise HTTPException(status_code=500, detail="Gagal menggabungkan PDF. Silakan coba lagi.") from exc
    finally:
        _pdf_slots.release()


@router.post("/rotate")
async def rotate_pdf(
    file: UploadFile = File(...),
    rotation: int = Form(90),
    pages: str = Form(""),
):
    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")
    try:
        data = await _read_pdf_upload(file)
        output = rotate_pdf_pages(data, rotation, pages)
        return Response(
            content=output,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="rotated-document.pdf"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF rotation failed.")
        raise HTTPException(status_code=500, detail="Gagal memutar PDF. Silakan coba lagi.") from exc
    finally:
        _pdf_slots.release()



@router.post("/organize/preview")
async def preview_organize_pdf(file: UploadFile = File(...)):
    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")
    try:
        data = await _read_pdf_upload(file)
        return {"pages": preview_pdf_pages(data)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF preview failed.")
        raise HTTPException(status_code=500, detail="Gagal membuat preview PDF.") from exc
    finally:
        _pdf_slots.release()


@router.post("/organize")
async def organize_pdf(file: UploadFile = File(...), page_order: str = Form(...)):
    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")
    try:
        data = await _read_pdf_upload(file)
        try:
            order = json.loads(page_order)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Urutan halaman tidak valid.") from exc
        if not isinstance(order, list):
            raise HTTPException(status_code=400, detail="Urutan halaman harus berupa daftar nomor halaman.")
        output = organize_pdf_pages(data, order)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="organized-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF organization failed.")
        raise HTTPException(status_code=500, detail="Gagal mengatur halaman PDF.") from exc
    finally:
        _pdf_slots.release()


@router.post("/page-number")
async def number_pdf_pages(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    format_type: str = Form("number"),
    start_number: int = Form(1),
    start_page: int = Form(1),
    font_size: int = Form(10),
    margin: int = Form(28),
):
    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")
    try:
        data = await _read_pdf_upload(file)
        output = add_pdf_page_numbers(data, position, format_type, start_number, start_page, font_size, margin)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="numbered-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF page numbering failed.")
        raise HTTPException(status_code=500, detail="Gagal menambahkan nomor halaman.") from exc
    finally:
        _pdf_slots.release()


@router.post("/split")
async def split_or_extract_pdf(
    file: UploadFile = File(...),
    mode: str = Form("extract"),
    pages: str = Form(""),
):
    if mode not in {"extract", "split"}:
        raise HTTPException(status_code=400, detail="Mode pemrosesan tidak dikenal.")

    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")

    try:
        data = await _read_pdf_upload(file)
        if mode == "extract":
            output = extract_pdf_pages(data, pages)
            return Response(
                content=output,
                media_type="application/pdf",
                headers={"Content-Disposition": 'attachment; filename="extracted-pages.pdf"'},
            )

        output = split_pdf_pages(data)
        return Response(
            content=output,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="split-pages.zip"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF split/extract failed.")
        raise HTTPException(status_code=500, detail="Gagal memproses PDF. Silakan coba lagi.") from exc
    finally:
        _pdf_slots.release()
