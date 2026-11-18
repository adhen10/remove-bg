"use client";

import { useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
type PreviewPage = { page_number: number; width: number; height: number; thumbnail: string };

function formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function OrganizePdfPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previews, setPreviews] = useState<PreviewPage[]>([]);
    const [order, setOrder] = useState<number[]>([]);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [addNumbers, setAddNumbers] = useState(false);
    const [numberPosition, setNumberPosition] = useState("bottom-center");
    const [numberFormat, setNumberFormat] = useState("number");
    const [startNumber, setStartNumber] = useState("1");
    const [startPage, setStartPage] = useState("1");
    const [fontSize, setFontSize] = useState("10");
    const [margin, setMargin] = useState("28");

    async function chooseFile(candidate?: File) {
        if (!candidate) return;
        if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
            setError("File yang dipilih harus berformat PDF.");
            return;
        }
        setFile(candidate);
        setPreviews([]);
        setOrder([]);
        setError("");
        setSuccess("");
        setLoading(true);
        try {
            const form = new FormData();
            form.append("file", candidate);
            const response = await fetch(`${API_URL}/pdf-tools/organize/preview`, { method: "POST", body: form });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail || "Preview PDF gagal dibuat.");
            }
            const result = await response.json();
            const pages = result.pages as PreviewPage[];
            setPreviews(pages);
            setOrder(pages.map((page) => page.page_number));
        } catch (err) {
            setFile(null);
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membaca PDF.");
        } finally {
            setLoading(false);
        }
    }

    function movePageToPosition(pageNumber: number, position: number) {
        if (!Number.isInteger(position) || position < 1 || position > order.length) return;
        setOrder((current) => {
            const from = current.indexOf(pageNumber);
            if (from < 0) return current;
            const next = [...current];
            next.splice(from, 1);
            next.splice(position - 1, 0, pageNumber);
            return next;
        });
        setError(""); setSuccess("");
    }

    function removePage(pageNumber: number) {
        setOrder((current) => current.filter((number) => number !== pageNumber));
    }

    async function exportPdf() {
        if (!file || order.length === 0) {
            setError("Dokumen harus menyisakan minimal satu halaman.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("page_order", JSON.stringify(order));
            form.append("add_numbers", String(addNumbers));
            if (addNumbers) {
                form.append("position", numberPosition); form.append("format_type", numberFormat);
                form.append("start_number", startNumber); form.append("start_page", startPage);
                form.append("font_size", fontSize); form.append("margin", margin);
            }
            const response = await fetch(`${API_URL}/pdf-tools/organize`, { method: "POST", body: form });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail || "PDF gagal diatur.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "organized-document.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setSuccess("Susunan halaman berhasil disimpan. Unduhan PDF dimulai.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengatur PDF.");
        } finally {
            setBusy(false);
        }
    }

    const previewByNumber = new Map(previews.map((page) => [page.page_number, page]));

    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar">
                    <div>
                        
                        <h1 className="tool-topbar-title">Organize PDF</h1>
                    </div>
                </header>
                <section className="workspace-panel">
                    <div className="panel-heading">
                        <div>
                            <h2 className="panel-title">Atur halaman dokumen</h2>
                            <p className="mt-1 text-sm text-[#879189]">Atur posisi halaman dengan nomor, hapus halaman yang tidak diperlukan, dan tambahkan nomor halaman dalam satu proses.</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files[0]); }}
                        className={`w-full rounded-xl border border-dashed p-7 text-center transition ${dragging ? "border-[#4c8a5d] bg-[#f0f7f0]" : "border-[#cbd9cc] bg-[#fbfdfb] hover:border-[#7fa989]"}`}
                    >
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf3eb] text-xl text-[#397653]">▤</span>
                        <strong className="mt-3 block text-sm text-[#34463a]">{file ? "Ganti file PDF" : "Tarik PDF ke sini atau klik untuk memilih"}</strong>
                        <span className="mt-1 block text-xs text-[#929b94]">Satu file PDF · Maksimal 200 MB</span>
                    </button>
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />

                    {file && (
                        <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#e5ebe5] bg-white p-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f0f5f0] text-xs font-bold text-[#588064]">PDF</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#405247]">{file.name}</strong><small className="text-[10px] text-[#929b94]">{formatSize(file.size)} · {previews.length || "—"} halaman</small></span>
                            <button type="button" onClick={() => { setFile(null); setPreviews([]); setOrder([]); setError(""); setSuccess(""); }} disabled={loading || busy} className="text-xs text-[#a34e45] disabled:opacity-40">Hapus file</button>
                        </div>
                    )}

                    {loading && <p className="py-10 text-center text-sm text-[#879189]">Membuat preview halaman PDF...</p>}

                    {previews.length > 0 && !loading && (
                        <div className="mt-6">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div><h3 className="text-sm font-semibold text-[#34463a]">Susunan halaman</h3><p className="mt-1 text-xs text-[#879189]">Masukkan nomor posisi baru pada setiap halaman. Halaman lain akan menyesuaikan otomatis.</p></div>
                                <div className="flex items-center gap-3 text-xs text-[#718076]"><span>{order.length} dari {previews.length} halaman</span><button type="button" onClick={() => { setOrder(previews.map((page) => page.page_number)); setError(""); setSuccess(""); }} className="font-semibold text-[#397653]">Reset urutan</button></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {order.map((pageNumber, index) => {
                                    const preview = previewByNumber.get(pageNumber);
                                    if (!preview) return null;
                                    return (
                                        <article key={pageNumber} className="overflow-hidden rounded-xl border border-[#e1e9e1] bg-white">
                                            <div className="flex items-center justify-between border-b border-[#edf1ed] px-3 py-2">
                                                <span className="text-[11px] font-semibold text-[#526457]">Posisi {index + 1}</span>
                                                <span className="rounded bg-[#f1f5f1] px-2 py-1 text-[10px] text-[#718076]">Hal. {pageNumber}</span>
                                            </div>
                                            <div className="flex h-44 items-center justify-center bg-[#f5f7f5] p-2">
                                                <img src={preview.thumbnail} alt={`Preview halaman ${pageNumber}`} className="max-h-full max-w-full object-contain shadow-sm" />
                                            </div>
                                            <div className="flex items-center justify-between gap-2 border-t border-[#edf1ed] p-2">
                                                <label className="flex items-center gap-2 text-[11px] text-[#718076]">Posisi
                                                    <input type="number" min="1" max={order.length} value={index + 1} onChange={(event) => movePageToPosition(pageNumber, Number(event.target.value))} className="w-16 rounded-md border border-[#dce5dc] px-2 py-1.5 text-xs font-semibold text-[#34463a] outline-none focus:border-[#78a585]" aria-label={`Posisi baru halaman ${pageNumber}`} />
                                                </label>
                                                <button type="button" onClick={() => removePage(pageNumber)} disabled={order.length === 1} className="rounded-md border border-[#f0d9d6] px-3 py-1.5 text-[11px] font-semibold text-[#a34e45] hover:bg-[#fff4f2] disabled:opacity-30">Hapus</button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                            {order.length === 0 && <p className="rounded-lg bg-[#fff4f2] p-4 text-sm text-[#a34e45]">Semua halaman terhapus. Sisakan minimal satu halaman.</p>}
                        </div>
                    )}

                    {previews.length > 0 && !loading && (
                        <section className="mt-6 rounded-xl border border-[#e1e9e1] bg-[#fbfdfb] p-4">
                            <label className="flex cursor-pointer items-center gap-3">
                                <input type="checkbox" checked={addNumbers} onChange={(event) => setAddNumbers(event.target.checked)} className="h-4 w-4 accent-[#347653]" />
                                <span><strong className="block text-sm text-[#34463a]">Tambahkan nomor halaman</strong><small className="text-xs text-[#879189]">Nomor halaman diterapkan setelah urutan dan penghapusan selesai.</small></span>
                            </label>
                            {addNumbers && <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="text-xs font-semibold text-[#405247]">Posisi nomor<select value={numberPosition} onChange={e=>setNumberPosition(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] bg-white px-3 py-2.5 text-sm">{[["top-left","Atas kiri"],["top-center","Atas tengah"],["top-right","Atas kanan"],["bottom-left","Bawah kiri"],["bottom-center","Bawah tengah"],["bottom-right","Bawah kanan"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                                <label className="text-xs font-semibold text-[#405247]">Format nomor<select value={numberFormat} onChange={e=>setNumberFormat(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] bg-white px-3 py-2.5 text-sm"><option value="number">1, 2, 3</option><option value="page-of">Page 1 of 10</option></select></label>
                                <label className="text-xs font-semibold text-[#405247]">Mulai dari nomor<input type="number" min="1" max="999999" value={startNumber} onChange={e=>setStartNumber(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] px-3 py-2.5 text-sm"/></label>
                                <label className="text-xs font-semibold text-[#405247]">Mulai pada halaman ke-<input type="number" min="1" max={order.length} value={startPage} onChange={e=>setStartPage(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] px-3 py-2.5 text-sm"/></label>
                                <label className="text-xs font-semibold text-[#405247]">Ukuran teks (6–24 pt)<input type="number" min="6" max="24" value={fontSize} onChange={e=>setFontSize(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] px-3 py-2.5 text-sm"/></label>
                                <label className="text-xs font-semibold text-[#405247]">Jarak dari tepi (10–100 pt)<input type="number" min="10" max="100" value={margin} onChange={e=>setMargin(e.target.value)} className="mt-2 w-full rounded-lg border border-[#dce5dc] px-3 py-2.5 text-sm"/></label>
                            </div>}
                        </section>
                    )}
                    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4f2] p-3 text-xs text-[#a34e45]">{error}</p>}
                    {success && <p role="status" className="mt-4 rounded-lg bg-[#eff7ef] p-3 text-xs text-[#397653]">{success}</p>}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] text-[#929b94]">File diproses sementara dan tidak disimpan sebagai dokumen akun.</p>
                        <button type="button" onClick={exportPdf} disabled={busy || loading || !file || order.length === 0} className="rounded-lg bg-[#347653] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#285f42] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Menyimpan..." : "Simpan susunan PDF →"}</button>
                    </div>
                </section>
            </div>
        </main>
    );
}
