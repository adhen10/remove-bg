import logging

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
        "description": "Pisahkan dokumen atau ambil halaman tertentu.",
        "available": False,
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
