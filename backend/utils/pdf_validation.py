import pymupdf
from fastapi import HTTPException

from config import MAX_PDF_PAGES


def open_validated_pdf(data: bytes) -> pymupdf.Document:
    """Open a PDF after applying the shared file, encryption, and page checks."""
    if not data:
        raise HTTPException(status_code=400, detail="File PDF kosong.")

    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File bukan PDF yang valid.")

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="PDF rusak atau tidak bisa dibaca.",
        ) from exc

    if document.needs_pass:
        document.close()
        raise HTTPException(
            status_code=400,
            detail="PDF diproteksi password, tidak bisa diproses.",
        )

    if document.page_count < 1:
        document.close()
        raise HTTPException(
            status_code=400,
            detail="PDF tidak memiliki halaman yang bisa diproses.",
        )

    if document.page_count > MAX_PDF_PAGES:
        document.close()
        raise HTTPException(
            status_code=413,
            detail=f"PDF terlalu banyak halaman. Maksimal {MAX_PDF_PAGES} halaman.",
        )

    return document
