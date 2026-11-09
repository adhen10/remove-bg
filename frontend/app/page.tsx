"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_BYTES = 10 * 1024 * 1024;

const checkerboard = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
} as const;

type Status = "idle" | "loading" | "done" | "error";

function AppMark() {
  return (
    <span className="app-mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" fill="none">
        <rect x="1" y="1" width="26" height="26" rx="7" fill="currentColor" />
        <path d="M8 9.25h12M8 14h8M8 18.75h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m18.5 16.5 1.2 2.3 2.3 1.2-2.3 1.2-1.2 2.3-1.2-2.3-2.3-1.2 2.3-1.2 1.2-2.3Z" fill="#D8F1DF" />
      </svg>
    </span>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 25V7m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 23v8a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [originalUrl, resultUrl]);

  const process = useCallback(async (picked: File) => {
    if (!picked.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, atau WebP).");
      setStatus("error");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("Ukuran file maksimal 10 MB.");
      setStatus("error");
      return;
    }

    setFile(picked);
    setOriginalUrl(URL.createObjectURL(picked));
    setResultUrl(null);
    setError(null);
    setStatus("loading");

    try {
      const form = new FormData();
      form.append("file", picked);
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Gagal memproses gambar.");
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
          : (e as Error).message
      );
      setStatus("error");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) process(dropped);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const pasted = item?.getAsFile();
      if (pasted) process(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [process]);

  const reset = () => {
    setFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}-no-bg.png`
    : "no-bg.png";

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="tool-area">
        <div className="tool-heading">
          <div>
            <h1>Hapus background</h1>
            <p>Ubah gambar menjadi PNG dengan background transparan.</p>
          </div>
          <span className="privacy-label">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.8 13 4v3.5c0 3.1-2 5.5-5 6.7-3-1.2-5-3.6-5-6.7V4l5-2.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="m5.8 7.8 1.5 1.5 3-3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            File tidak disimpan
          </span>
        </div>

        {status === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={`upload-area ${dragging ? "is-dragging" : ""}`}
          >
            <div className="upload-icon"><UploadIcon /></div>
            <h2>Tarik gambar ke sini</h2>
            <p>atau pilih gambar dari perangkat kamu</p>
            <span className="select-file-button">Pilih gambar</span>
            <div className="file-guidance">
              <span>JPG</span>
              <span>PNG</span>
              <span>WEBP</span>
              <i />
              <span>Maks. 10 MB</span>
            </div>
            <span className="paste-guidance">Bisa juga paste gambar dengan <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) process(picked);
              }}
            />
          </div>
        )}

        {status !== "idle" && (
          <section className="result-area" aria-live="polite">
            <div className="result-heading">
              <div className="file-detail">
                <span className="file-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                    <path d="m4.5 15 4-4 2.5 2 2.5-3 2 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <strong>{file?.name ?? "Gambar"}</strong>
                  <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "File gambar"}</span>
                </div>
              </div>
              <span className={`status-label status-${status}`}>
                <i />
                {status === "loading" ? "Memproses" : status === "done" ? "Selesai" : "Gagal"}
              </span>
            </div>

            <div className="preview-grid">
              <figure className="preview-card">
                <figcaption><span>Gambar asli</span></figcaption>
                <div className="preview-canvas original-canvas">
                  {originalUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={originalUrl} alt="Gambar asli" />
                  )}
                </div>
              </figure>
              <figure className="preview-card">
                <figcaption><span>Background transparan</span></figcaption>
                <div className="preview-canvas result-canvas" style={checkerboard}>
                  {status === "loading" && (
                    <div className="processing-state">
                      <span className="loading-spinner" />
                      <strong>Menghapus background...</strong>
                      <small>Mohon tunggu sebentar</small>
                    </div>
                  )}
                  {status === "done" && resultUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resultUrl} alt="Gambar tanpa background" />
                  )}
                  {status === "error" && (
                    <div className="error-state">
                      <strong>Gambar gagal diproses</strong>
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </figure>
            </div>

            <div className="result-actions">
              {status === "done" && resultUrl && (
                <a href={resultUrl} download={downloadName} className="primary-button">
                  <DownloadIcon />
                  Download PNG
                </a>
              )}
              {status === "error" && file && (
                <button onClick={() => process(file)} className="primary-button">Coba lagi</button>
              )}
              <button onClick={reset} className="secondary-button">Pilih gambar lain</button>
            </div>
          </section>
        )}

        <div className="tool-footnote">
          <span>Powered by AI background removal</span>
          <span>PNG · Transparent</span>
        </div>
      </section>

      <footer className="app-footer">
        <span>remove-bg</span>
        <span>Simple image processing tool</span>
      </footer>
    </main>
  );
}
