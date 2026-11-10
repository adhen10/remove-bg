from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from routers.image import router as image_router
from routers.pdf import router as pdf_router

app = FastAPI(title="Remove BG & File Tools API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(image_router)
app.include_router(pdf_router)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}
