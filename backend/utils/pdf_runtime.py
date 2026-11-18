import threading

from fastapi import HTTPException, UploadFile

from config import MAX_PDF_BYTES, PDF_WORKERS

# One shared gate prevents the image-independent PDF endpoints from exceeding
# the configured concurrency when they are served by the same process.
PDF_PROCESSING_SLOTS = threading.BoundedSemaphore(PDF_WORKERS)


def acquire_pdf_slot() -> None:
    if not PDF_PROCESSING_SLOTS.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Server sedang sibuk, coba lagi sebentar lagi.")


async def read_pdf_upload(uploaded: UploadFile) -> bytes:
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


def read_pdf_file(uploaded) -> bytes:
    try:
        data = uploaded.file.read(MAX_PDF_BYTES + 1)
    finally:
        uploaded.file.close()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file terlalu besar. Maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB.",
        )
    return data
