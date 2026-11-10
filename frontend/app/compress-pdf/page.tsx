"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const DEFAULT_MAX_PDF_MB = 200;
const configuredMaxPdfMb = Number(process.env.NEXT_PUBLIC_MAX_PDF_MB ?? DEFAULT_MAX_PDF_MB);
const MAX_PDF_MB =
    Number.isSafeInteger(configuredMaxPdfMb) && configuredMaxPdfMb > 0
        ? configuredMaxPdfMb
        : DEFAULT_MAX_PDF_MB;
const MAX_BYTES = MAX_PDF_MB * 1024 * 1024;

const LEVELS = [
    { value: "low", label: "Ringan", hint: "Pertahankan kualitas gambar", detail: "Kompresi lebih lembut", badge: "Kualitas utama" },
    { value: "medium", label: "Seimbang", hint: "Ukuran dan kualitas seimbang", detail: "Pilihan untuk penggunaan umum", badge: "Rekomendasi" },
    { value: "high", label: "Maksimal", hint: "Prioritaskan ukuran paling kecil", detail: "Kualitas gambar dapat menurun", badge: "Ukuran minimum" },
] as const;

type Level = (typeof LEVELS)[number]["value"];
type Status = "idle" | "ready" | "loading" | "done" | "error";

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompressPdf() {
    const [file, setFile] = useState<File | null>(null);
    const [level, setLevel] = useState<Level>("medium");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultSize, setResultSize] = useState(0);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [resultUrl]);

    const pick = (picked: File) => {
        const isPdf =
            picked.type === "application/pdf" ||
            picked.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            setFile(null);
            setResultUrl(null);
            setResultSize(0);
            setError("File harus berformat PDF.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        if (picked.size > MAX_BYTES) {
            setFile(null);
            setResultUrl(null);
            setResultSize(0);
            setError(`Ukuran file maksimal ${formatBytes(MAX_BYTES)}.`);
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        setFile(picked);
        setResultUrl(null);
        setResultSize(0);
        setError(null);
        setStatus("ready");
    };

    const compress = async () => {
        if (!file) return;
        setStatus("loading");
        setError(null);
        setResultUrl(null);
        setResultSize(0);

        try {
            const form = new FormData();
            form.append("file", file);
            form.append("level", level);
            const res = await fetch(`${API_URL}/compress-pdf`, { method: "POST", body: form });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.detail ?? "Gagal mengompres PDF.");
            }
            const blob = await res.blob();
            if (blob.size === 0 || (blob.type && blob.type !== "application/pdf")) {
                throw new Error("Server tidak mengembalikan PDF yang valid.");
            }
            const signature = await blob.slice(0, 5).text();
            if (signature !== "%PDF-") {
                throw new Error("Hasil tidak memiliki format PDF yang valid.");
            }
            setResultSize(blob.size);
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
    };

    const reset = () => {
        setFile(null);
        setResultUrl(null);
        setResultSize(0);
        setError(null);
        setStatus("idle");
        setLevel("medium");
        if (inputRef.current) inputRef.current.value = "";
    };

    const saved = file ? Math.max(0, Math.round((1 - resultSize / file.size) * 100)) : 0;
    const savedBytes = file ? Math.max(0, file.size - resultSize) : 0;
    const downloadName = file
        ? `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`
        : "compressed.pdf";
    const selectedLevel = LEVELS.find((item) => item.value === level)!;

    return (
        <main className="workspace-shell">
            <SiteHeader />

            <div className="workspace-main">
                <header className="tool-topbar">
          <h1 className="tool-topbar-title">Kompres PDF</h1>
          <span className="tool-topbar-meta">{status === "loading" ? "Mengompres" : status === "done" ? "Selesai" : status === "error" ? "Error" : "Siap"}</span>
        </header>

                <div className="workspace-grid">
                    <section className="workspace-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-eyebrow">Workspace</p>
                                <h2 className="panel-title">{file ? "Pengaturan kompresi" : "Pilih dokumen PDF"}</h2>
                                <p className="panel-description">{file ? "Tentukan seberapa agresif gambar di dalam PDF akan dioptimalkan." : "Unggah PDF untuk melihat pilihan tingkat kompresi."}</p>
                            </div>
                            <span className="meta-pill">{status === "loading" ? "Mengoptimalkan" : status === "done" ? "Selesai" : status === "error" ? "Perlu diperiksa" : "Langkah 01"}</span>
                        </div>

                        {!file && (
                            <div
                                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files?.[0]; if (dropped) pick(dropped); }}
                                onClick={(event) => { if (event.target !== inputRef.current) inputRef.current?.click(); }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
                                className={`dropzone ${dragging ? "is-dragging" : ""}`}
                                aria-label="Pilih atau tarik file PDF ke area ini"
                            >
                                <span className="dropzone-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h5"/></svg>
                                </span>
                                <h3 className="dropzone-title">{dragging ? "Lepaskan PDF untuk memilih file" : "Tarik file PDF ke area ini"}</h3>
                                <p className="dropzone-copy">{dragging ? "File akan diperiksa sebelum diproses." : "atau pilih dokumen dari perangkat kamu."}</p>
                                <span className="dropzone-button">Pilih PDF <span aria-hidden="true">↗</span></span>
                                <div className="dropzone-footer"><span className="file-format-chip">PDF</span><span>Maks. {formatBytes(MAX_BYTES)}</span></div>
                                <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const picked = event.target.files?.[0]; if (picked) pick(picked); }} />
                            </div>
                        )}

                        {status === "error" && !file && <div className="workspace-alert" role="alert">{error}</div>}

                        {file && (
                            <div className="space-y-4">
                                <div className="file-summary">
                                    <div className="file-summary-main">
                                        <span className="file-type-icon">PDF</span>
                                        <div className="min-w-0">
                                            <div className="file-summary-name">{file.name}</div>
                                            <div className="file-summary-meta">{formatBytes(file.size)} · Dokumen PDF</div>
                                        </div>
                                    </div>
                                    <button type="button" onClick={reset} disabled={status === "loading"} className="file-summary-action">Ganti file</button>
                                </div>

                                <fieldset disabled={status === "loading"} aria-labelledby="pdf-level-heading">
                                    <legend className="sr-only">Pilih tingkat kompresi</legend>
                                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                                        <div>
                                            <p className="panel-eyebrow">Compression level</p>
                                            <h3 id="pdf-level-heading" className="panel-title">Pilih tingkat kompresi</h3>
                                        </div>
                                        <span className="text-[9px] text-[#8b978e]">Pilih kartu untuk melihat pilihan</span>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {LEVELS.map((item) => (
                                            <label key={item.value} className={`pdf-level-card ${level === item.value ? "is-selected" : ""}`}>
                                                <input type="radio" name="level" value={item.value} checked={level === item.value} onChange={() => {
                                                    if (level !== item.value) {
                                                        setLevel(item.value);
                                                        setResultUrl(null);
                                                        setResultSize(0);
                                                        if (status === "done" || status === "error") setStatus("ready");
                                                    }
                                                }} className="sr-only" />
                                                <span className="pdf-level-top">
                                                    <span className="block text-sm font-medium">{item.label}</span>
                                                    <span className="pdf-level-indicator" aria-hidden="true">{level === item.value ? "✓" : ""}</span>
                                                </span>
                                                {item.value === "medium" && <span className="mt-2 inline-flex rounded-full bg-[#e8f3e9] px-2 py-1 text-[8px] font-bold text-[#48805a]">RECOMMENDED</span>}
                                                <span className="mt-2 block text-xs text-stone-500">{item.hint}</span>
                                                <span className="mt-1 block text-[9px] text-[#9aa49d]">{item.detail}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>

                                <div className="setting-box">
                                    <div className="setting-heading">
                                        <span className="setting-label">Pilihan kamu</span>
                                        <span className="setting-value !text-[12px]">{selectedLevel.label}</span>
                                    </div>
                                    <p className="panel-description mt-2">{selectedLevel.detail}. {selectedLevel.hint}.</p>
                                </div>

                                {status !== "done" && (
                                    <button onClick={compress} disabled={status === "loading"} aria-busy={status === "loading"} className="action-primary w-full">
                                        {status === "loading" ? <><span className="processing-orbit !h-4 !w-4 !border-white/40 !border-t-white" /> Mengompres PDF...</> : <>Mulai kompres PDF <span aria-hidden="true">↗</span></>}
                                    </button>
                                )}

                                {status === "loading" && (
                                    <div className="processing-card" role="status" aria-live="polite">
                                        <span className="processing-orbit" />
                                        <div className="processing-copy"><strong>PDF sedang dioptimalkan...</strong><span>Ukuran dan gambar di dalam dokumen sedang diproses. Persentase progres tidak ditampilkan karena durasi tiap file berbeda.</span></div>
                                    </div>
                                )}

                                {status === "error" && <div className="workspace-alert" role="alert">{error}</div>}

                                {status === "done" && resultUrl && (
                                    <div className="space-y-4">
                                        <div className="workspace-success flex items-center justify-between gap-3">
                                            <div><strong className="block text-[11px]">Kompresi selesai</strong><span className="mt-1 block text-[9px]">Hasil PDF siap disimpan atau dilihat.</span></div>
                                            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dceede] text-sm font-bold text-[#39734a]">✓</span>
                                        </div>
                                        <div className="workspace-panel !p-4 !shadow-none">
                                            <p className="panel-eyebrow">Ukuran file</p>
                                            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                                <div><span className="block text-[9px] text-[#91a096]">Sebelum</span><strong className="mt-1 block text-[18px] font-extrabold text-[#526157]">{formatBytes(file.size)}</strong></div>
                                                <span className="text-lg text-[#9aa89d]">→</span>
                                                <div><span className="block text-[9px] text-[#91a096]">Sesudah</span><strong className="mt-1 block text-[18px] font-extrabold text-[#2f7651]">{formatBytes(resultSize)}</strong></div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between text-[9px] text-[#7d8d80]">
                                                <span>{saved > 0 ? `Penghematan ${saved}%` : "Tidak ada pengurangan ukuran"}</span>
                                                <strong>{saved > 0 ? `−${formatBytes(savedBytes)}` : "0 B"}</strong>
                                            </div>
                                            <div className="pdf-saved-track mt-2 !bg-[#e9f0e9]"><span style={{ width: `${saved}%` }} /></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <a href={resultUrl} download={downloadName} className="action-primary">
                                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2"/></svg>
                                                Unduh PDF
                                            </a>
                                            <a href={resultUrl} target="_blank" rel="noreferrer" className="action-secondary">Lihat PDF</a>
                                            <button type="button" onClick={() => { setResultUrl(null); setResultSize(0); setStatus("ready"); }} className="action-secondary">Coba level lain</button>
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
