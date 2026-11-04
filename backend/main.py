import io
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps
from rembg import new_session, remove

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_SIDE = 2000               # resize sisi terpanjang supaya proses tidak lambat

app = FastAPI(title="BG Remover API")
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