"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const checkerboard = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
} as const;

type Status = "idle" | "loading" | "done" | "error";
type PreviewSurface = "checker" | "light" | "dark";

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SignatureRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [sensitivity, setSensitivity] = useState(18);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outputBytes, setOutputBytes] = useState(0);
  const [comparePosition, setComparePosition] = useState(50);
  const [previewMode, setPreviewMode] = useState<"compare" | "result">("compare");
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>("checker");
  const [inputDimensions, setInputDimensions] = useState<{ width: number; height: number } | null>(null);
  const [outputDimensions, setOutputDimensions] = useState<{ width: number; height: number } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [originalUrl, resultUrl]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  const process = useCallback(async (picked: File) => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;

    const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
    const supportedType =
      ALLOWED_MIME_TYPES.has(picked.type) ||
      (!picked.type && ALLOWED_EXTENSIONS.has(extension));

    if (!supportedType) {
      setFile(null);
      setOriginalUrl(null);
      setResultUrl(null);
      setInputDimensions(null);
      setOutputDimensions(null);
      setOutputBytes(0);
      setError("Format yang didukung hanya JPG, PNG, dan WEBP.");
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setOriginalUrl(null);
      setResultUrl(null);
      setInputDimensions(null);
      setOutputDimensions(null);
      setOutputBytes(0);
      setError("Ukuran file maksimal 10 MB.");
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setFile(picked);
    setOriginalUrl(URL.createObjectURL(picked));
    setResultUrl(null);
    setInputDimensions(null);
    setOutputDimensions(null);
    setOutputBytes(0);
    setComparePosition(50);
    setPreviewMode("compare");
    setPreviewSurface("checker");
    setCopyMessage("");
    setError(null);
    setStatus("loading");

    try {
      const form = new FormData();
      form.append("file", picked);
      form.append("mode", "signature");
      form.append("sensitivity", String(sensitivity));
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Gagal memproses gambar.");
      }

      const blob = await res.blob();
      if (blob.type !== "image/png" || blob.size === 0) {
        throw new Error("Server tidak mengembalikan file PNG yang valid.");
      }
      setResultUrl(URL.createObjectURL(blob));
      setOutputBytes(blob.size);
      setStatus("done");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof TypeError
          ? "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
          : (e as Error).message
      );
      setStatus("error");
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }, [sensitivity]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
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
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setInputDimensions(null);
    setOutputDimensions(null);
    setOutputBytes(0);
    setComparePosition(50);
    setPreviewMode("compare");
    setPreviewSurface("checker");
    setCopyMessage("");
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyPng = async () => {
    if (!resultUrl) return;

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Browser ini belum mendukung salin gambar. Gunakan Download PNG.");
      }
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopyMessage("PNG berhasil disalin ke clipboard.");
    } catch {
      setCopyMessage("Tidak bisa menyalin gambar. Coba gunakan Download PNG.");
    }
  };

  const activePreviewStyle =
    previewSurface === "checker"
      ? checkerboard
      : { backgroundColor: previewSurface === "light" ? "#f1f2ef" : "#252d28" };

  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}-signature-transparent.png`
    : "signature-transparent.png";

  return (
    <main className="workspace-shell">
      <SiteHeader />

      <div className="workspace-main">
        <header className="tool-topbar">
          <h1 className="tool-topbar-title">Bersihkan Tanda Tangan & Dokumen</h1>
          <span className="tool-topbar-meta">{status === "loading" ? "Memproses" : status === "done" ? "Selesai" : status === "error" ? "Error" : "Siap"}</span>
        </header>

        <div className="workspace-grid">
          <section className="workspace-panel">
            <div className="panel-heading">
              <div>
                
                <h2 className="panel-title">{file ? "Dokumen sumber" : "Pengaturan pembersihan"}</h2>
                
              </div>
              <span className="meta-pill">{status === "loading" ? "Memproses" : status === "done" ? "Selesai" : status === "error" ? "Error" : "Siap"}</span>
            </div>

            {!file && (
              <div className="setting-box">
                <div className="setting-heading">
                  <label htmlFor="signature-sensitivity" className="setting-label">Sensitivitas pembersihan</label>
                  <span className="setting-value">{sensitivity}<small className="ml-1 text-[9px] font-semibold text-[#78917e]">/ 100</small></span>
                </div>
                <input
                  id="signature-sensitivity"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={sensitivity}
                  onChange={(event) => setSensitivity(Number(event.target.value))}
                  className="setting-range"
                />
                <div className="flex justify-between text-[9px] text-[#96a198]">
                  <span>Jaga detail tipis</span>
                  <span>Bersihkan noda lebih kuat</span>
                </div>
                <div className="preset-row">
                  {[{label:"Detail",value:8},{label:"Seimbang",value:18},{label:"Bersih",value:38},{label:"Agresif",value:60}].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSensitivity(preset.value)}
                      className={`preset-chip ${sensitivity === preset.value ? "is-active" : ""}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!file && (
              <div
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={(event) => { if (event.target !== inputRef.current) inputRef.current?.click(); }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
                className={`dropzone ${dragging ? "is-dragging" : ""}`}
                aria-label="Pilih gambar tanda tangan atau dokumen"
              >
                <span className="dropzone-icon"><UploadIcon /></span>
                <h3 className="dropzone-title">{dragging ? "Lepaskan gambar untuk mulai" : "Tarik foto tanda tangan atau dokumen ke sini"}</h3>
                
                <span className="dropzone-button">Pilih gambar <span aria-hidden="true">↗</span></span>
                <div className="dropzone-footer">
                  <span className="file-format-chip">JPG</span>
                  <span className="file-format-chip">PNG</span>
                  <span className="file-format-chip">WEBP</span>
                  <span>· Maks. 10 MB</span>
                </div>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => { const picked = event.target.files?.[0]; if (picked) process(picked); }} />
              </div>
            )}

            {status === "error" && !file && <div className="workspace-alert" role="alert">{error}</div>}

            {file && (
              <div className="space-y-4">
                <div className="file-summary">
                  <div className="file-summary-main">
                    <span className="file-type-icon">IMG</span>
                    <div className="min-w-0">
                      <div className="file-summary-name">{file.name}</div>
                      <div className="file-summary-meta">{formatBytes(file.size)} · Pembersihan tanda tangan</div>
                    </div>
                  </div>
                  <button type="button" onClick={reset} disabled={status === "loading"} className="file-summary-action">Ganti gambar</button>
                </div>

                {status === "loading" && (
                  <div className="processing-card" role="status" aria-live="polite">
                    <span className="processing-orbit" />
                    <div className="processing-copy">
                      <strong>Membersihkan background kertas...</strong>
                      
                    </div>
                  </div>
                )}

                {status === "error" && <div className="workspace-alert" role="alert">{error}</div>}

                {status === "done" && resultUrl && originalUrl && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="panel-eyebrow">Hasil pemrosesan</p>
                        <h3 className="panel-title">Hasil PNG</h3>
                      </div>
                      <span className="meta-pill"><i className="h-2 w-2 rounded-full bg-[#5c9b6e]" /> PNG transparan</span>
                    </div>

                    <div className="preview-toolbar">
                      <div className="preview-mode-control" role="group" aria-label="Mode preview">
                        <button type="button" className={`preview-mode-button ${previewMode === "compare" ? "is-active" : ""}`} aria-pressed={previewMode === "compare"} onClick={() => setPreviewMode("compare")}>Bandingkan</button>
                        <button type="button" className={`preview-mode-button ${previewMode === "result" ? "is-active" : ""}`} aria-pressed={previewMode === "result"} onClick={() => setPreviewMode("result")}>Hasil saja</button>
                      </div>
                      <div className="preview-surface-switch" role="group" aria-label="Warna preview">
                        <span className="mr-1 text-[9px] text-[#87948a]">Latar</span>
                        <button type="button" title="Checkerboard" aria-label="Pola transparansi" aria-pressed={previewSurface === "checker"} onClick={() => setPreviewSurface("checker")} className={`preview-surface-button preview-surface-checker ${previewSurface === "checker" ? "is-active" : ""}`} />
                        <button type="button" title="Terang" aria-label="Latar terang" aria-pressed={previewSurface === "light"} onClick={() => setPreviewSurface("light")} className={`preview-surface-button preview-surface-light ${previewSurface === "light" ? "is-active" : ""}`} />
                        <button type="button" title="Gelap" aria-label="Latar gelap" aria-pressed={previewSurface === "dark"} onClick={() => setPreviewSurface("dark")} className={`preview-surface-button preview-surface-dark ${previewSurface === "dark" ? "is-active" : ""}`} />
                      </div>
                    </div>

                    {previewMode === "compare" ? (
                      <figure className="compare-card">
                        <figcaption className="compare-caption"><span>Perbandingan hasil</span><span>Geser garis untuk membandingkan</span></figcaption>
                        <div className="comparison-stage" style={activePreviewStyle}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={originalUrl} alt="Gambar asli" onLoad={(event) => setInputDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="comparison-image" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resultUrl} alt="Gambar setelah background dihapus" onLoad={(event) => setOutputDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="comparison-image" style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }} />
                          <span className="comparison-tag comparison-tag-before">Asli</span>
                          <span className="comparison-tag comparison-tag-after">Transparan</span>
                          <span className="comparison-divider" style={{ left: `${comparePosition}%` }} aria-hidden="true"><span className="comparison-knob"><svg viewBox="0 0 20 20" fill="none"><path d="m7 5-4 5 4 5M13 5l4 5-4 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span></span>
                          <input type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} className="comparison-range" aria-label="Geser untuk membandingkan gambar asli dan hasil transparan" aria-valuetext={`${comparePosition}% gambar asli terlihat`} />
                        </div>
                        <div className="compare-range-hint"><span>← Gambar asli</span><span>Hasil transparan →</span></div>
                      </figure>
                    ) : (
                      <figure className="workspace-preview">
                        <div className="workspace-preview-caption"><span>Hasil PNG transparan</span><span>{outputDimensions ? `${outputDimensions.width} × ${outputDimensions.height} px` : "Preview"}</span></div>
                        <div className="workspace-preview-stage" style={{ ...activePreviewStyle, height: 390 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resultUrl} alt="Hasil PNG transparan" onLoad={(event) => setOutputDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
                        </div>
                      </figure>
                    )}

                    <div className="stat-grid">
                      <div className="stat-card"><span className="stat-label">Dimensi asli</span><strong className="stat-value">{inputDimensions ? `${inputDimensions.width} × ${inputDimensions.height}` : "—"}</strong></div>
                      <div className="stat-card"><span className="stat-label">Dimensi hasil</span><strong className="stat-value">{outputDimensions ? `${outputDimensions.width} × ${outputDimensions.height}` : "—"}</strong></div>
                      <div className="stat-card"><span className="stat-label">Ukuran PNG</span><strong className="stat-value">{formatBytes(outputBytes)}</strong></div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a href={resultUrl} download={downloadName} className="action-primary"><DownloadIcon /> Unduh PNG</a>
                      <button type="button" onClick={copyPng} className="action-secondary">{copyMessage.startsWith("PNG berhasil") ? "✓ Tersalin" : "Salin PNG"}</button>
                      <button type="button" onClick={reset} className="action-secondary">Proses gambar lain</button>
                    </div>
                    {copyMessage && <p className={`copy-feedback ${copyMessage.startsWith("PNG berhasil") ? "is-success" : "is-error"}`} role="status">{copyMessage}</p>}
                  </div>
                )}

                {status !== "done" && (
                  <div className="workspace-preview">
                    <div className="workspace-preview-caption"><span>Pratinjau gambar</span><span>{status === "loading" ? "Sedang diproses" : "Gambar terpilih"}</span></div>
                    <div className="workspace-preview-stage" style={checkerboard}>
                      {originalUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={originalUrl} alt="Gambar yang dipilih" onLoad={(event) => setInputDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
                      )}
                      {status === "loading" && <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-semibold text-[#477b55] shadow-sm">Memproses gambar...</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-[9px] text-[#8d9990]">
                      <span>{inputDimensions ? `${inputDimensions.width} × ${inputDimensions.height} px` : "Membaca dimensi..."}</span>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                  </div>
                )}

                {status === "error" && <button type="button" onClick={() => process(file)} className="action-primary">Coba proses lagi</button>}
                {status === "loading" && <button type="button" onClick={reset} className="action-secondary">Batalkan proses</button>}
              </div>
            )}
          </section>

          
        </div>
      </div>

      
    </main>
  );
}
