# remove-bg

A small utility workspace for image and PDF processing, built with Next.js and Python.

## Available tools

- **Remove background** — remove image backgrounds and return transparent PNG files.
- **Image converter** — convert JPG/JPEG, PNG, or WEBP inputs into PNG, JPG, WEBP, BMP, or TIFF.
- **Compress PDF** — recompress embedded images and optimize PDF structure.

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: FastAPI, Pillow, rembg, ONNX Runtime
- PDF processing: PyMuPDF

## Backend structure

The backend is separated by responsibility so new tools can be added without putting all processing logic in `main.py`.

```text
backend/
├── main.py                    # FastAPI app, CORS, router registration
├── config.py                  # Environment variables and shared limits
├── routers/
│   ├── image.py               # Image upload endpoints
│   └── pdf.py                 # PDF upload endpoints
├── services/
│   ├── background_remover.py  # Background removal processing
│   ├── image_converter.py     # PNG / JPG / WEBP / BMP / TIFF conversion
│   └── pdf_compressor.py      # PDF compression
├── utils/
│   └── image_validation.py   # Shared image decoding and validation
└── tests/
    └── test_image_converter.py
```

- **Routers** handle HTTP requests, upload limits, concurrency, and responses.
- **Services** contain reusable file-processing logic.
- **Utils** contain shared validation and helper functions.
- **Config** centralizes environment settings.

## Requirements

- Node.js 22 LTS (Node.js 20.9 or newer is required by the current Next.js release)
- Python 3.11 or newer
- Internet connection on the first backend startup so rembg can obtain its model if it is not already cached

## Run locally

Open two terminals from the repository root.

### 1. Backend

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. Health check: `http://localhost:8000/health`. Interactive API documentation: `http://localhost:8000/docs`.

### 2. Frontend

PowerShell:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

### Backend — `backend/.env`

| Variable | Default | Description |
|---|---:|---|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated frontend origins |
| `MAX_IMAGE_MB` | `10` | Maximum uploaded image size in MB, shared by image tools |
| `MAX_IMAGE_PIXELS` | `25000000` | Maximum decoded image pixels |
| `MAX_IMAGE_SIDE` | `2000` | Maximum image side after resizing for background removal |
| `IMAGE_WORKERS` | `1` | Concurrent image-processing jobs |
| `MAX_PDF_MB` | `200` | Maximum uploaded PDF size in MB (configurable) |
| `MAX_PDF_PAGES` | `500` | Maximum PDF page count |
| `PDF_WORKERS` | `1` | Concurrent PDF compression jobs; increase only if the host has enough RAM |

### Frontend — `frontend/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Public base URL of the FastAPI backend |
| `NEXT_PUBLIC_MAX_PDF_MB` | `200` | Maximum PDF size accepted by the browser UI, in MB |

Do not put secrets in `NEXT_PUBLIC_*` variables; Next.js exposes them to the browser. The frontend PDF limit must match the backend `MAX_PDF_MB` value. Because it is a public Next.js variable, rebuild/redeploy the frontend after changing it.

When updating an existing local setup, edit the existing files manually (pulling does not overwrite ignored environment files):

- `backend/.env`: set `MAX_PDF_MB=200` and `PDF_WORKERS=1`.
- `frontend/.env.local`: set `NEXT_PUBLIC_MAX_PDF_MB=200`.

Restart the backend and restart/rebuild the Next.js frontend after changing these values.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| POST | `/remove-bg` | Accepts an image in multipart field `file`; returns transparent PNG |
| POST | `/convert-image` | Converts an image to PNG, JPG, or WEBP |
| POST | `/compress-pdf` | Accepts multipart fields `file` and `level`; returns PDF |

### Image conversion

The `POST /convert-image` endpoint accepts these multipart fields:

| Field | Required | Values / default |
|---|---|---|
| `file` | Yes | JPG/JPEG, PNG, or static WEBP; maximum 10 MB by default |
| `output_format` | Yes | `png`, `jpg`, `webp`, `bmp`, or `tiff` |
| `quality` | No | Integer 1–100; default `90`. Used by JPG and WEBP |
| `background_color` | No | HEX color; default `#ffffff`. Used when flattening transparent pixels to JPG or BMP |

PNG, WEBP, and TIFF preserve transparency. JPG and BMP do not preserve transparency in this tool, so transparent areas are filled with the selected background color. Quality is configurable for lossy JPG and WEBP output. Conversion keeps the original image dimensions; decoded image size is bounded by `MAX_IMAGE_PIXELS`.

Supported background-removal input formats: JPG/JPEG, PNG, and static WEBP. Images are resized to the configured maximum side before AI processing.

PDF compression levels: `low`, `medium`, and `high`.

## Checks

From `frontend/`:

```bash
npm run lint
npm run build
```

Backend checks from the repository root (activate the backend virtual environment first):

```bash
python -m compileall -q backend
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
```

## Deployment notes

Deploy the Next.js frontend and FastAPI backend as separate services. Set `NEXT_PUBLIC_API_URL` to the public backend URL and configure `ALLOWED_ORIGINS` with the exact frontend origin(s). Use HTTPS in production.

The backend keeps processing concurrency bounded per Python worker process, but CPU and memory requirements still depend on model size and uploaded documents. Start with conservative worker values and monitor the host before increasing them. The default PDF size limit is 200 MB, not 50 MB. To allow larger files, raise both backend `MAX_PDF_MB` and frontend `NEXT_PUBLIC_MAX_PDF_MB` to the same value, then rebuild/redeploy the frontend. Also configure a request-body limit at the reverse proxy / hosting layer (for example, Nginx `client_max_body_size 220m;` for a 200 MB PDF plus multipart overhead) so the proxy does not reject the request first.

**Licensing note:** PyMuPDF is distributed under AGPL-3.0 or a commercial license. Review the applicable license obligations before using this project in a proprietary hosted service.
