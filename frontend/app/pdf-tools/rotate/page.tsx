"use client";

import { useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
type PreviewPage = { page_number: number; thumbnail: string; width: number; height: number };
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`; }

export default function RotatePdfPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewPage[]>([]);
    const [selectedPages, setSelectedPages] = useState<number[]>([]);
    const [rotation, setRotation] = useState(90);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function chooseFile(candidate?: File) {
        if (!candidate) return;
        if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) { setError("File yang dipilih harus berformat PDF."); return; }
        setFile(candidate); setPreview([]); setSelectedPages([]); setError(""); setSuccess(""); setLoadingPreview(true);
        try {
            const form = new FormData(); form.append("file", candidate);
            const response = await fetch(`${API_URL}/pdf-tools/organize/preview`, { method: "POST", body: form });
            if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || "Preview PDF gagal dibuat."); }
            const body = await response.json();
            setPreview(body.pages as PreviewPage[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tidak dapat menampilkan halaman PDF.");
            setFile(null);
        } finally { setLoadingPreview(false); }
    }

    function togglePage(number: number) {
        setSelectedPages(current => current.includes(number) ? current.filter(page => page !== number) : [...current, number].sort((a,b) => a-b));
        setError(""); setSuccess("");
    }

    async function processPdf() {
        if (!file) return;
        setBusy(true); setError(""); setSuccess("");
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("rotation", String(rotation));
            form.append("pages", selectedPages.length ? selectedPages.join(",") : "");
            const response = await fetch(`${API_URL}/pdf-tools/rotate`, { method: "POST", body: form });
            if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || "PDF gagal diputar."); }
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a"); anchor.href = url; anchor.download = "rotated-document.pdf";
            document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setSuccess(selectedPages.length ? `${selectedPages.length} halaman berhasil diputar. Unduhan dimulai.` : "Semua halaman berhasil diputar. Unduhan dimulai.");
        } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memutar PDF."); }
        finally { setBusy(false); }
    }

    const actionButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#e2e9e2] bg-white px-3 text-xs font-semibold text-[#526457] transition hover:border-[#b9cdbb] hover:bg-[#f6faf6] disabled:opacity-40";

    return <main className="workspace-shell">
        <SiteHeader />
        <div className="workspace-main">
            <header className="tool-topbar">
                
                <h1 className="tool-topbar-title">Rotate PDF</h1>
            </header>
            <section className="workspace-panel">
                <div className="panel-heading"><div><h2 className="panel-title">Putar halaman PDF</h2><p className="mt-1 text-sm text-[#879189]">Upload dokumen, pilih halaman yang ingin diputar, lalu tentukan sudut rotasinya.</p></div></div>
                <button type="button" onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void chooseFile(e.dataTransfer.files[0]); }} className={`w-full rounded-xl border border-dashed p-8 text-center transition ${dragging ? "border-[#4c8a5d] bg-[#f0f7f0]" : "border-[#cbd9cc] bg-[#fbfdfb] hover:border-[#7fa989]"}`}>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf3eb] text-xl text-[#397653]">＋</span>
                    <strong className="mt-3 block text-sm text-[#34463a]">{file ? "Ganti file PDF" : "Tarik PDF ke sini atau klik untuk memilih"}</strong>
                    <span className="mt-1 block text-xs text-[#929b94]">Satu file PDF · Maksimal 200 MB</span>
                </button>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
                {file && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#e5ebe5] bg-white p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f0f5f0] text-xs font-bold text-[#588064]">PDF</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#405247]">{file.name}</strong><small className="text-[10px] text-[#929b94]">{formatSize(file.size)} · {preview.length} halaman</small></span>
                    <button type="button" onClick={() => { setFile(null); setPreview([]); setSelectedPages([]); setError(""); setSuccess(""); }} disabled={busy || loadingPreview} className={actionButton + " border-[#f0d9d6] text-[#a34e45] hover:bg-[#fff7f6]"}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>
                        Hapus file
                    </button>
                </div>}
                {loadingPreview && <p className="mt-4 rounded-lg bg-[#f5f8f5] p-4 text-center text-xs text-[#718076]">Membuat pratinjau halaman PDF...</p>}
                {preview.length > 0 && <div className="mt-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-sm font-semibold text-[#34463a]">Pilih halaman yang diputar</h3><p className="mt-1 text-xs text-[#879189]">Klik beberapa halaman untuk memilih. Jika tidak ada yang dipilih, semua halaman akan diputar.</p></div>
                        <div className="flex gap-2">
                            <button type="button" className={actionButton} onClick={() => setSelectedPages(preview.map(p => p.page_number))}>Pilih semua</button>
                            <button type="button" className={actionButton} onClick={() => setSelectedPages([])} disabled={!selectedPages.length}>Reset pilihan</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {preview.map(page => {
                            const selected = selectedPages.includes(page.page_number);
                            return <button key={page.page_number} type="button" aria-pressed={selected} onClick={() => togglePage(page.page_number)} className={`relative overflow-hidden rounded-xl border-2 p-2 text-left transition ${selected ? "border-[#43815a] bg-[#eff7ef] shadow-sm" : "border-[#e5ebe5] bg-white hover:border-[#b7cbb9]"}`}>
                                <span className={`absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-[#347653] text-white" : "border border-[#dce5dc] bg-white/95 text-[#718076]"}`}>{selected ? "✓" : page.page_number}</span>
                                <span className="flex h-44 items-center justify-center rounded-md bg-[#f3f5f3] p-2"><img src={page.thumbnail} alt={`Pratinjau halaman ${page.page_number}`} className="max-h-full max-w-full object-contain shadow-sm" /></span>
                                <span className="mt-2 block text-center text-xs font-semibold text-[#526457]">Halaman {page.page_number}</span>
                            </button>;
                        })}
                    </div>
                    <p className="mt-3 text-xs text-[#718076]">{selectedPages.length ? `${selectedPages.length} dari ${preview.length} halaman dipilih.` : `Belum ada pilihan khusus — seluruh ${preview.length} halaman akan diputar.`}</p>
                </div>}
                <div className="mt-6">
                    <label className="mb-2 block text-xs font-semibold text-[#405247]">Sudut rotasi</label>
                    <div className="grid grid-cols-3 gap-3">{[90,180,270].map(angle => <button key={angle} type="button" onClick={() => setRotation(angle)} className={`rounded-xl border p-4 text-center transition ${rotation === angle ? "border-[#8fb59a] bg-[#f1f7f1] text-[#285f42]" : "border-[#e5ebe5] bg-white text-[#68756b] hover:border-[#bdcfc0]"}`}><span className="block text-2xl">↻</span><strong className="mt-1 block text-sm">{angle}°</strong></button>)}</div>
                </div>
                {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4f2] p-3 text-xs text-[#a34e45]">{error}</p>}
                {success && <p role="status" className="mt-4 rounded-lg bg-[#eff7ef] p-3 text-xs text-[#397653]">{success}</p>}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-[#929b94]">File diproses sementara dan tidak disimpan sebagai dokumen akun.</p><button type="button" onClick={processPdf} disabled={busy || loadingPreview || !file || !preview.length} className="rounded-lg bg-[#347653] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#285f42] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Memproses..." : "Putar halaman terpilih →"}</button></div>
            </section>
        </div>
    </main>;
}
