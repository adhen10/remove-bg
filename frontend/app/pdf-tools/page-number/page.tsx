"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const positions = [
    { value: "top-left", label: "Atas kiri" }, { value: "top-center", label: "Atas tengah" }, { value: "top-right", label: "Atas kanan" },
    { value: "bottom-left", label: "Bawah kiri" }, { value: "bottom-center", label: "Bawah tengah" }, { value: "bottom-right", label: "Bawah kanan" },
];

export default function PageNumberPdfPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [position, setPosition] = useState("bottom-center");
    const [formatType, setFormatType] = useState("number");
    const [startNumber, setStartNumber] = useState("1");
    const [startPage, setStartPage] = useState("1");
    const [fontSize, setFontSize] = useState("10");
    const [margin, setMargin] = useState("28");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function processPdf() {
        if (!file) { setError("Pilih satu file PDF terlebih dahulu."); return; }
        setBusy(true); setError(""); setSuccess("");
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("position", position);
            form.append("format_type", formatType);
            form.append("start_number", startNumber);
            form.append("start_page", startPage);
            form.append("font_size", fontSize);
            form.append("margin", margin);
            const response = await fetch(`${API_URL}/pdf-tools/page-number`, { method: "POST", body: form });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail || "Gagal menambahkan nomor halaman.");
            }
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a");
            anchor.href = url; anchor.download = "numbered-document.pdf";
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setSuccess("Nomor halaman berhasil ditambahkan. Unduhan dimulai.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses PDF.");
        } finally { setBusy(false); }
    }

    const fieldClass = "w-full rounded-lg border border-[#dce5dc] bg-white px-3 py-2.5 text-sm text-[#34463a] outline-none focus:border-[#78a585]";

    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar">
                    <div><Link href="/pdf-tools" className="text-xs text-[#718076] hover:text-[#347653]">← PDF Toolkit</Link><h1 className="tool-topbar-title mt-2">Page Number</h1></div>
                </header>
                <section className="workspace-panel">
                    <div className="panel-heading"><div><h2 className="panel-title">Tambahkan nomor halaman</h2><p className="mt-1 text-sm text-[#879189]">Atur posisi, format, dan awal penomoran dokumen.</p></div></div>
                    <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl border border-dashed border-[#cbd9cc] bg-[#fbfdfb] p-7 text-center transition hover:border-[#7fa989]">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf3eb] text-xl text-[#397653]">#</span>
                        <strong className="mt-3 block text-sm text-[#34463a]">{file ? "Ganti file PDF" : "Klik untuk memilih file PDF"}</strong>
                        <span className="mt-1 block text-xs text-[#929b94]">{file ? file.name : "Satu file PDF · Maksimal 200 MB"}</span>
                    </button>
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f && (f.type==="application/pdf" || f.name.toLowerCase().endsWith(".pdf"))){setFile(f);setError("");setSuccess("");} else if(f){setError("File harus berformat PDF.");} e.target.value=""; }} />
                    {file && <div className="mt-3 flex justify-end"><button type="button" onClick={() => {setFile(null);setSuccess("");setError("");}} className="text-xs text-[#a34e45]">Hapus file</button></div>}
                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-[#405247]">Posisi nomor
                            <select value={position} onChange={e=>setPosition(e.target.value)} className={fieldClass+" mt-2"}>{positions.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select>
                        </label>
                        <label className="text-xs font-semibold text-[#405247]">Format
                            <select value={formatType} onChange={e=>setFormatType(e.target.value)} className={fieldClass+" mt-2"}><option value="number">1, 2, 3</option><option value="page-of">Page 1 of 10</option></select>
                        </label>
                        <label className="text-xs font-semibold text-[#405247]">Mulai dari nomor
                            <input type="number" min="1" max="999999" value={startNumber} onChange={e=>setStartNumber(e.target.value)} className={fieldClass+" mt-2"}/>
                        </label>
                        <label className="text-xs font-semibold text-[#405247]">Mulai pada halaman ke-
                            <input type="number" min="1" value={startPage} onChange={e=>setStartPage(e.target.value)} className={fieldClass+" mt-2"}/>
                        </label>
                        <label className="text-xs font-semibold text-[#405247]">Ukuran teks (6–24 pt)
                            <input type="number" min="6" max="24" value={fontSize} onChange={e=>setFontSize(e.target.value)} className={fieldClass+" mt-2"}/>
                        </label>
                        <label className="text-xs font-semibold text-[#405247]">Jarak dari tepi (10–100 pt)
                            <input type="number" min="10" max="100" value={margin} onChange={e=>setMargin(e.target.value)} className={fieldClass+" mt-2"}/>
                        </label>
                    </div>
                    <div className="mt-5 rounded-xl border border-[#e5ebe5] bg-[#fbfdfb] p-4">
                        <p className="text-xs font-semibold text-[#405247]">Pratinjau posisi</p>
                        <div className="mx-auto mt-3 flex h-36 max-w-56 flex-col rounded-md border border-[#dce5dc] bg-white p-3 shadow-sm">
                            <div className="flex justify-between text-[10px] text-[#397653]"><span>{position==="top-left"?"1":""}</span><span>{position==="top-center"?"1":""}</span><span>{position==="top-right"?"1":""}</span></div>
                            <div className="flex-1"/>
                            <div className="flex justify-between text-[10px] text-[#397653]"><span>{position==="bottom-left"?"1":""}</span><span>{position==="bottom-center"?"1":""}</span><span>{position==="bottom-right"?"1":""}</span></div>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-[#929b94]">Ilustrasi posisi nomor pada halaman</p>
                    </div>
                    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4f2] p-3 text-xs text-[#a34e45]">{error}</p>}
                    {success && <p role="status" className="mt-4 rounded-lg bg-[#eff7ef] p-3 text-xs text-[#397653]">{success}</p>}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] text-[#929b94]">File diproses sementara dan tidak disimpan sebagai dokumen akun.</p>
                        <button type="button" onClick={processPdf} disabled={busy || !file} className="rounded-lg bg-[#347653] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#285f42] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Memproses..." : "Tambahkan nomor →"}</button>
                    </div>
                </section>
            </div>
        </main>
    );
}
