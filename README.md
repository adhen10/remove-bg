# remove-bg

A small image utility app built with Next.js and Python.

Current tools:

- **Remove background** — remove image backgrounds and return transparent PNG files.
- **Compress PDF** — recompress embedded images and optimize PDF structure.

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: FastAPI, Pillow, rembg, ONNX Runtime
- PDF processing: PyMuPDF

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

The API is available at `http://localhost:8000`. Health check: `http://localhost:8000/health`.

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
| `MAX_IMAGE_MB` | `10` | Maximum uploaded image size in MB |
| `MAX_IMAGE_PIXELS` | `25000000` | Maximum decoded image pixels |
| `MAX_IMAGE_SIDE` | `2000` | Maximum image side after resizing |
| `IMAGE_WORKERS` | `1` | Concurrent background-removal jobs |
| `MAX_PDF_MB` | `50` | Maximum uploaded PDF size in MB |
| `MAX_PDF_PAGES` | `500` | Maximum PDF page count |
| `PDF_WORKERS` | `2` | Concurrent PDF compression jobs |

### Frontend — `frontend/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Public base URL of the FastAPI backend |

Do not put secrets in `NEXT_PUBLIC_*` variables; Next.js exposes them to the browser.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| POST | `/remove-bg` | Accepts an image in multipart field `file`; returns PNG |
| POST | `/compress-pdf` | Accepts multipart fields `file` and `level`; returns PDF |

Supported background-removal input formats: JPG/JPEG, PNG, and static WEBP. Images are resized to the configured maximum side before AI processing.

PDF compression levels: `low`, `medium`, and `high`.

## Checks

From `frontend/`:

```bash
npm run lint
npm run build
```

Backend syntax check from the repository root:

```bash
python -m compileall -q backend
```

## Deployment notes

Deploy the Next.js frontend and FastAPI backend as separate services. Set `NEXT_PUBLIC_API_URL` to the public backend URL and configure `ALLOWED_ORIGINS` with the exact frontend origin(s). Use HTTPS in production.

The backend keeps processing concurrency bounded per Python worker process, but CPU and memory requirements still depend on model size and uploaded documents. Start with conservative worker values and monitor the host before increasing them. Also configure a request-body limit at the reverse proxy / hosting layer (for example, Nginx `client_max_body_size`) so oversized multipart requests are rejected before they are spooled by the ASGI server.

**Licensing note:** PyMuPDF is distributed under AGPL-3.0 or a commercial license. Review the applicable license obligations before using this project in a proprietary hosted service.
