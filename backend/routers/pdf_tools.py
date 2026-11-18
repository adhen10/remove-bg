import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from config import MAX_PDF_BYTES
from services.pdf_tools import (
    add_pdf_page_numbers,
    extract_pdf_pages,
    get_pdf_tool_catalog,
    merge_pdf_bytes,
    organize_pdf_pages,
    preview_pdf_pages,
    rotate_pdf_pages,
    split_pdf_pages,
)
from utils.pdf_runtime import acquire_pdf_slot, read_pdf_upload, release_pdf_slot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pdf-tools", tags=["PDF Tools"])


@router.get("/capabilities")
def get_pdf_tools():
    return {"tools": get_pdf_tool_catalog()}


@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Pilih minimal 2 file PDF untuk digabungkan.")
    acquire_pdf_slot()
    try:
        payloads = []
        total_size = 0
        for uploaded in files:
            data = await read_pdf_upload(uploaded)
            total_size += len(data)
            if total_size > MAX_PDF_BYTES:
                raise HTTPException(status_code=413, detail=f"Total ukuran file terlalu besar. Maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.")
            payloads.append(data)
        output = merge_pdf_bytes(payloads)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="merged-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF merge failed.")
        raise HTTPException(status_code=500, detail="Gagal menggabungkan PDF. Silakan coba lagi.") from exc
    finally:
        release_pdf_slot()


@router.post("/split")
async def split_or_extract_pdf(file: UploadFile = File(...), mode: str = Form("extract"), pages: str = Form("")):
    if mode not in {"extract", "split"}:
        raise HTTPException(status_code=400, detail="Mode pemrosesan tidak dikenal.")
    acquire_pdf_slot()
    try:
        data = await read_pdf_upload(file)
        if mode == "extract":
            output = extract_pdf_pages(data, pages)
            return Response(content=output, media_type="application/pdf",
                headers={"Content-Disposition": 'attachment; filename="extracted-pages.pdf"'})
        output = split_pdf_pages(data)
        return Response(content=output, media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="split-pages.zip"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF split/extract failed.")
        raise HTTPException(status_code=500, detail="Gagal memproses PDF. Silakan coba lagi.") from exc
    finally:
        release_pdf_slot()


@router.post("/rotate")
async def rotate_pdf(file: UploadFile = File(...), rotation: int = Form(90), pages: str = Form("")):
    acquire_pdf_slot()
    try:
        output = rotate_pdf_pages(await read_pdf_upload(file), rotation, pages)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="rotated-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF rotation failed.")
        raise HTTPException(status_code=500, detail="Gagal memutar PDF. Silakan coba lagi.") from exc
    finally:
        release_pdf_slot()


@router.post("/organize/preview")
async def preview_organize_pdf(file: UploadFile = File(...)):
    acquire_pdf_slot()
    try:
        return {"pages": preview_pdf_pages(await read_pdf_upload(file))}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF preview failed.")
        raise HTTPException(status_code=500, detail="Gagal membuat preview PDF.") from exc
    finally:
        release_pdf_slot()


@router.post("/organize")
async def organize_pdf(
    file: UploadFile = File(...),
    page_order: str = Form(...),
    add_numbers: bool = Form(False),
    position: str = Form("bottom-center"),
    format_type: str = Form("number"),
    start_number: int = Form(1),
    start_page: int = Form(1),
    font_size: int = Form(10),
    margin: int = Form(28),
):
    acquire_pdf_slot()
    try:
        data = await read_pdf_upload(file)
        try:
            order = json.loads(page_order)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Urutan halaman tidak valid.") from exc
        if not isinstance(order, list):
            raise HTTPException(status_code=400, detail="Urutan halaman harus berupa daftar nomor halaman.")
        output = organize_pdf_pages(data, order)
        if add_numbers:
            output = add_pdf_page_numbers(output, position, format_type, start_number, start_page, font_size, margin)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="organized-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF organization failed.")
        raise HTTPException(status_code=500, detail="Gagal mengatur halaman PDF.") from exc
    finally:
        release_pdf_slot()


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
    acquire_pdf_slot()
    try:
        output = add_pdf_page_numbers(await read_pdf_upload(file), position, format_type, start_number, start_page, font_size, margin)
        return Response(content=output, media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="numbered-document.pdf"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF page numbering failed.")
        raise HTTPException(status_code=500, detail="Gagal menambahkan nomor halaman.") from exc
    finally:
        release_pdf_slot()
