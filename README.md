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

The backend keeps processing concurrency bounded per Python worker process, but CPU and memory requirements still depend on model size and uploaded documents. Start with conservative worker values and monitor the host before increasing them. The default PDF size limit is 200 MB, not 50 MB. To allow larger files, raise both backend `MAX_PDF_MB` and frontend `NEXT_PUBLIC_MAX_PDF_MB` to the same value, then rebuild/redeploy the frontend. Also configure a request-body limit at the reverse proxy / hosting layer (for example, Nginx `client_max_body_size 220m;` for a 200 MB PDF plus multipart overhead) so the proxy does not reject the request first.

**Licensing note:** PyMuPDF is distributed under AGPL-3.0 or a commercial license. Review the applicable license obligations before using this project in a proprietary hosted service.
