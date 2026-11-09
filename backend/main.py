import io
import os
import threading

import fitz  # PyMuPDF
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps
from rembg import new_session, remove

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# --- Remove background ---
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_SIDE = 2000               # resize sisi terpanjang supaya proses tidak lambat

# --- Compress PDF ---
MAX_PDF_BYTES = int(os.getenv("MAX_PDF_MB", "50")) * 1024 * 1024
# Batasi jumlah kompresi yang jalan bersamaan supaya server tidak penuh
_pdf_slots = threading.BoundedSemaphore(int(os.getenv("PDF_WORKERS", "2")))
# Gambar di atas dpi_threshold akan diturunkan ke dpi_target dengan kualitas JPEG tertentu.
# Teks dan vektor tidak ikut berubah, jadi tetap tajam.
PDF_LEVELS = {
    "low":    {"dpi_threshold": 200, "dpi_target": 150, "quality": 85},
    "medium": {"dpi_threshold": 150, "dpi_target": 110, "quality": 70},
    "high":   {"dpi_threshold": 120, "dpi_target": 72,  "quality": 50},
}

app = FastAPI(title="BG Remover & PDF Compressor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Model di-load sekali saat server start, bukan tiap request
session = new_session("u2net")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File terlalu besar, maksimal 10 MB.")

    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # perbaiki rotasi dari foto HP
        img = img.convert("RGBA")
    except Exception:
        raise HTTPException(400, "File bukan gambar yang valid.")

    img.thumbnail((MAX_SIDE, MAX_SIDE))

    result = remove(img, session=session)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


# Sengaja `def` (bukan `async def`): FastAPI menjalankannya di thread pool,
# jadi proses berat tidak memblokir endpoint lain.
@app.post("/compress-pdf")
def compress_pdf(file: UploadFile = File(...), level: str = Form("medium")):
    if level not in PDF_LEVELS:
        raise HTTPException(400, "Level harus low, medium, atau high.")

    data = file.file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(
            413, f"File terlalu besar, maksimal {MAX_PDF_BYTES // (1024 * 1024)} MB."
        )
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "File bukan PDF yang valid.")

    if not _pdf_slots.acquire(blocking=False):
        raise HTTPException(503, "Server sedang sibuk, coba lagi sebentar lagi.")

    try:
        try:
            doc = fitz.open(stream=data, filetype="pdf")
        except Exception:
            raise HTTPException(400, "PDF rusak atau tidak bisa dibaca.")

        try:
            if doc.needs_pass:
                raise HTTPException(400, "PDF diproteksi password, tidak bisa dikompres.")

            # Kecilkan gambar. Kalau gagal di PDF tertentu, lanjut dengan
            # optimasi struktur saja.
            try:
                doc.rewrite_images(**PDF_LEVELS[level])
            except Exception:
                pass

            try:
                out = doc.tobytes(
                    garbage=4,
                    deflate=True,
                    deflate_images=True,
                    deflate_fonts=True,
                )
            except Exception:
                raise HTTPException(500, "Gagal mengompres PDF.")
        finally:
            doc.close()
    finally:
        _pdf_slots.release()

    # Kalau hasilnya malah lebih besar, kembalikan file aslinya
    if len(out) >= len(data):
        out = data

    return Response(content=out, media_type="application/pdf")