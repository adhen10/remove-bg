import logging
import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from config import IMAGE_WORKERS, MAX_IMAGE_BYTES
from services.background_remover import remove_background
from services.image_converter import convert_image_bytes
from services.signature_remover import remove_light_background

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Images"])
_image_slots = threading.BoundedSemaphore(IMAGE_WORKERS)


async def _read_image_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File terlalu besar. Maksimal {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )
    if not data:
        raise HTTPException(status_code=400, detail="File gambar kosong.")
    return data


def _busy_response() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="Server sedang memproses gambar lain. Coba lagi sebentar.",
    )


@router.post("/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    mode: str = Form("ai"),
    sensitivity: int = Form(18),
):
    mode = mode.strip().lower()
    if mode not in {"ai", "signature"}:
        await file.close()
        raise HTTPException(
            status_code=400,
            detail="Mode harus ai atau signature.",
        )

    if not _image_slots.acquire(blocking=False):
        await file.close()
        raise _busy_response()

    try:
        data = await _read_image_upload(file)
        try:
            if mode == "signature":
                output = await run_in_threadpool(
                    remove_light_background,
                    data,
                    sensitivity,
                )
            else:
                output = await run_in_threadpool(remove_background, data)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Background removal failed (mode=%s).", mode)
            raise HTTPException(
                status_code=500,
                detail="Gagal memproses gambar. Silakan coba lagi.",
            ) from exc

        return Response(content=output, media_type="image/png")
    finally:
        try:
            await file.close()
        finally:
            _image_slots.release()


@router.post("/convert-image")
async def convert_image(
    file: UploadFile = File(...),
    output_format: str = Form(...),
    quality: int = Form(90),
    background_color: str = Form("#ffffff"),
):
    if not _image_slots.acquire(blocking=False):
        await file.close()
        raise _busy_response()

    try:
        data = await _read_image_upload(file)
        try:
            output, media_type, extension = await run_in_threadpool(
                convert_image_bytes,
                data,
                output_format,
                quality,
                background_color,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Image conversion failed.")
            raise HTTPException(
                status_code=500,
                detail="Gagal mengonversi gambar. Silakan coba lagi.",
            ) from exc

        return Response(
            content=output,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="converted-image.{extension}"'
            },
        )
    finally:
        try:
            await file.close()
        finally:
            _image_slots.release()
