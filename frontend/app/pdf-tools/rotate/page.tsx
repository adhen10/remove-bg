"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RotatePdfPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [rotation, setRotation] = useState(90);
    const [pages, setPages] = useState("");
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function chooseFile(candidate?: File) {
        if (!candidate) return;
        if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
            setError("File yang dipilih harus berformat PDF.");
            return;
        }
        setFile(candidate);
        setError("");
        setSuccess("");
    }

    async function processPdf() {
        if (!file) {
            setError("Pilih satu file PDF terlebih dahulu.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("rotation", String(rotation));
            form.append("pages", pages);
            const response = await fetch(`${API_URL}/pdf-tools/rotate`, { method: "POST", body: form });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail || "PDF gagal diputar.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "rotated-document.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setSuccess("PDF berhasil diputar. Unduhan dimulai.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memutar PDF.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar">
                    <div>
                        <Link href="/pdf-tools" className="text-xs text-[#718076] hover:text-[#347653]">← PDF Toolkit</Link>
                        <h1 className="tool-topbar-title mt-2">Rotate PDF</h1>
                    </div>
                </header>
                <section className="workspace-panel">
                    <div className="panel-heading">
                        <div>
                            <h2 className="panel-title">Putar halaman PDF</h2>
                            <p className="mt-1 text-sm text-[#879189]">Putar seluruh halaman atau hanya halaman yang kamu tentukan.</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
                        className={`w-full rounded-xl border border-dashed p-8 text-center transition ${dragging ? "border-[#4c8a5d] bg-[#f0f7f0]" : "border-[#cbd9cc] bg-[#fbfdfb] hover:border-[#7fa989]"}`}
                    >
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf3eb] text-xl text-[#397653]">↻</span>
                        <strong className="mt-3 block text-sm text-[#34463a]">{file ? "Ganti file PDF" : "Tarik PDF ke sini atau klik untuk memilih"}</strong>
                        <span className="mt-1 block text-xs text-[#929b94]">Satu file PDF · Maksimal 200 MB</span>
                    </button>
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />

                    {file && (
                        <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#e5ebe5] bg-white p-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f0f5f0] text-xs font-bold text-[#588064]">PDF</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#405247]">{file.name}</strong><small className="text-[10px] text-[#929b94]">{formatSize(file.size)}</small></span>
                            <button type="button" onClick={() => { setFile(null); setError(""); setSuccess(""); }} disabled={busy} className="text-xs text-[#a34e45] disabled:opacity-40">Hapus</button>
                        </div>
                    )}

                    <div className="mt-6">
                        <label className="mb-2 block text-xs font-semibold text-[#405247]">Sudut rotasi</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[90, 180, 270].map((angle) => (
                                <button key={angle} type="button" onClick={() => setRotation(angle)} className={`rounded-xl border p-4 text-center transition ${rotation === angle ? "border-[#8fb59a] bg-[#f1f7f1] text-[#285f42]" : "border-[#e5ebe5] bg-white text-[#68756b] hover:border-[#bdcfc0]"}`}>
                                    <span className="block text-2xl">↻</span>
                                    <strong className="mt-1 block text-sm">{angle}°</strong>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5">
                        <label htmlFor="rotate-pages" className="mb-2 block text-xs font-semibold text-[#405247]">Halaman yang diputar <span className="font-normal text-[#929b94]">(opsional)</span></label>
                        <input id="rotate-pages" value={pages} onChange={(event) => setPages(event.target.value)} placeholder="Kosongkan untuk memutar semua halaman · Contoh: 2, 4-6, 9" className="w-full rounded-lg border border-[#dce5dc] bg-white px-3 py-3 text-sm text-[#34463a] outline-none focus:border-[#78a585] focus:ring-2 focus:ring-[#e4f0e5]" />
                        <p className="mt-2 text-[11px] text-[#929b94]">Gunakan koma untuk halaman terpisah dan tanda hubung untuk rentang. Halaman lain tidak berubah.</p>
                    </div>

                    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4f2] p-3 text-xs text-[#a34e45]">{error}</p>}
                    {success && <p role="status" className="mt-4 rounded-lg bg-[#eff7ef] p-3 text-xs text-[#397653]">{success}</p>}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] text-[#929b94]">File diproses sementara dan tidak disimpan sebagai dokumen akun.</p>
                        <button type="button" onClick={processPdf} disabled={busy || !file} className="rounded-lg bg-[#347653] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#285f42] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Memproses..." : "Putar PDF →"}</button>
                    </div>
                </section>
            </div>
        </main>
    );
}
