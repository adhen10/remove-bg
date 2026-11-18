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
    {
        "id": "merge",
        "name": "Merge PDF",
        "description": "Gabungkan beberapa dokumen PDF menjadi satu file.",
        "available": True,
        "href": "/pdf-tools/merge",
    },
    {
        "id": "split",
        "name": "Split & Extract PDF",
        "description": "Pisahkan PDF per halaman atau ambil halaman tertentu.",
        "available": True,
        "href": "/pdf-tools/split",
    },
    {
        "id": "rotate",
        "name": "Rotate PDF",
        "description": "Putar halaman PDF sesuai orientasi yang dibutuhkan.",
        "available": False,
    },
    {
        "id": "organize",
        "name": "Organize PDF",
        "description": "Atur urutan halaman dan hapus halaman yang tidak diperlukan.",
        "available": False,
    },
    {
        "id": "page-number",
        "name": "Page Number",
        "description": "Tambahkan nomor halaman pada dokumen PDF.",
        "available": False,
    },
    {
        "id": "compress",
        "name": "Compress PDF",
        "description": "Kurangi ukuran file PDF.",
        "available": True,
        "href": "/compress-pdf",
    },
]


def get_pdf_tool_catalog() -> list[dict[str, str | bool]]:
    """Return the PDF tools currently available in the workspace."""
    return PDF_TOOL_CATALOG


def parse_page_ranges(value: str, page_count: int) -> list[int]:
    """Parse 1-based page expressions such as '1-3,5' into zero-based indexes."""
    if not value or not value.strip():
        raise HTTPException(status_code=400, detail="Masukkan nomor halaman yang ingin diekstrak.")

    pages: list[int] = []
    seen: set[int] = set()
    for part in value.split(","):
        token = part.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", token)
        if not match:
            raise HTTPException(status_code=400, detail="Format halaman tidak valid. Gunakan contoh 1-3,5,8-10.")

        start = int(match.group(1))
        end = int(match.group(2) or start)
        if start < 1 or end < start or end > page_count:
            raise HTTPException(
                status_code=400,
                detail=f"Rentang halaman harus berada antara 1 sampai {page_count}.",
            )

        for page_number in range(start, end + 1):
            if page_number in seen:
                raise HTTPException(status_code=400, detail="Nomor halaman tidak boleh berulang.")
            seen.add(page_number)
            pages.append(page_number - 1)

    return pages


def merge_pdf_bytes(files: list[bytes]) -> bytes:
    """Merge validated PDF payloads in the order provided."""
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
                raise HTTPException(
                    status_code=413,
                    detail=f"Total halaman PDF melebihi batas {MAX_PDF_PAGES} halaman.",
                )
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
    """Create one PDF containing the selected pages in the requested order."""
    source = open_validated_pdf(data)
    output = pymupdf.open()
    try:
        selected = parse_page_ranges(page_expression, source.page_count)
        for page_index in selected:
            output.insert_pdf(source, from_page=page_index, to_page=page_index)
        return output.tobytes(garbage=3, deflate=True)
    finally:
        source.close()
        output.close()


def split_pdf_pages(data: bytes) -> bytes:
    """Create a ZIP archive containing one PDF for each source page."""
    source = open_validated_pdf(data)
    archive_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for page_index in range(source.page_count):
                single_page = pymupdf.open()
                try:
                    single_page.insert_pdf(source, from_page=page_index, to_page=page_index)
                    archive.writestr(
                        f"page-{page_index + 1:03d}.pdf",
                        single_page.tobytes(garbage=3, deflate=True),
                    )
                finally:
                    single_page.close()
        return archive_buffer.getvalue()
    finally:
        source.close()
