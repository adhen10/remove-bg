"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const FORMATS = [
    { value: "png", label: "PNG", description: "Transparansi terjaga", use: "Grafis & logo" },
    { value: "jpg", label: "JPG", description: "File lebih ringkas", use: "Foto & berbagi" },
    { value: "webp", label: "WEBP", description: "Ringan untuk web", use: "Website" },
    { value: "bmp", label: "BMP", description: "Bitmap tanpa kompresi", use: "Kompatibilitas" },
    { value: "tiff", label: "TIFF", description: "Untuk cetak & arsip", use: "Dokumen" },
] as const;

type OutputFormat = (typeof FORMATS)[number]["value"];
type Status = "idle" | "ready" | "loading" | "done" | "error";
type PreviewSurface = "checker" | "light" | "dark";

const MIME_BY_FORMAT: Record<OutputFormat, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
};

const checkerboard = {
    backgroundColor: "#ffffff",
    backgroundImage:
        "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
} as const;

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function baseName(filename: string) {
    return filename.replace(/\.[^.]+$/, "");
}

export default function ImageConverter() {
    const [file, setFile] = useState<File | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultSize, setResultSize] = useState(0);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
    const [quality, setQuality] = useState(90);
    const [backgroundColor, setBackgroundColor] = useState("#ffffff");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [previewSurface, setPreviewSurface] = useState<PreviewSurface>("checker");
    const inputRef = useRef<HTMLInputElement>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (originalUrl) URL.revokeObjectURL(originalUrl);
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [originalUrl, resultUrl]);

    useEffect(() => {
        return () => requestControllerRef.current?.abort();
    }, []);

    const pickFile = (picked: File) => {
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;

        const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
        const supported =
            ALLOWED_MIME_TYPES.has(picked.type) ||
            (!picked.type && ALLOWED_EXTENSIONS.has(extension));

        if (!supported) {
            setFile(null);
            setOriginalUrl(null);
            setResultUrl(null);
            setResultSize(0);
            setDimensions(null);
            setError("Format input yang didukung hanya JPG, PNG, dan WEBP.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        if (picked.size > MAX_BYTES) {
            setFile(null);
            setOriginalUrl(null);
            setResultUrl(null);
            setResultSize(0);
            setDimensions(null);
            setError("Ukuran file maksimal 10 MB.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        setFile(picked);
        setOriginalUrl(URL.createObjectURL(picked));
        setResultUrl(null);
        setResultSize(0);
        setDimensions(null);
        setPreviewSurface("checker");
        setError(null);
        setStatus("ready");
    };

    const convert = async () => {
        if (!file) return;

        const controller = new AbortController();
        requestControllerRef.current?.abort();
        requestControllerRef.current = controller;
        setStatus("loading");
        setError(null);
        setResultUrl(null);
        setResultSize(0);

        try {
            const form = new FormData();
            form.append("file", file);
            form.append("output_format", outputFormat);
            form.append("quality", String(quality));
            form.append("background_color", backgroundColor);

            const response = await fetch(`${API_URL}/convert-image`, {
                method: "POST",
                body: form,
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail ?? "Gagal mengonversi gambar.");
            }

            const blob = await response.blob();
            if (blob.size === 0 || blob.type !== MIME_BY_FORMAT[outputFormat]) {
                throw new Error("Server tidak mengembalikan format gambar yang sesuai.");
            }

            setResultSize(blob.size);
            setResultUrl(URL.createObjectURL(blob));
            setStatus("done");
        } catch (caught) {
            if (controller.signal.aborted) return;
            setError(
                caught instanceof TypeError
                    ? "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
                    : (caught as Error).message
            );
            setStatus("error");
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
            }
        }
    };

    const reset = () => {
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;
        setFile(null);
        setOriginalUrl(null);
        setResultUrl(null);
        setResultSize(0);
        setDimensions(null);
        setError(null);
        setStatus("idle");
        setOutputFormat("png");
        setQuality(90);
        setBackgroundColor("#ffffff");
        setPreviewSurface("checker");
        if (inputRef.current) inputRef.current.value = "";
    };

    const downloadName = file
        ? `${baseName(file.name)}-converted.${outputFormat}`
        : `converted-image.${outputFormat}`;

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) pickFile(dropped);
    };

    const activePreviewStyle =
        previewSurface === "checker"
            ? checkerboard
            : { backgroundColor: previewSurface === "light" ? "#f1f2ef" : "#252d28" };

    const hasQuality = outputFormat === "jpg" || outputFormat === "webp";
    const hasBackground = outputFormat === "jpg" || outputFormat === "bmp";

    return (
        <main className="workspace-shell">
            <SiteHeader />

            <div className="workspace-main">
                <header className="tool-topbar">
          <h1 className="tool-topbar-title">Image converter</h1>
          <span className="tool-topbar-meta">{status === "loading" ? "Mengonversi" : status === "done" ? "Selesai" : status === "error" ? "Error" : "Siap"}</span>
        </header>

                <div className="workspace-grid">
                    <section className="workspace-panel">
                        <div className="panel-heading">
                            <div>
                                
                                <h2 className="panel-title">{file ? "Pengaturan" : "Gambar sumber"}</h2>
                                
                            </div>
                            <span className="meta-pill">{status === "loading" ? "Mengonversi" : status === "done" ? "Selesai" : status === "error" ? "Error" : "Siap"}</span>
                        </div>

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
                                aria-label="Pilih atau tarik gambar ke area ini"
                            >
                                <span className="dropzone-icon">
                                    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 25V7m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 23v8a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                </span>
                                <h3 className="dropzone-title">{dragging ? "Lepaskan gambar untuk memilih file" : "Tarik gambar ke area ini"}</h3>
                                
                                <span className="dropzone-button">Pilih gambar <span aria-hidden="true">↗</span></span>
                                <div className="dropzone-footer">
                                    {["JPG", "JPEG", "PNG", "WEBP"].map((format) => <span key={format} className="file-format-chip">{format}</span>)}
                                    <span>· Maks. 10 MB</span>
                                </div>
                                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => { const picked = event.target.files?.[0]; if (picked) pickFile(picked); }} />
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
                                            <div className="file-summary-meta">{formatBytes(file.size)} · {dimensions ? `${dimensions.width} × ${dimensions.height} px` : "Membaca dimensi gambar"}</div>
                                        </div>
                                    </div>
                                    <button type="button" onClick={reset} disabled={status === "loading"} className="file-summary-action">Ganti gambar</button>
                                </div>

                                <div>
                                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                                        <div>
                                            <p className="panel-eyebrow">Output format</p>
                                            <h3 className="panel-title">Pilih format tujuan</h3>
                                        </div>
                                        
                                    </div>
                                    <div className="format-grid">
                                        {FORMATS.map((format) => (
                                            <button key={format.value} type="button" disabled={status === "loading"} onClick={() => {
                                                setOutputFormat(format.value);
                                                setResultUrl(null);
                                                setResultSize(0);
                                                if (status === "done" || status === "error") setStatus("ready");
                                                setError(null);
                                            }} aria-pressed={outputFormat === format.value} className={`format-card ${outputFormat === format.value ? "is-selected" : ""}`}>
                                                {outputFormat === format.value && <span className="format-card-check">✓</span>}
                                                <span className="format-card-code">{format.label}</span>
                                                
                                                
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {hasQuality && (
                                    <div className="setting-box">
                                        <div className="setting-heading">
                                            <label htmlFor="image-quality" className="setting-label">Kualitas {outputFormat.toUpperCase()}</label>
                                            <span className="setting-value">{quality}<small className="ml-1 text-[9px] font-semibold text-[#78917e]">%</small></span>
                                        </div>
                                        <input id="image-quality" type="range" min="1" max="100" value={quality} disabled={status === "loading"} onChange={(event) => setQuality(Number(event.target.value))} className="setting-range" />
                                        <div className="flex justify-between text-[9px] text-[#96a198]"><span>File lebih kecil</span><span>Kualitas lebih tinggi</span></div>
                                        <div className="preset-row">
                                            {[60, 75, 85, 90, 100].map((value) => <button key={value} type="button" disabled={status === "loading"} onClick={() => setQuality(value)} className={`preset-chip ${quality === value ? "is-active" : ""}`}>{value}%</button>)}
                                        </div>
                                    </div>
                                )}

                                {hasBackground && (
                                    <div className="setting-box">
                                        <div className="setting-heading">
                                            <div>
                                                <p className="setting-label">Warna pengganti transparansi</p>
                                                
                                            </div>
                                            <label className="flex items-center gap-2 rounded-lg border border-[#e2eae2] bg-white px-2 py-1.5 text-[9px] font-bold text-[#617267]">
                                                {backgroundColor.toUpperCase()}
                                                <input type="color" disabled={status === "loading"} value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} aria-label={`Pilih warna latar ${outputFormat.toUpperCase()}`} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                                            </label>
                                        </div>
                                        <div className="preset-row">
                                            {["#ffffff", "#f1f1f1", "#000000", "#2f7651"].map((color) => <button key={color} type="button" disabled={status === "loading"} onClick={() => setBackgroundColor(color)} aria-label={`Gunakan warna ${color}`} className={`h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_1px_#d9e2d9] ${backgroundColor.toLowerCase() === color ? "ring-2 ring-[#4b8a5e] ring-offset-1" : ""}`} style={{ backgroundColor: color }} />)}
                                        </div>
                                    </div>
                                )}

                                {status !== "done" && (
                                    <button type="button" onClick={convert} disabled={status === "loading"} aria-busy={status === "loading"} className="action-primary w-full">
                                        {status === "loading" ? <><span className="processing-orbit !h-4 !w-4 !border-white/40 !border-t-white" /> Mengonversi gambar...</> : <>Konversi ke {outputFormat.toUpperCase()} <span aria-hidden="true">↗</span></>}
                                    </button>
                                )}

                                {status === "loading" && (
                                    <div className="processing-card" role="status" aria-live="polite">
                                        <span className="processing-orbit" />
                                        <div className="processing-copy"><strong>Mengonversi ke {outputFormat.toUpperCase()}...</strong></div>
                                    </div>
                                )}

                                {status === "error" && <div className="workspace-alert" role="alert">{error}</div>}

                                {status === "done" && resultUrl && (
                                    <div className="space-y-4">
                                        <div className="workspace-success flex items-center justify-between gap-3">
                                            <div><strong className="block text-[11px]">Selesai</strong></div>
                                            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dceede] text-sm font-bold text-[#39734a]">✓</span>
                                        </div>

                                        <div className="workspace-preview">
                                            <div className="workspace-preview-caption">
                                                <span>Preview hasil · {outputFormat.toUpperCase()}</span>
                                                <div className="preview-surface-switch" role="group" aria-label="Latar preview">
                                                    <button type="button" title="Pola transparansi" aria-label="Pola transparansi" aria-pressed={previewSurface === "checker"} onClick={() => setPreviewSurface("checker")} className={`preview-surface-button preview-surface-checker ${previewSurface === "checker" ? "is-active" : ""}`} />
                                                    <button type="button" title="Latar terang" aria-label="Latar terang" aria-pressed={previewSurface === "light"} onClick={() => setPreviewSurface("light")} className={`preview-surface-button preview-surface-light ${previewSurface === "light" ? "is-active" : ""}`} />
                                                    <button type="button" title="Latar gelap" aria-label="Latar gelap" aria-pressed={previewSurface === "dark"} onClick={() => setPreviewSurface("dark")} className={`preview-surface-button preview-surface-dark ${previewSurface === "dark" ? "is-active" : ""}`} />
                                                </div>
                                            </div>
                                            <div className="workspace-preview-stage" style={{ ...activePreviewStyle, height: 300 }}>
                                                {outputFormat === "tiff" ? (
                                                    <div className="max-w-xs px-5 text-center">
                                                        <div className="text-xl font-extrabold tracking-wide text-[#496550]">TIFF</div>
                                                        <p className="mt-2 text-[10px] text-[#839087]">Preview tidak tersedia</p>
                                                    </div>
                                                ) : (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={resultUrl} alt={`Hasil gambar ${outputFormat.toUpperCase()}`} />
                                                )}
                                            </div>
                                            <div className="mt-3 flex justify-between gap-3 text-[9px] text-[#87948a]"><span>Dimensi {dimensions ? `${dimensions.width} × ${dimensions.height} px` : "—"}</span></div>
                                        </div>

                                        <div className="stat-grid">
                                            <div className="stat-card"><span className="stat-label">Ukuran awal</span><strong className="stat-value">{formatBytes(file.size)}</strong></div>
                                            <div className="stat-card"><span className="stat-label">Ukuran hasil</span><strong className="stat-value">{formatBytes(resultSize)}</strong></div>
                                            <div className="stat-card"><span className="stat-label">Dimensi</span><strong className="stat-value">{dimensions ? `${dimensions.width} × ${dimensions.height}` : "—"}</strong></div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <a href={resultUrl} download={downloadName} className="action-primary"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2"/></svg> Unduh {outputFormat.toUpperCase()}</a>
                                            <button type="button" onClick={() => { setResultUrl(null); setResultSize(0); setStatus("ready"); }} className="action-secondary">Ubah pengaturan</button>
                                            <button type="button" onClick={reset} className="action-secondary">Gambar lain</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    
                </div>
            </div>

            
        </main>
    );
}
