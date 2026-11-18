import base64
import io
import logging
import re
import zipfile

import pymupdf
from fastapi import HTTPException

from config import MAX_PDF_PAGES
from utils.pdf_validation import open_validated_pdf

logger = logging.getLogger(__name__)

PDF_TOOL_CATALOG = [
    {"id": "merge", "name": "Merge PDF", "description": "Gabungkan beberapa dokumen PDF menjadi satu file.", "available": True, "href": "/pdf-tools/merge"},
    {"id": "split", "name": "Split & Extract PDF", "description": "Pisahkan PDF per halaman atau ambil halaman tertentu.", "available": True, "href": "/pdf-tools/split"},
    {"id": "rotate", "name": "Rotate PDF", "description": "Putar halaman PDF sesuai orientasi yang dibutuhkan.", "available": True, "href": "/pdf-tools/rotate"},
    {"id": "organize", "name": "Organize PDF", "description": "Atur urutan halaman dan hapus halaman yang tidak diperlukan.", "available": True, "href": "/pdf-tools/organize"},
    {"id": "page-number", "name": "Page Number", "description": "Tambahkan nomor halaman pada dokumen PDF.", "available": False},
    {"id": "compress", "name": "Compress PDF", "description": "Kurangi ukuran file PDF.", "available": True, "href": "/compress-pdf"},
]


def get_pdf_tool_catalog() -> list[dict[str, str | bool]]:
    return PDF_TOOL_CATALOG


def parse_page_ranges(value: str, page_count: int) -> list[int]:
    if not value or not value.strip():
        raise HTTPException(status_code=400, detail="Masukkan nomor halaman yang ingin diekstrak.")
    pages: list[int] = []
    seen: set[int] = set()
    for part in value.split(","):
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", part.strip())
        if not match:
            raise HTTPException(status_code=400, detail="Format halaman tidak valid. Gunakan contoh 1-3,5,8-10.")
        start, end = int(match.group(1)), int(match.group(2) or match.group(1))
        if start < 1 or end < start or end > page_count:
            raise HTTPException(status_code=400, detail=f"Rentang halaman harus berada antara 1 sampai {page_count}.")
        for number in range(start, end + 1):
            if number in seen:
                raise HTTPException(status_code=400, detail="Nomor halaman tidak boleh berulang.")
            seen.add(number)
            pages.append(number - 1)
    return pages


def merge_pdf_bytes(files: list[bytes]) -> bytes:
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Pilih minimal 2 file PDF untuk digabungkan.")
    merged = pymupdf.open()
    documents = []
    try:
        total_pages = 0
        for data in files:
            document = open_validated_pdf(data)
            documents.append(document)
            total_pages += document.page_count
            if total_pages > MAX_PDF_PAGES:
                raise HTTPException(status_code=413, detail=f"Total halaman PDF melebihi batas {MAX_PDF_PAGES} halaman.")
            merged.insert_pdf(document)
        return merged.tobytes(garbage=3, deflate=True)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not merge PDF documents.")
        raise HTTPException(status_code=400, detail="Salah satu PDF tidak dapat digabungkan.") from exc
    finally:
        merged.close()
        for document in documents:
            document.close()


def extract_pdf_pages(data: bytes, page_expression: str) -> bytes:
    source = open_validated_pdf(data)
    output = pymupdf.open()
    try:
        for index in parse_page_ranges(page_expression, source.page_count):
            output.insert_pdf(source, from_page=index, to_page=index)
        return output.tobytes(garbage=3, deflate=True)
    finally:
        source.close()
        output.close()


def split_pdf_pages(data: bytes) -> bytes:
    source = open_validated_pdf(data)
    archive_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for index in range(source.page_count):
                single_page = pymupdf.open()
                try:
                    single_page.insert_pdf(source, from_page=index, to_page=index)
                    archive.writestr(f"page-{index + 1:03d}.pdf", single_page.tobytes(garbage=3, deflate=True))
                finally:
                    single_page.close()
        return archive_buffer.getvalue()
    finally:
        source.close()


def rotate_pdf_pages(data: bytes, rotation: int, page_expression: str = "") -> bytes:
    if rotation not in {90, 180, 270}:
        raise HTTPException(status_code=400, detail="Rotasi harus 90, 180, atau 270 derajat.")
    source = open_validated_pdf(data)
    try:
        selected = set(parse_page_ranges(page_expression, source.page_count)) if page_expression.strip() else set(range(source.page_count))
        for index in selected:
            page = source[index]
            page.set_rotation((page.rotation + rotation) % 360)
        return source.tobytes(garbage=3, deflate=True)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not rotate PDF pages.")
        raise HTTPException(status_code=400, detail="PDF tidak dapat diputar.") from exc
    finally:
        source.close()


def preview_pdf_pages(data: bytes) -> list[dict[str, int | str]]:
    """Render compact page thumbnails for the organizer UI."""
    source = open_validated_pdf(data)
    pages = []
    try:
        for index, page in enumerate(source):
            rect = page.rect
            scale = min(0.32, 112 / max(rect.width, rect.height))
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB, alpha=False)
            image = pixmap.tobytes("jpeg", jpg_quality=48)
            pages.append({
                "page_number": index + 1,
                "width": pixmap.width,
                "height": pixmap.height,
                "thumbnail": "data:image/jpeg;base64," + base64.b64encode(image).decode("ascii"),
            })
        return pages
    finally:
        source.close()


def organize_pdf_pages(data: bytes, page_order: list[int]) -> bytes:
    """Rebuild a PDF in the supplied 1-based order; omitted pages are deleted."""
    source = open_validated_pdf(data)
    output = pymupdf.open()
    try:
        if not page_order:
            raise HTTPException(status_code=400, detail="Dokumen harus memiliki minimal satu halaman.")
        if len(page_order) > source.page_count:
            raise HTTPException(status_code=400, detail="Urutan halaman tidak valid.")
        if any(not isinstance(number, int) or number < 1 or number > source.page_count for number in page_order):
            raise HTTPException(status_code=400, detail="Nomor halaman tidak valid.")
        if len(set(page_order)) != len(page_order):
            raise HTTPException(status_code=400, detail="Halaman tidak boleh dipilih lebih dari satu kali.")
        for number in page_order:
            output.insert_pdf(source, from_page=number - 1, to_page=number - 1)
        return output.tobytes(garbage=3, deflate=True)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not organize PDF pages.")
        raise HTTPException(status_code=400, detail="PDF tidak dapat diatur.") from exc
    finally:
        source.close()
        output.close()
