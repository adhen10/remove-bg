"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function SparkleMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 2.5 19.4 12.6 29.5 16l-10.1 3.4L16 29.5l-3.4-10.1L2.5 16l10.1-3.4L16 2.5Z" fill="currentColor" />
        <path d="m25.5 2 .9 3.6L30 6.5l-3.6.9-.9 3.6-.9-3.6-3.6-.9 3.6-.9.9-3.6Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 31V8m0 0-8 8m8-8 8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 28v9a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4v-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
    <main className="min-h-screen overflow-hidden">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a href="/" className="brand" aria-label="Remove.bg home">
          <SparkleMark />
          <span>remove<span className="brand-dot">.</span>bg</span>
        </a>
        <nav className="header-nav" aria-label="Navigasi utama">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#tentang">Tentang</a>
        </nav>
        <a href="#workspace" className="header-cta">
          Mulai gratis <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero-section">
        <div className="eyebrow"><span className="eyebrow-dot" /> AI IMAGE TOOLKIT</div>
        <h1>
          Background hilang.
          <br />
          <span>Fokus tetap pada objek.</span>
        </h1>
        <p className="hero-copy">
          Hapus background foto dalam hitungan detik. Hasilkan gambar PNG
          transparan yang siap digunakan di mana saja.
        </p>
        <div className="hero-points">
          <span><i>✓</i> Gratis digunakan</span>
          <span><i>✓</i> Tanpa perlu daftar</span>
          <span><i>✓</i> Hasil PNG transparan</span>
        </div>
      </section>

      <section id="workspace" className="workspace-section">
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">WORKSPACE</span>
            <h2>Mulai dengan gambar kamu</h2>
          </div>
          <span className="privacy-note"><span>♧</span> File tidak disimpan</span>
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
            className={`upload-card ${dragging ? "is-dragging" : ""}`}
          >
            <div className="upload-icon-wrap"><UploadIcon /></div>
            <h3>Tarik & letakkan gambar di sini</h3>
            <p>atau pilih file dari perangkat kamu</p>
            <span className="choose-file-button">Pilih gambar <span aria-hidden="true">→</span></span>
            <div className="upload-meta">
              <span>JPG</span><span>PNG</span><span>WEBP</span><span>Maks. 10 MB</span>
            </div>
            <div className="paste-hint">Tips: kamu juga bisa paste gambar dengan <kbd>Ctrl</kbd> + <kbd>V</kbd></div>
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
          <section className="result-workspace" aria-live="polite">
            <div className="result-topbar">
              <div>
                <span className="section-kicker">IMAGE PREVIEW</span>
                <p className="filename">{file?.name}</p>
              </div>
              <span className={`status-pill status-${status}`}>
                <span className="status-indicator" />
                {status === "loading" ? "Sedang diproses" : status === "done" ? "Selesai" : "Perlu perhatian"}
              </span>
            </div>
            <div className="preview-grid">
              <figure className="preview-panel">
                <figcaption><span>01</span> GAMBAR ASLI</figcaption>
                <div className="preview-canvas original-canvas">
                  {originalUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={originalUrl} alt="Gambar asli" />
                  )}
                </div>
              </figure>
              <figure className="preview-panel">
                <figcaption><span>02</span> HASIL TRANSPARAN</figcaption>
                <div className="preview-canvas result-canvas" style={checkerboard}>
                  {status === "loading" && (
                    <div className="processing-card">
                      <span className="loading-spinner" />
                      <strong>Menghapus background...</strong>
                      <small>AI sedang memisahkan objek dari latar</small>
                    </div>
                  )}
                  {status === "done" && resultUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resultUrl} alt="Gambar tanpa background" />
                  )}
                  {status === "error" && (
                    <div className="error-card">
                      <strong>Gambar belum berhasil diproses</strong>
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </figure>
            </div>
            <div className="result-actions">
              {status === "done" && resultUrl && (
                <a href={resultUrl} download={downloadName} className="download-button">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Download PNG
                </a>
              )}
              {status === "error" && file && (
                <button onClick={() => process(file)} className="download-button">Coba lagi</button>
              )}
              <button onClick={reset} className="secondary-button">Pilih gambar lain</button>
            </div>
          </section>
        )}
      </section>

      <section id="cara-kerja" className="steps-section">
        <div className="section-intro">
          <span className="section-kicker">SIMPLE PROCESS</span>
          <h2>Hasil bersih, tanpa langkah rumit.</h2>
          <p>Tiga langkah sederhana untuk mendapatkan gambar tanpa background.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <div className="step-icon">↥</div>
            <h3>Upload gambar</h3>
            <p>Pilih foto dari perangkat atau cukup tarik ke area upload.</p>
          </article>
          <article className="step-card">
            <span className="step-number">02</span>
            <div className="step-icon">✳</div>
            <h3>AI bekerja</h3>
            <p>Teknologi AI mengenali objek utama dan menghapus latarnya.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <div className="step-icon">↓</div>
            <h3>Download hasil</h3>
            <p>Simpan PNG transparan dan gunakan sesuai kebutuhan.</p>
          </article>
        </div>
      </section>

      <section id="tentang" className="closing-banner">
        <div className="closing-mark"><SparkleMark /></div>
        <div>
          <span className="section-kicker">MAKE IT TRANSPARENT</span>
          <h2>Ide bagus tidak butuh background yang ramai.</h2>
          <p>Fokuskan perhatian pada hal yang paling penting.</p>
        </div>
        <a href="#workspace">Coba sekarang <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="site-footer">
        <a href="/" className="brand footer-brand"><SparkleMark /><span>remove<span className="brand-dot">.</span>bg</span></a>
        <p>Made for a clearer focus. © 2026 remove.bg</p>
        <a href="#workspace">Kembali ke atas ↑</a>
      </footer>
    </main>
  );
}
